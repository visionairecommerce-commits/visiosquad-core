import cron from 'node-cron';
import { db } from './db';
import { athleteContractsTable, athletesTable } from '@shared/schema';
import { eq, lte, and, isNotNull, ne, sql } from 'drizzle-orm';
import { cancelRecurringPayment } from './helcim';

// Advisory lock ID for preventing concurrent cron job execution
const AUTO_RELEASE_LOCK_ID = 1234567890;

export function initializeScheduledJobs() {
  console.log('[Scheduled Jobs] Initializing scheduled jobs...');

  // Run every day at midnight (00:00)
  cron.schedule('0 0 * * *', async () => {
    console.log('[Auto-Release Job] Running daily contract expiration check...');
    await runWithLock(processExpiredContracts);
  });

  // Also run immediately on startup for testing/catchup (with slight delay)
  setTimeout(async () => {
    console.log('[Auto-Release Job] Running initial contract expiration check...');
    await runWithLock(processExpiredContracts);
  }, 10000);

  console.log('[Scheduled Jobs] Scheduled jobs initialized');
}

// Run a function with PostgreSQL advisory lock to prevent concurrent execution
async function runWithLock(fn: () => Promise<void>) {
  try {
    // Try to acquire advisory lock (non-blocking)
    const lockResult = await db.execute(
      sql`SELECT pg_try_advisory_lock(${AUTO_RELEASE_LOCK_ID}) as acquired`
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
      await db.execute(sql`SELECT pg_advisory_unlock(${AUTO_RELEASE_LOCK_ID})`);
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
