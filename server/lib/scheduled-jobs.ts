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
import { cancelRecurringPayment } from './helcim';
import { storage } from '../storage';

// Advisory lock IDs for preventing concurrent cron job execution
const AUTO_RELEASE_LOCK_ID = 1234567890;
const EVENT_CHAT_CLEANUP_LOCK_ID = 1234567891;
const SEASON_CHAT_CLEANUP_LOCK_ID = 1234567892;
const MONTHLY_BILLING_LOCK_ID = 1234567893;

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

  // Run on the 1st of each month at 3 AM - Automatic monthly billing
  cron.schedule('0 3 1 * *', async () => {
    console.log('[Monthly Billing] Running automatic monthly club billing...');
    await runWithLock(MONTHLY_BILLING_LOCK_ID, processMonthlyClubBilling);
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

// Automatic monthly club billing based on active player count
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
