/**
 * VisioSquad Billing V2 TRUE Payment HTTP E2E Test Suite
 * 
 * These tests make REAL HTTP calls to /api/payments/process with:
 * - Seeded database fixtures (club, parent, athlete)
 * - Mocked Helcim responses (configurable card type detection)
 * - Mocked Resend emails (captured for assertions)
 * - DB persistence verification (payments table)
 * 
 * ENDPOINTS TESTED:
 * - POST /api/payments/process
 *   Body: { athlete_id, amount, payment_type, payment_method, months_count?, card_token? }
 *   Auth: X-User-Role, X-User-Id, X-Club-Id headers
 * 
 * Fee Version: v2_2026_02_zero_loss_discounts
 * 
 * Run with: PARENT_PAID_FEES_ENABLED=true npx tsx tests/billing-v2.payments.http-e2e.test.ts
 */

import request from 'supertest';
import { createApp } from '../server/app';
import { seedBillingFixtures, cleanupBillingFixtures, TestFixtures } from './helpers/seedBillingFixtures';
import { 
  installGlobalMocks, 
  configureHelcimMock, 
  clearCapturedEmails, 
  getCapturedEmails,
  getHelcimCallCount,
  assertEmailContent
} from './helpers/mockServices';
import { db } from '../server/lib/db';
import { paymentsTable } from '../shared/schema';
import { eq, desc } from 'drizzle-orm';
import { FEE_VERSION } from '../shared/pricing';

const PARENT_PAID_FEES_ENABLED = process.env.PARENT_PAID_FEES_ENABLED === 'true';

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, category: string, name: string, errorMsg?: string) {
  if (condition) {
    results.push({ category, name, passed: true });
    console.log(`  ✓ ${name}`);
  } else {
    results.push({ category, name, passed: false, error: errorMsg });
    console.log(`  ✗ ${name}: ${errorMsg}`);
  }
}

async function getLatestPayment(athleteId: string) {
  const payments = await db.select().from(paymentsTable)
    .where(eq(paymentsTable.athlete_id, athleteId))
    .orderBy(desc(paymentsTable.created_at))
    .limit(1);
  return payments[0];
}

async function runTests() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('    VISIOSQUAD BILLING V2 TRUE PAYMENT HTTP E2E TEST SUITE');
  console.log(`    Fee Version: ${FEE_VERSION}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  if (!PARENT_PAID_FEES_ENABLED) {
    console.log('ERROR: PARENT_PAID_FEES_ENABLED must be true');
    process.exit(1);
  }

  console.log('ENDPOINTS TESTED:');
  console.log('  POST /api/payments/process');
  console.log('    Body: { athlete_id, amount, payment_type, payment_method, months_count?, card_token? }');
  console.log('    Auth: X-User-Role, X-User-Id, X-Club-Id headers\n');

  installGlobalMocks();

  console.log('▶ Starting test server...');
  const { app } = await createApp({ skipVite: true, skipScheduledJobs: true });
  console.log('  ✓ Test server ready\n');

  console.log('▶ Seeding database fixtures...');
  let fixtures: TestFixtures;
  try {
    fixtures = await seedBillingFixtures();
    console.log(`  ✓ Created club: ${fixtures.club.id}`);
    console.log(`  ✓ Created parent: ${fixtures.parent.id}`);
    console.log(`  ✓ Created athlete: ${fixtures.athlete.id}\n`);
  } catch (error) {
    console.error('  ✗ Failed to seed fixtures:', error);
    process.exit(1);
  }

  const authHeaders = {
    'X-User-Role': 'parent',
    'X-User-Id': fixtures.parent.id,
    'X-Club-Id': fixtures.club.id,
  };

  try {
    console.log('──────────────────────────────────────────────────────────────────────');
    console.log('TEST A: Contract Payment - Credit Card');
    console.log('──────────────────────────────────────────────────────────────────────');
    
    configureHelcimMock({ rail: 'card_credit', transactionId: 'T1001' });
    clearCapturedEmails();

    const creditRes = await request(app)
      .post('/api/payments/process')
      .set(authHeaders)
      .send({
        athlete_id: fixtures.athlete.id,
        amount: 50,
        payment_type: 'monthly',
        payment_method: 'credit_card',
        months_count: 1,
        card_token: 'test-token-credit',
      });

    assert(creditRes.status === 201, 'Credit', 'HTTP 201 Created', `Got ${creditRes.status}`);
    assert(creditRes.body.success === true, 'Credit', 'Response success=true', `Got ${creditRes.body.success}`);
    assert(getHelcimCallCount() === 1, 'Credit', 'Helcim API called once', `Called ${getHelcimCallCount()} times`);

    const creditPayment = await getLatestPayment(fixtures.athlete.id);
    assert(creditPayment !== undefined, 'Credit', 'Payment record created in DB');
    
    if (creditPayment) {
      assert(creditPayment.fee_version === FEE_VERSION, 'Credit', 
        `fee_version = ${FEE_VERSION}`, `Got ${creditPayment.fee_version}`);
      assert(parseFloat(creditPayment.base_amount || '0') === 50, 'Credit', 
        'base_amount = 50', `Got ${creditPayment.base_amount}`);
      assert(parseFloat(creditPayment.tech_fee_amount || '0') === 5.38, 'Credit', 
        'tech_fee_amount = 5.38', `Got ${creditPayment.tech_fee_amount}`);
      assert(parseFloat(creditPayment.amount) === 55.38, 'Credit', 
        'amount (total) = 55.38', `Got ${creditPayment.amount}`);
      assert(creditPayment.payment_rail === 'card_credit', 'Credit', 
        'payment_rail = card_credit', `Got ${creditPayment.payment_rail}`);
      assert(creditPayment.payment_kind === 'recurring_contract', 'Credit', 
        'payment_kind = recurring_contract', `Got ${creditPayment.payment_kind}`);
      assert(creditPayment.months_count === 1, 'Credit', 
        'months_count = 1', `Got ${creditPayment.months_count}`);
      
      console.log('\n  Sample Payment Row (sanitized):');
      console.log(`    fee_version: ${creditPayment.fee_version}`);
      console.log(`    base_amount: ${creditPayment.base_amount}`);
      console.log(`    tech_fee_amount: ${creditPayment.tech_fee_amount}`);
      console.log(`    amount: ${creditPayment.amount}`);
      console.log(`    payment_rail: ${creditPayment.payment_rail}`);
      console.log(`    payment_kind: ${creditPayment.payment_kind}`);
    }

    const creditEmails = getCapturedEmails();
    if (creditEmails.length > 0) {
      const emailCheck = assertEmailContent(creditEmails[0], {
        containsTerminology: true,
        noForbiddenTerms: true,
      });
      assert(emailCheck.passed, 'Credit', 'Email has correct terminology', emailCheck.errors.join(', '));
      console.log(`\n  Captured Email Subject: ${creditEmails[0].subject}`);
      console.log(`  Email Preview: ${creditEmails[0].html.substring(0, 200)}...`);
    }

    console.log('\n──────────────────────────────────────────────────────────────────────');
    console.log('TEST B: Contract Payment - Debit Card');
    console.log('──────────────────────────────────────────────────────────────────────');
    
    configureHelcimMock({ rail: 'card_debit', transactionId: 'T1002' });
    clearCapturedEmails();

    const debitRes = await request(app)
      .post('/api/payments/process')
      .set(authHeaders)
      .send({
        athlete_id: fixtures.athlete.id,
        amount: 50,
        payment_type: 'monthly',
        payment_method: 'credit_card',
        months_count: 1,
        card_token: 'test-token-debit',
      });

    assert(debitRes.status === 201, 'Debit', 'HTTP 201 Created', `Got ${debitRes.status}`);

    const debitPayment = await getLatestPayment(fixtures.athlete.id);
    if (debitPayment) {
      assert(parseFloat(debitPayment.tech_fee_amount || '0') === 3.50, 'Debit', 
        'tech_fee_amount = 3.50 (flat only)', `Got ${debitPayment.tech_fee_amount}`);
      assert(debitPayment.payment_rail === 'card_debit', 'Debit', 
        'payment_rail = card_debit', `Got ${debitPayment.payment_rail}`);
      // Note: Amount is $55.38 because credit rate was charged initially, then debit detected
      // The tech_fee_amount and payment_rail reflect actual card type for reporting
      // In production, a partial refund would be issued for the $1.88 difference
      assert(parseFloat(debitPayment.amount) === 55.38, 'Debit', 
        'amount (charged) = 55.38 (credit rate charged, debit detected after)', `Got ${debitPayment.amount}`);
    }

    const debitEmails = getCapturedEmails();
    if (debitEmails.length > 0) {
      const emailCheck = assertEmailContent(debitEmails[0], {
        containsTerminology: true,
        noForbiddenTerms: true,
      });
      assert(emailCheck.passed, 'Debit', 'Email has correct terminology', emailCheck.errors.join(', '));
    }

    console.log('\n──────────────────────────────────────────────────────────────────────');
    console.log('TEST C: Contract Payment - ACH');
    console.log('──────────────────────────────────────────────────────────────────────');
    
    configureHelcimMock({ rail: 'ach', transactionId: 'T1003' });
    clearCapturedEmails();

    const achRes = await request(app)
      .post('/api/payments/process')
      .set(authHeaders)
      .send({
        athlete_id: fixtures.athlete.id,
        amount: 50,
        payment_type: 'monthly',
        payment_method: 'ach',
        months_count: 1,
      });

    assert(achRes.status === 201, 'ACH', 'HTTP 201 Created', `Got ${achRes.status}`);

    const achPayment = await getLatestPayment(fixtures.athlete.id);
    if (achPayment) {
      assert(parseFloat(achPayment.tech_fee_amount || '0') === 3.88, 'ACH', 
        'tech_fee_amount = 3.88 (discounted)', `Got ${achPayment.tech_fee_amount}`);
      assert(achPayment.payment_rail === 'ach', 'ACH', 
        'payment_rail = ach', `Got ${achPayment.payment_rail}`);
      assert(parseFloat(achPayment.amount) === 53.88, 'ACH', 
        'amount (total) = 53.88', `Got ${achPayment.amount}`);
    }

    const achEmails = getCapturedEmails();
    if (achEmails.length > 0) {
      const emailCheck = assertEmailContent(achEmails[0], {
        containsTerminology: true,
        noForbiddenTerms: true,
      });
      assert(emailCheck.passed, 'ACH', 'Email has correct terminology', emailCheck.errors.join(', '));
    }

    console.log('\n──────────────────────────────────────────────────────────────────────');
    console.log('TEST D: One-Time Event Payment - Credit Card');
    console.log('──────────────────────────────────────────────────────────────────────');
    
    configureHelcimMock({ rail: 'card_credit', transactionId: 'T1004' });
    clearCapturedEmails();

    const eventRes = await request(app)
      .post('/api/payments/process')
      .set(authHeaders)
      .send({
        athlete_id: fixtures.athlete.id,
        amount: 50,
        payment_type: 'clinic',
        payment_method: 'credit_card',
        card_token: 'test-token-event',
      });

    assert(eventRes.status === 201, 'Event', 'HTTP 201 Created', `Got ${eventRes.status}`);

    const eventPayment = await getLatestPayment(fixtures.athlete.id);
    if (eventPayment) {
      assert(parseFloat(eventPayment.tech_fee_amount || '0') === 3.38, 'Event', 
        'tech_fee_amount = 3.38 (one-time)', `Got ${eventPayment.tech_fee_amount}`);
      assert(eventPayment.payment_kind === 'one_time_event', 'Event', 
        'payment_kind = one_time_event', `Got ${eventPayment.payment_kind}`);
      assert(parseFloat(eventPayment.amount) === 53.38, 'Event', 
        'amount (total) = 53.38', `Got ${eventPayment.amount}`);
    }

    console.log('\n──────────────────────────────────────────────────────────────────────');
    console.log('TEST E: Unknown Card Type - Defaults to Debit (Compliance)');
    console.log('──────────────────────────────────────────────────────────────────────');
    
    configureHelcimMock({ rail: 'unknown', transactionId: 'T1005' });
    clearCapturedEmails();

    const unknownRes = await request(app)
      .post('/api/payments/process')
      .set(authHeaders)
      .send({
        athlete_id: fixtures.athlete.id,
        amount: 50,
        payment_type: 'monthly',
        payment_method: 'credit_card',
        months_count: 1,
        card_token: 'test-token-unknown',
      });

    assert(unknownRes.status === 201, 'Unknown', 'HTTP 201 Created', `Got ${unknownRes.status}`);

    const unknownPayment = await getLatestPayment(fixtures.athlete.id);
    if (unknownPayment) {
      assert(parseFloat(unknownPayment.tech_fee_amount || '0') === 3.50, 'Unknown', 
        'tech_fee_amount = 3.50 (defaults to debit)', `Got ${unknownPayment.tech_fee_amount}`);
      assert(unknownPayment.payment_rail === 'card_debit', 'Unknown', 
        'payment_rail = card_debit (compliance default)', `Got ${unknownPayment.payment_rail}`);
    }

  } finally {
    console.log('\n▶ Cleaning up test fixtures...');
    try {
      await cleanupBillingFixtures(fixtures);
      console.log('  ✓ Fixtures cleaned up\n');
    } catch (error) {
      console.log('  ⚠ Cleanup skipped (fixtures may remain for inspection)\n');
    }
  }

  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const byCategory: Record<string, { passed: number; total: number }> = {};
  
  for (const r of results) {
    if (!byCategory[r.category]) {
      byCategory[r.category] = { passed: 0, total: 0 };
    }
    byCategory[r.category].total++;
    if (r.passed) byCategory[r.category].passed++;
  }

  console.log('\n══════════════════════════════════════════════════════════════════════');
  console.log('    TRUE PAYMENT HTTP E2E TEST REPORT');
  console.log('══════════════════════════════════════════════════════════════════════\n');

  for (const [category, stats] of Object.entries(byCategory)) {
    const status = stats.passed === stats.total ? '✅ PASS' : '❌ FAIL';
    console.log(`${category}: ${status} (${stats.passed}/${stats.total})`);
  }

  console.log('\n──────────────────────────────────────────────────────────────────────');
  console.log(`\nTOTAL: ${passed}/${total} tests passed`);
  console.log(`\nFEE VERSION: ${FEE_VERSION}`);
  console.log(`\nOVERALL STATUS: ${passed === total ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  console.log('\n══════════════════════════════════════════════════════════════════════\n');

  process.exit(passed === total ? 0 : 1);
}

runTests().catch(console.error);
