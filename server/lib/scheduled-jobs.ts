import cron from 'node-cron';
import { db } from './db';
import { 
  athleteContractsTable, 
  athletesTable, 
  eventsTable, 
  chatChannelsTable, 
  channelParticipantsTable, 
  messagesTable,
  seasonsTable,
  paymentsTable,
  platformLedgerTable,
  PLATFORM_FEES
} from '@shared/schema';
import { eq, lte, and, isNotNull, ne, sql, inArray } from 'drizzle-orm';
import { 
  cancelRecurringPayment, 
  BILLING_MODE, 
  BILLING_AUTOPAY_PREP_ENABLED,
  BILLING_RECONCILIATION_ENABLED,
  PARENT_PAID_FEES_ENABLED,
  calculateBillingPeriod,
  isInNoTouchWindow,
  updateSubscriptionAmount,
  getTransactionsInRange,
  getTransactionDetails,
  processPayment
} from './helcim';
import { storage } from '../storage';
import { calculateTechnologyAndServiceFees, FEE_VERSION } from '@shared/pricing';
import type { PaymentRail } from '@shared/pricing';
import { parentPaymentMethodsTable, programContractsTable } from '@shared/schema';

// Advisory lock IDs for preventing concurrent cron job execution
const AUTO_RELEASE_LOCK_ID = 1234567890;
const EVENT_CHAT_CLEANUP_LOCK_ID = 1234567891;
const SEASON_CHAT_CLEANUP_LOCK_ID = 1234567892;
const MONTHLY_BILLING_LOCK_ID = 1234567893;
const AUTOPAY_PREP_LOCK_ID = 1234567894;
const BILLING_RECONCILIATION_LOCK_ID = 1234567895;
const CONTRACT_AUTO_BILLING_LOCK_ID = 1234567896;

export function initializeScheduledJobs() {
  console.log('[Scheduled Jobs] Initializing scheduled jobs...');

  // Run every day at midnight (00:00) - Contract expiration check
  cron.schedule('0 0 * * *', async () => {
    console.log('[Auto-Release Job] Running daily contract expiration check...');
    await runWithLock(AUTO_RELEASE_LOCK_ID, processExpiredContracts);
  });

  // Run every hour - Event chat cleanup (24 hours after event ends)
  cron.schedule('0 * * * *', async () => {
    console.log('[Event Chat Cleanup] Running hourly event chat cleanup...');
    await runWithLock(EVENT_CHAT_CLEANUP_LOCK_ID, cleanupExpiredEventChats);
  });

  // Run every day at 2 AM - Season-end chat cleanup
  cron.schedule('0 2 * * *', async () => {
    console.log('[Season Chat Cleanup] Running daily season-end chat cleanup...');
    await runWithLock(SEASON_CHAT_CLEANUP_LOCK_ID, cleanupEndedSeasonChats);
  });

  // Run daily at 3 AM - Automatic monthly billing for clubs on their billing day
  // DEPRECATED: Disabled when PARENT_PAID_FEES_ENABLED=true (parents pay at checkout instead)
  // Also disabled when BILLING_MODE=helcim (Helcim handles billing automatically)
  cron.schedule('0 3 * * *', async () => {
    if (PARENT_PAID_FEES_ENABLED) {
      console.log('[Daily Club Billing] SKIPPED - PARENT_PAID_FEES_ENABLED=true (parents pay fees at checkout)');
      return;
    }
    if (BILLING_MODE === 'helcim') {
      console.log('[Daily Club Billing] SKIPPED - BILLING_MODE=helcim (Helcim handles billing)');
      return;
    }
    console.log('[Daily Club Billing] Running club billing check...');
    await runWithLock(MONTHLY_BILLING_LOCK_ID, processDailyClubBilling);
  });

  // Run daily at 4 AM - Check for clubs past grace period and lock them
  // DEPRECATED: Disabled when PARENT_PAID_FEES_ENABLED=true (no club billing = no grace period)
  cron.schedule('0 4 * * *', async () => {
    if (PARENT_PAID_FEES_ENABLED) {
      console.log('[Grace Period Check] SKIPPED - PARENT_PAID_FEES_ENABLED=true (no club billing)');
      return;
    }
    console.log('[Grace Period Check] Checking for clubs past grace period...');
    await runWithLock(MONTHLY_BILLING_LOCK_ID + 1, processGracePeriodLocking);
  });

  // Run daily at 5 AM - Autopay prep job (prepare amounts for Helcim automatic billing)
  // DEPRECATED: Disabled when PARENT_PAID_FEES_ENABLED=true
  // Only runs when BILLING_MODE=helcim and BILLING_AUTOPAY_PREP_ENABLED=true
  cron.schedule('0 5 * * *', async () => {
    if (PARENT_PAID_FEES_ENABLED) {
      console.log('[Autopay Prep] SKIPPED - PARENT_PAID_FEES_ENABLED=true (no club billing)');
      return;
    }
    if (BILLING_MODE !== 'helcim' || !BILLING_AUTOPAY_PREP_ENABLED) {
      console.log('[Autopay Prep] SKIPPED - Not enabled or BILLING_MODE != helcim');
      return;
    }
    console.log('[Autopay Prep] Running autopay prep job...');
    await runWithLock(AUTOPAY_PREP_LOCK_ID, processAutopayPrep);
  });

  // Run daily at 6 AM - Billing reconciliation (read-only, fixes mismatches)
  // DEPRECATED: Disabled when PARENT_PAID_FEES_ENABLED=true
  // Runs when BILLING_MODE=helcim and BILLING_RECONCILIATION_ENABLED=true
  cron.schedule('0 6 * * *', async () => {
    if (PARENT_PAID_FEES_ENABLED) {
      console.log('[Billing Reconciliation] SKIPPED - PARENT_PAID_FEES_ENABLED=true (no club billing)');
      return;
    }
    if (BILLING_MODE !== 'helcim' || !BILLING_RECONCILIATION_ENABLED) {
      console.log('[Billing Reconciliation] SKIPPED - Not enabled or BILLING_MODE != helcim');
      return;
    }
    console.log('[Billing Reconciliation] Running reconciliation job...');
    await runWithLock(BILLING_RECONCILIATION_LOCK_ID, processBillingReconciliation);
  });

  // Run daily at 7 AM - Automated contract billing (parent-paid model)
  // Charges parents whose contracts are due today based on their chosen billing day
  cron.schedule('0 7 * * *', async () => {
    if (!PARENT_PAID_FEES_ENABLED) {
      console.log('[Contract Auto-Billing] SKIPPED - PARENT_PAID_FEES_ENABLED=false');
      return;
    }
    console.log('[Contract Auto-Billing] Running daily contract auto-billing...');
    await runWithLock(CONTRACT_AUTO_BILLING_LOCK_ID, processContractAutoBilling);
  });

  // Also run immediately on startup for testing/catchup (with slight delay)
  setTimeout(async () => {
    console.log('[Auto-Release Job] Running initial contract expiration check...');
    await runWithLock(AUTO_RELEASE_LOCK_ID, processExpiredContracts);
    
    console.log('[Event Chat Cleanup] Running initial event chat cleanup...');
    await runWithLock(EVENT_CHAT_CLEANUP_LOCK_ID, cleanupExpiredEventChats);
    
    console.log('[Season Chat Cleanup] Running initial season-end chat cleanup...');
    await runWithLock(SEASON_CHAT_CLEANUP_LOCK_ID, cleanupEndedSeasonChats);
    
    // Don't run monthly billing on startup - only on schedule
  }, 10000);

  console.log('[Scheduled Jobs] Scheduled jobs initialized');
}

// Run a function with PostgreSQL advisory lock to prevent concurrent execution
async function runWithLock(lockId: number, fn: () => Promise<void>) {
  try {
    // Try to acquire advisory lock (non-blocking)
    const lockResult = await db.execute(
      sql`SELECT pg_try_advisory_lock(${lockId}) as acquired`
    );
    
    const acquired = lockResult.rows?.[0]?.acquired === true;
    
    if (!acquired) {
      console.log('[Scheduled Jobs] Another instance is already processing. Skipping...');
      return;
    }

    try {
      await fn();
    } finally {
      // Always release the lock when done
      await db.execute(sql`SELECT pg_advisory_unlock(${lockId})`);
    }
  } catch (error) {
    console.error('[Scheduled Jobs] Error acquiring lock:', error);
  }
}

async function processExpiredContracts() {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Find all active contracts with valid end_date <= today
    // Ensure end_date is not null and is a valid YYYY-MM-DD format
    const expiredContracts = await db
      .select({
        contractId: athleteContractsTable.id,
        athleteId: athleteContractsTable.athlete_id,
        clubId: athleteContractsTable.club_id,
        endDate: athleteContractsTable.end_date,
      })
      .from(athleteContractsTable)
      .where(
        and(
          eq(athleteContractsTable.status, 'active'),
          isNotNull(athleteContractsTable.end_date),
          // Only process contracts with valid date format and <= today
          sql`${athleteContractsTable.end_date} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`,
          lte(athleteContractsTable.end_date, today)
        )
      );

    console.log(`[Auto-Release Job] Found ${expiredContracts.length} expired contracts`);

    let processedCount = 0;
    let errorCount = 0;

    for (const contract of expiredContracts) {
      try {
        // 1. Update contract: set end_date to today and status to expired (idempotent)
        await db
          .update(athleteContractsTable)
          .set({ 
            end_date: today,  // Update contract_end_date to current timestamp
            status: 'expired' 
          })
          .where(
            and(
              eq(athleteContractsTable.id, contract.contractId),
              eq(athleteContractsTable.status, 'active') // Only update if still active
            )
          );

        // 2. Check if athlete has any other active contracts
        const otherActiveContracts = await db
          .select({ id: athleteContractsTable.id })
          .from(athleteContractsTable)
          .where(
            and(
              eq(athleteContractsTable.athlete_id, contract.athleteId),
              eq(athleteContractsTable.status, 'active'),
              ne(athleteContractsTable.id, contract.contractId) // Exclude this contract
            )
          );

        // 3. If no other active contracts, auto-release the athlete
        // Note: released_by is set to null to indicate automated release (vs manual)
        if (otherActiveContracts.length === 0) {
          await db
            .update(athletesTable)
            .set({
              is_released: true,
              released_at: new Date(),
              released_by: null,  // null indicates automated release
            })
            .where(
              and(
                eq(athletesTable.id, contract.athleteId),
                eq(athletesTable.is_released, false) // Only update if not already released
              )
            );

          console.log(`[Auto-Release Job] Auto-released athlete ${contract.athleteId} - no active contracts remaining`);
        }

        // 4. Attempt to cancel Helcim recurring payment for this contract
        // Note: This is a best-effort call. If no recurring plan exists, it will gracefully handle it.
        const cancelResult = await cancelRecurringPayment(contract.athleteId, contract.contractId);
        if (cancelResult.success && cancelResult.message !== 'No recurring payment plans found to cancel') {
          console.log(`[Auto-Release Job] Cancelled recurring payment for contract ${contract.contractId}`);
        }

        processedCount++;
        console.log(`[Auto-Release Job] Processed expired contract ${contract.contractId} for athlete ${contract.athleteId}`);
      } catch (contractError) {
        errorCount++;
        console.error(`[Auto-Release Job] Error processing contract ${contract.contractId}:`, contractError);
      }
    }

    console.log(`[Auto-Release Job] Completed: ${processedCount} processed, ${errorCount} errors`);
  } catch (error) {
    console.error('[Auto-Release Job] Error in processExpiredContracts:', error);
  }
}

// Clean up chat data for events that ended more than 24 hours ago
async function cleanupExpiredEventChats() {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Find all event channels where the event has ended more than 24 hours ago
    const expiredEventChannels = await db
      .select({
        channelId: chatChannelsTable.id,
        eventId: chatChannelsTable.event_id,
        eventTitle: eventsTable.title,
      })
      .from(chatChannelsTable)
      .innerJoin(eventsTable, eq(chatChannelsTable.event_id, eventsTable.id))
      .where(
        and(
          isNotNull(chatChannelsTable.event_id),
          lte(eventsTable.end_time, twentyFourHoursAgo)
        )
      );

    console.log(`[Event Chat Cleanup] Found ${expiredEventChannels.length} expired event channels to clean up`);

    let deletedChannels = 0;
    let deletedMessages = 0;
    let deletedParticipants = 0;

    for (const channel of expiredEventChannels) {
      try {
        // Delete messages first (child records)
        const msgResult = await db
          .delete(messagesTable)
          .where(eq(messagesTable.channel_id, channel.channelId));
        
        // Delete participants (child records)
        const partResult = await db
          .delete(channelParticipantsTable)
          .where(eq(channelParticipantsTable.channel_id, channel.channelId));
        
        // Delete the channel itself
        await db
          .delete(chatChannelsTable)
          .where(eq(chatChannelsTable.id, channel.channelId));

        deletedChannels++;
        console.log(`[Event Chat Cleanup] Cleaned up channel for event: ${channel.eventTitle}`);
      } catch (channelError) {
        console.error(`[Event Chat Cleanup] Error cleaning up channel ${channel.channelId}:`, channelError);
      }
    }

    console.log(`[Event Chat Cleanup] Completed: ${deletedChannels} channels deleted`);
  } catch (error) {
    console.error('[Event Chat Cleanup] Error in cleanupExpiredEventChats:', error);
  }
}

// Clean up all chat data for seasons that have ended
async function cleanupEndedSeasonChats() {
  try {
    const now = new Date();
    
    // Find all seasons that have ended but haven't been cleaned up yet
    const endedSeasons = await db
      .select()
      .from(seasonsTable)
      .where(
        and(
          lte(seasonsTable.end_date, now),
          eq(seasonsTable.chat_data_deleted, false)
        )
      );

    console.log(`[Season Chat Cleanup] Found ${endedSeasons.length} ended seasons to clean up`);

    for (const season of endedSeasons) {
      try {
        // Get all non-event channels for this club (event channels are cleaned up separately)
        // We delete: direct, team, program, group channels
        const clubChannels = await db
          .select({ id: chatChannelsTable.id })
          .from(chatChannelsTable)
          .where(
            and(
              eq(chatChannelsTable.club_id, season.club_id),
              sql`${chatChannelsTable.event_id} IS NULL` // Only non-event channels
            )
          );

        const channelIds = clubChannels.map(c => c.id);
        
        if (channelIds.length > 0) {
          // Delete messages first
          await db
            .delete(messagesTable)
            .where(inArray(messagesTable.channel_id, channelIds));
          
          // Delete participants
          await db
            .delete(channelParticipantsTable)
            .where(inArray(channelParticipantsTable.channel_id, channelIds));
          
          // Delete channels
          await db
            .delete(chatChannelsTable)
            .where(inArray(chatChannelsTable.id, channelIds));
        }

        // Mark season as cleaned up
        await db
          .update(seasonsTable)
          .set({ chat_data_deleted: true })
          .where(eq(seasonsTable.id, season.id));

        console.log(`[Season Chat Cleanup] Cleaned up ${channelIds.length} channels for season: ${season.name}`);
      } catch (seasonError) {
        console.error(`[Season Chat Cleanup] Error cleaning up season ${season.id}:`, seasonError);
      }
    }

    console.log(`[Season Chat Cleanup] Completed: ${endedSeasons.length} seasons processed`);
  } catch (error) {
    console.error('[Season Chat Cleanup] Error in cleanupEndedSeasonChats:', error);
  }
}

// Grace period constant (7 days)
const GRACE_PERIOD_DAYS = 7;

// Process clubs past their grace period and lock them
async function processGracePeriodLocking() {
  try {
    console.log('[Grace Period Check] Checking for clubs with unpaid invoices past grace period...');
    
    const clubsPastGrace = await storage.getClubsPastGracePeriod(GRACE_PERIOD_DAYS);
    
    console.log(`[Grace Period Check] Found ${clubsPastGrace.length} clubs past grace period`);
    
    for (const club of clubsPastGrace) {
      // Skip test clubs
      const clubNameUpper = club.name.toUpperCase();
      if (clubNameUpper.includes('TEST') || clubNameUpper.includes('DO NOT BILL')) {
        console.log(`[Grace Period Check] Skipping test club: ${club.name}`);
        continue;
      }
      
      try {
        await storage.lockClub(club.id);
        console.log(`[Grace Period Check] Locked club: ${club.name} (${club.id})`);
      } catch (lockError) {
        console.error(`[Grace Period Check] Error locking club ${club.id}:`, lockError);
      }
    }
    
    console.log('[Grace Period Check] Complete');
  } catch (error) {
    console.error('[Grace Period Check] Error:', error);
  }
}

// Daily billing check - bills clubs on their chosen billing day
async function processDailyClubBilling() {
  try {
    const today = new Date();
    const dayOfMonth = today.getDate();
    
    // Handle end of month edge case (if billing_day > days in month, bill on last day)
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    
    console.log(`[Daily Club Billing] Today is day ${dayOfMonth} of month (last day: ${lastDayOfMonth})`);
    
    // Get clubs due to bill today
    let clubsDueToBill = await storage.getClubsDueToBill(dayOfMonth);
    
    // Also get clubs with billing_day > last day of month if today is the last day
    if (dayOfMonth === lastDayOfMonth) {
      const allClubs = await storage.getAllClubs();
      const endOfMonthClubs = allClubs.filter(club => 
        (club.billing_day ?? 1) > lastDayOfMonth && !club.billing_locked_at
      );
      clubsDueToBill = [...clubsDueToBill, ...endOfMonthClubs];
    }
    
    console.log(`[Daily Club Billing] Found ${clubsDueToBill.length} clubs to bill today`);
    
    for (const club of clubsDueToBill) {
      // Skip test clubs
      const clubNameUpper = club.name.toUpperCase();
      if (clubNameUpper.includes('TEST') || clubNameUpper.includes('DO NOT BILL')) {
        console.log(`[Daily Club Billing] Skipping test club: ${club.name}`);
        continue;
      }
      
      // Calculate billing period (previous month from the club's billing day)
      const periodEnd = new Date(today.getFullYear(), today.getMonth(), dayOfMonth);
      const periodStart = new Date(today.getFullYear(), today.getMonth() - 1, dayOfMonth);
      
      // Check if we already billed this club for this period
      if (club.last_billed_period_start) {
        const lastBilledStart = new Date(club.last_billed_period_start);
        if (lastBilledStart.getTime() >= periodStart.getTime()) {
          console.log(`[Daily Club Billing] Club ${club.name} already billed for this period`);
          continue;
        }
      }
      
      console.log(`[Daily Club Billing] Processing club ${club.name} for period ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);
      
      // Get active athletes for this club in this period
      const activeAthletes = await storage.getActiveAthletesForPeriod(club.id, periodStart, periodEnd);
      
      let entriesCreated = 0;
      
      for (const athlete of activeAthletes) {
        // Check if there's already a ledger entry for this athlete in this period
        const hasExistingEntry = await storage.hasMonthlyLedgerEntryForAthlete(
          club.id,
          athlete.id,
          periodStart,
          periodEnd
        );
        
        if (hasExistingEntry) {
          continue;
        }
        
        try {
          await storage.createAutoBillingLedgerEntry(
            club.id,
            athlete.id,
            PLATFORM_FEES.monthly,
            'monthly',
            periodStart.toISOString().split('T')[0]
          );
          
          entriesCreated++;
          console.log(`[Daily Club Billing] Created ledger entry for athlete ${athlete.id}`);
        } catch (entryError) {
          console.error(`[Daily Club Billing] Error creating ledger entry:`, entryError);
        }
      }
      
      // Update club billing status
      try {
        await storage.updateClubBillingStatus(club.id, new Date(), periodStart);
        console.log(`[Daily Club Billing] Created ${entriesCreated} ledger entries for club ${club.name}`);
      } catch (statusError) {
        console.error(`[Daily Club Billing] Error updating club billing status:`, statusError);
      }
    }
    
    console.log('[Daily Club Billing] Complete');
  } catch (error) {
    console.error('[Daily Club Billing] Error:', error);
  }
}

// Automatic monthly club billing based on active player count (legacy - kept for reference)
// Runs on the 1st of each month to bill for the previous month
async function processMonthlyClubBilling() {
  try {
    console.log('[Monthly Billing] Starting automatic monthly billing process...');
    
    // Calculate billing period (previous month)
    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1); // First of current month
    const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1); // First of previous month
    
    console.log(`[Monthly Billing] Billing period: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);
    
    // Get active athlete counts for all clubs
    const activeAthletesByClub = await storage.getActiveAthleteCountByClub(periodStart, periodEnd);
    
    console.log(`[Monthly Billing] Found ${activeAthletesByClub.length} clubs with active athletes`);
    
    let totalEntriesCreated = 0;
    let totalAmount = 0;
    
    for (const club of activeAthletesByClub) {
      // Skip test clubs (case-insensitive check)
      const clubNameUpper = club.clubName.toUpperCase();
      if (clubNameUpper.includes('TEST') || clubNameUpper.includes('DO NOT BILL')) {
        console.log(`[Monthly Billing] Skipping test club: ${club.clubName}`);
        continue;
      }
      
      // Get the actual active athletes for this club
      const activeAthletes = await storage.getActiveAthletesForPeriod(club.clubId, periodStart, periodEnd);
      
      for (const athlete of activeAthletes) {
        // Check if there's already a ledger entry for this athlete in this period
        const hasExistingEntry = await storage.hasMonthlyLedgerEntryForAthlete(
          club.clubId,
          athlete.id,
          periodStart,
          periodEnd
        );
        
        if (hasExistingEntry) {
          // Already billed for this athlete this month
          continue;
        }
        
        // Create a platform ledger entry for this athlete (no payment_id for auto-billing)
        try {
          await storage.createAutoBillingLedgerEntry(
            club.clubId,
            athlete.id,
            PLATFORM_FEES.monthly,
            'monthly',
            periodStart.toISOString().split('T')[0]
          );
          
          totalEntriesCreated++;
          totalAmount += PLATFORM_FEES.monthly;
          
          console.log(`[Monthly Billing] Created ledger entry for athlete ${athlete.id} in club ${club.clubName}`);
        } catch (entryError) {
          console.error(`[Monthly Billing] Error creating ledger entry for athlete ${athlete.id}:`, entryError);
        }
      }
    }
    
    console.log(`[Monthly Billing] Complete: Created ${totalEntriesCreated} ledger entries, total amount: $${totalAmount.toFixed(2)}`);
  } catch (error) {
    console.error('[Monthly Billing] Error in processMonthlyClubBilling:', error);
  }
}

// ============ HELCIM MODEL A JOBS ============

/**
 * Autopay Prep Job - Prepares variable monthly amounts for Helcim automatic billing
 * Runs daily at 5 AM when BILLING_MODE=helcim
 * 
 * This job:
 * 1. For each club with an active Helcim subscription
 * 2. Calculates the platform fee for the upcoming billing period
 * 3. PATCH the subscription's recurringAmount (unless in no-touch window)
 * 4. Creates/updates platform_autopay_charges record with status=prepared
 * 
 * IMPORTANT: This job does NOT charge anyone. It only prepares amounts.
 */
async function processAutopayPrep() {
  try {
    const now = new Date();
    console.log(`[Autopay Prep] Starting autopay prep at ${now.toISOString()}`);
    
    // Get all clubs with active Helcim subscriptions
    const clubsWithSubscriptions = await storage.getClubsWithHelcimSubscriptions();
    
    console.log(`[Autopay Prep] Found ${clubsWithSubscriptions.length} clubs with Helcim subscriptions`);
    
    let preparedCount = 0;
    let skippedNoTouchCount = 0;
    let errorCount = 0;
    
    for (const club of clubsWithSubscriptions) {
      try {
        // Skip test clubs
        const clubNameUpper = club.name.toUpperCase();
        if (clubNameUpper.includes('TEST') || clubNameUpper.includes('DO NOT BILL')) {
          console.log(`[Autopay Prep] Skipping test club: ${club.name}`);
          continue;
        }
        
        const billingDay = club.billing_day ?? 1;
        
        // Check no-touch window (24h before through 12h after billing day)
        if (isInNoTouchWindow(billingDay, now)) {
          // In no-touch window - check if transaction already exists for this cycle
          const existingCharge = await storage.getAutopayChargeForPeriod(
            club.id,
            billingDay,
            now
          );
          
          if (existingCharge && existingCharge.status !== 'prepared') {
            console.log(`[Autopay Prep] Skipping ${club.name} - in no-touch window and charge already processed`);
            skippedNoTouchCount++;
            continue;
          }
        }
        
        // Calculate billing period deterministically
        const { periodStart, periodEnd } = calculateBillingPeriod(billingDay, now);
        const periodStartStr = periodStart.toISOString().split('T')[0];
        const periodEndStr = periodEnd.toISOString().split('T')[0];
        
        // Get ledger summary for this period (same logic as preview)
        const ledgerSummary = await storage.getPlatformLedgerSummary(
          club.id,
          periodStart,
          periodEnd
        );
        
        // Calculate total with convenience fee
        const subtotal = ledgerSummary.totalAmount;
        const paymentMethod = club.billing_method || 'card';
        const convenienceFee = paymentMethod === 'card' 
          ? Math.round(subtotal * 0.03 * 100) / 100 
          : 1.00;
        const totalAmount = subtotal + convenienceFee;
        
        if (totalAmount <= 0) {
          console.log(`[Autopay Prep] Skipping ${club.name} - no billable amount`);
          continue;
        }
        
        // Update Helcim subscription amount
        if (club.helcim_subscription_id) {
          const updateResult = await updateSubscriptionAmount(
            club.helcim_subscription_id,
            totalAmount
          );
          
          if (!updateResult.success) {
            console.error(`[Autopay Prep] Failed to update subscription for ${club.name}: ${updateResult.error}`);
            errorCount++;
            continue;
          }
        }
        
        // Create or update autopay charge record
        await storage.upsertAutopayCharge({
          club_id: club.id,
          period_start: periodStartStr,
          period_end: periodEndStr,
          amount: String(subtotal),
          convenience_fee: String(convenienceFee),
          status: 'prepared',
          helcim_subscription_id: club.helcim_subscription_id || null,
        });
        
        preparedCount++;
        console.log(`[Autopay Prep] Prepared ${club.name}: $${totalAmount.toFixed(2)} for period ${periodStartStr} to ${periodEndStr}`);
        
      } catch (clubError) {
        console.error(`[Autopay Prep] Error processing club ${club.name}:`, clubError);
        errorCount++;
      }
    }
    
    console.log(`[Autopay Prep] Complete: ${preparedCount} prepared, ${skippedNoTouchCount} skipped (no-touch), ${errorCount} errors`);
  } catch (error) {
    console.error('[Autopay Prep] Error:', error);
  }
}

/**
 * Billing Reconciliation Job - Syncs Helcim transaction status with our records
 * Runs daily at 6 AM when BILLING_MODE=helcim
 * 
 * This job:
 * 1. Pulls Helcim transactions for the last 14 days
 * 2. Matches to platform_autopay_charges by customerCode + amount + date window
 * 3. Updates invoice/ledger status for any mismatches
 * 4. Logs unresolved items for manual review
 * 
 * IMPORTANT: This job NEVER charges anyone. It only reads and updates local records.
 */
async function processBillingReconciliation() {
  try {
    const now = new Date();
    const dateFrom = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const dateTo = now;
    
    const dateFromStr = dateFrom.toISOString().split('T')[0];
    const dateToStr = dateTo.toISOString().split('T')[0];
    
    console.log(`[Billing Reconciliation] Checking transactions from ${dateFromStr} to ${dateToStr}`);
    
    // Get all transactions from Helcim for the date range
    const { transactions, error } = await getTransactionsInRange(dateFromStr, dateToStr);
    
    if (error) {
      console.error(`[Billing Reconciliation] Failed to fetch transactions: ${error}`);
      return;
    }
    
    console.log(`[Billing Reconciliation] Found ${transactions.length} transactions to reconcile`);
    
    let reconciledCount = 0;
    let alreadyMatchedCount = 0;
    let unresolvedCount = 0;
    
    for (const tx of transactions) {
      try {
        const customerCode = tx.customerCode;
        const transactionId = tx.transactionId?.toString();
        const amount = parseFloat(tx.amount || '0');
        const status = tx.status?.toUpperCase();
        
        if (!customerCode || !transactionId) {
          continue;
        }
        
        // Find club by customer code
        const club = await storage.getClubByCustomerCode(customerCode);
        if (!club) {
          // Not a platform billing transaction
          continue;
        }
        
        // Check if we already have this transaction recorded
        const existingCharge = await storage.getAutopayChargeByTransactionId(transactionId);
        if (existingCharge) {
          alreadyMatchedCount++;
          continue;
        }
        
        // Try to match to a prepared autopay charge
        const billingDay = club.billing_day ?? 1;
        const txDate = new Date(tx.dateCreated || tx.date);
        const { periodStart, periodEnd } = calculateBillingPeriod(billingDay, txDate);
        
        const pendingCharge = await storage.getAutopayChargeForPeriod(
          club.id,
          billingDay,
          txDate
        );
        
        if (pendingCharge && pendingCharge.status === 'prepared') {
          // Match found - update status based on Helcim status
          const newStatus = status === 'APPROVED' ? 'paid' : 'failed';
          
          await storage.updateAutopayChargeStatus(
            pendingCharge.id,
            newStatus,
            transactionId
          );
          
          // If paid, mark ledger entries as paid
          if (newStatus === 'paid') {
            await storage.markLedgerEntriesPaidForPeriod(
              club.id,
              periodStart,
              periodEnd
            );
          }
          
          reconciledCount++;
          console.log(`[Billing Reconciliation] Reconciled ${club.name}: txn ${transactionId} -> ${newStatus}`);
        } else {
          // No matching charge found - log for manual review
          console.warn(`[Billing Reconciliation] Unresolved: club ${club.name}, txn ${transactionId}, amount $${amount}`);
          unresolvedCount++;
        }
        
      } catch (txError) {
        console.error(`[Billing Reconciliation] Error processing transaction:`, txError);
      }
    }
    
    console.log(`[Billing Reconciliation] Complete: ${reconciledCount} reconciled, ${alreadyMatchedCount} already matched, ${unresolvedCount} unresolved`);
  } catch (error) {
    console.error('[Billing Reconciliation] Error:', error);
  }
}

async function processContractAutoBilling() {
  try {
    const today = new Date().toISOString().split('T')[0];
    console.log(`[Contract Auto-Billing] Checking for contracts due on ${today}...`);

    const dueContracts = await storage.getContractsDueForBilling(today);
    console.log(`[Contract Auto-Billing] Found ${dueContracts.length} contracts due for billing`);

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (const contract of dueContracts) {
      try {
        if (contract.end_date && contract.end_date <= today) {
          await storage.updateAthleteContractStatus(contract.club_id, contract.id, 'expired');
          console.log(`[Contract Auto-Billing] Contract ${contract.id} expired (end_date: ${contract.end_date})`);
          skippedCount++;
          continue;
        }

        if (!contract.payment_method_id) {
          console.warn(`[Contract Auto-Billing] Contract ${contract.id} has no payment method, skipping`);
          skippedCount++;
          continue;
        }

        const paymentMethod = await storage.getParentPaymentMethod(contract.payment_method_id);
        if (!paymentMethod) {
          console.warn(`[Contract Auto-Billing] Payment method ${contract.payment_method_id} not found for contract ${contract.id}`);
          await storage.updateContractBillingState(contract.id, {
            billing_status: 'failed',
            billing_failure_count: (contract.billing_failure_count || 0) + 1,
          });
          failCount++;
          continue;
        }

        const [programContract] = await db.select().from(programContractsTable)
          .where(eq(programContractsTable.id, contract.program_contract_id));
        if (!programContract) {
          console.warn(`[Contract Auto-Billing] Program contract ${contract.program_contract_id} not found`);
          skippedCount++;
          continue;
        }

        const baseAmount = contract.custom_price || parseFloat(programContract.monthly_price as string);
        if (baseAmount <= 0) {
          console.log(`[Contract Auto-Billing] Contract ${contract.id} has $0 amount, skipping`);
          skippedCount++;
          continue;
        }

        const athlete = await storage.getAthlete(contract.club_id, contract.athlete_id);
        if (!athlete) {
          console.warn(`[Contract Auto-Billing] Athlete ${contract.athlete_id} not found`);
          skippedCount++;
          continue;
        }

        const paymentRail: PaymentRail = paymentMethod.payment_type === 'ach' ? 'ach' : 'card_credit';

        const feeCalc = calculateTechnologyAndServiceFees({
          baseAmount,
          paymentRail,
          paymentKind: 'recurring_contract',
          monthsCount: 1,
        });

        const cardToken = paymentMethod.card_token || paymentMethod.bank_token;
        if (!cardToken) {
          console.warn(`[Contract Auto-Billing] No token found on payment method ${paymentMethod.id}`);
          await storage.updateContractBillingState(contract.id, {
            billing_status: 'failed',
            billing_failure_count: (contract.billing_failure_count || 0) + 1,
          });
          failCount++;
          continue;
        }

        const paymentResult = await processPayment({
          amount: feeCalc.totalAmount,
          cardToken,
          invoiceNumber: `CONTRACT-${contract.id.slice(0, 8)}-${today.replace(/-/g, '')}`,
          comments: `Monthly contract billing: ${programContract.name} - ${athlete.first_name} ${athlete.last_name}`,
        });

        if (!paymentResult.success) {
          console.error(`[Contract Auto-Billing] Payment failed for contract ${contract.id}: ${paymentResult.error}`);
          const newFailCount = (contract.billing_failure_count || 0) + 1;
          await storage.updateContractBillingState(contract.id, {
            billing_status: newFailCount >= 3 ? 'paused' : 'failed',
            billing_failure_count: newFailCount,
          });
          failCount++;
          continue;
        }

        await storage.createPayment(contract.club_id, {
          athlete_id: contract.athlete_id,
          amount: feeCalc.totalAmount,
          payment_type: 'monthly',
          status: 'completed',
          description: `Monthly: ${programContract.name}`,
          helcim_transaction_id: paymentResult.transactionId,
          base_amount: baseAmount,
          tech_fee_amount: feeCalc.techFee,
          payment_rail: paymentRail,
          payment_kind: 'recurring_contract',
          months_count: 1,
          fee_version: FEE_VERSION,
        });

        await storage.createPlatformLedgerEntry(contract.club_id, contract.athlete_id, PLATFORM_FEES.monthly, 'monthly');

        const billingDay = contract.billing_day_of_month || parseInt(today.split('-')[2]);
        const currentDate = new Date(today + 'T00:00:00Z');
        const nextMonth = new Date(Date.UTC(
          currentDate.getUTCFullYear(),
          currentDate.getUTCMonth() + 1,
          billingDay
        ));
        const nextBillingDate = nextMonth.toISOString().split('T')[0];

        await storage.updateContractBillingState(contract.id, {
          billing_status: 'active',
          next_billing_date: nextBillingDate,
          last_billed_at: new Date(),
          billing_failure_count: 0,
        });

        console.log(`[Contract Auto-Billing] Successfully billed contract ${contract.id}: $${feeCalc.totalAmount} (base: $${baseAmount}, fee: $${feeCalc.techFee}). Next billing: ${nextBillingDate}`);
        successCount++;

      } catch (contractError) {
        console.error(`[Contract Auto-Billing] Error processing contract ${contract.id}:`, contractError);
        failCount++;
      }
    }

    console.log(`[Contract Auto-Billing] Complete: ${successCount} successful, ${failCount} failed, ${skippedCount} skipped`);
  } catch (error) {
    console.error('[Contract Auto-Billing] Error:', error);
  }
}
