/**
 * Parent-Paid Billing End-to-End Tests
 * 
 * Tests the complete parent-paid Technology & Service Fees model.
 * Run with: npx tsx tests/parent-paid-billing.test.ts
 */

import { 
  calculateTechnologyAndServiceFees, 
  getDualPricing,
  deriveMonthsCount,
  FEE_CONFIG,
  FEE_VERSION,
  type PaymentRail,
  type PaymentKind
} from '../shared/pricing';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function assert(condition: boolean, testName: string, message: string, details?: any) {
  results.push({
    name: testName,
    passed: condition,
    message: condition ? 'PASS' : `FAIL: ${message}`,
    details
  });
}

function assertApproxEqual(actual: number, expected: number, testName: string, tolerance = 0.01) {
  const diff = Math.abs(actual - expected);
  assert(
    diff <= tolerance,
    testName,
    `Expected ${expected}, got ${actual} (diff: ${diff})`,
    { actual, expected }
  );
}

// =========================================
// 1. PRICING ENGINE TESTS - RECURRING CONTRACTS
// =========================================

console.log('\n=== TESTING RECURRING CONTRACTS ===\n');

// Test: $100 × 1 month – Credit = 3% + $3 = $6
(() => {
  const result = calculateTechnologyAndServiceFees({
    baseAmount: 100,
    monthsCount: 1,
    paymentKind: 'recurring_contract',
    paymentRail: 'card_credit'
  });
  assertApproxEqual(result.techFee, 6.00, '$100 × 1mo Credit techFee');
  assertApproxEqual(result.totalAmount, 106.00, '$100 × 1mo Credit totalAmount');
  assert(result.paymentRail === 'card_credit', '$100 × 1mo Credit paymentRail', `Got ${result.paymentRail}`);
  assert(result.paymentKind === 'recurring_contract', '$100 × 1mo Credit paymentKind', `Got ${result.paymentKind}`);
  assert(result.monthsCount === 1, '$100 × 1mo Credit monthsCount', `Got ${result.monthsCount}`);
  assert(result.feeVersion === FEE_VERSION, '$100 × 1mo Credit feeVersion', `Got ${result.feeVersion}`);
})();

// Test: $300 × 3 months – Credit = 3% + $9 = $18
(() => {
  const result = calculateTechnologyAndServiceFees({
    baseAmount: 300,
    monthsCount: 3,
    paymentKind: 'recurring_contract',
    paymentRail: 'card_credit'
  });
  assertApproxEqual(result.techFee, 18.00, '$300 × 3mo Credit techFee');
  assertApproxEqual(result.percentFee, 9.00, '$300 × 3mo Credit percentFee');
  assertApproxEqual(result.flatFee, 9.00, '$300 × 3mo Credit flatFee');
  assertApproxEqual(result.totalAmount, 318.00, '$300 × 3mo Credit totalAmount');
})();

// Test: $900 × 9 months – Credit = 3% + $27 = $54
(() => {
  const result = calculateTechnologyAndServiceFees({
    baseAmount: 900,
    monthsCount: 9,
    paymentKind: 'recurring_contract',
    paymentRail: 'card_credit'
  });
  assertApproxEqual(result.techFee, 54.00, '$900 × 9mo Credit techFee');
  assertApproxEqual(result.percentFee, 27.00, '$900 × 9mo Credit percentFee');
  assertApproxEqual(result.flatFee, 27.00, '$900 × 9mo Credit flatFee');
  assertApproxEqual(result.totalAmount, 954.00, '$900 × 9mo Credit totalAmount');
})();

// Test: $100 × 1 month – Debit = $3 flat (NO PERCENTAGE)
(() => {
  const result = calculateTechnologyAndServiceFees({
    baseAmount: 100,
    monthsCount: 1,
    paymentKind: 'recurring_contract',
    paymentRail: 'card_debit'
  });
  assertApproxEqual(result.techFee, 3.00, '$100 × 1mo Debit techFee (flat only)');
  assertApproxEqual(result.percentFee, 0, '$100 × 1mo Debit percentFee (should be 0)');
  assertApproxEqual(result.flatFee, 3.00, '$100 × 1mo Debit flatFee');
  assertApproxEqual(result.totalAmount, 103.00, '$100 × 1mo Debit totalAmount');
  assert(result.displayBreakdown.discountMessage !== undefined, '$100 × 1mo Debit discount message', 'Should have discount message');
})();

// Test: $100 × 1 month – ACH = 1.5% + $3 = $4.50
(() => {
  const result = calculateTechnologyAndServiceFees({
    baseAmount: 100,
    monthsCount: 1,
    paymentKind: 'recurring_contract',
    paymentRail: 'ach'
  });
  assertApproxEqual(result.techFee, 4.50, '$100 × 1mo ACH techFee');
  assertApproxEqual(result.percentFee, 1.50, '$100 × 1mo ACH percentFee');
  assertApproxEqual(result.flatFee, 3.00, '$100 × 1mo ACH flatFee');
  assertApproxEqual(result.totalAmount, 104.50, '$100 × 1mo ACH totalAmount');
})();

// =========================================
// 2. PRICING ENGINE TESTS - ONE-TIME EVENTS
// =========================================

console.log('\n=== TESTING ONE-TIME EVENTS ===\n');

// Test: $50 – Credit = 3% + $1 = $2.50
(() => {
  const result = calculateTechnologyAndServiceFees({
    baseAmount: 50,
    monthsCount: 1,
    paymentKind: 'one_time_event',
    paymentRail: 'card_credit'
  });
  assertApproxEqual(result.techFee, 2.50, '$50 Event Credit techFee');
  assertApproxEqual(result.percentFee, 1.50, '$50 Event Credit percentFee');
  assertApproxEqual(result.flatFee, 1.00, '$50 Event Credit flatFee');
  assertApproxEqual(result.totalAmount, 52.50, '$50 Event Credit totalAmount');
})();

// Test: $50 – Debit = $1 flat
(() => {
  const result = calculateTechnologyAndServiceFees({
    baseAmount: 50,
    monthsCount: 1,
    paymentKind: 'one_time_event',
    paymentRail: 'card_debit'
  });
  assertApproxEqual(result.techFee, 1.00, '$50 Event Debit techFee (flat only)');
  assertApproxEqual(result.percentFee, 0, '$50 Event Debit percentFee (should be 0)');
  assertApproxEqual(result.flatFee, 1.00, '$50 Event Debit flatFee');
  assertApproxEqual(result.totalAmount, 51.00, '$50 Event Debit totalAmount');
})();

// Test: $50 – ACH = 1.5% + $1 = $1.75
(() => {
  const result = calculateTechnologyAndServiceFees({
    baseAmount: 50,
    monthsCount: 1,
    paymentKind: 'one_time_event',
    paymentRail: 'ach'
  });
  assertApproxEqual(result.techFee, 1.75, '$50 Event ACH techFee');
  assertApproxEqual(result.percentFee, 0.75, '$50 Event ACH percentFee');
  assertApproxEqual(result.flatFee, 1.00, '$50 Event ACH flatFee');
  assertApproxEqual(result.totalAmount, 51.75, '$50 Event ACH totalAmount');
})();

// =========================================
// 3. DEBIT COMPLIANCE TESTS
// =========================================

console.log('\n=== TESTING DEBIT COMPLIANCE ===\n');

// Verify debit cards NEVER have percentage fees
(() => {
  const testCases: Array<{baseAmount: number, monthsCount: number, paymentKind: PaymentKind}> = [
    { baseAmount: 100, monthsCount: 1, paymentKind: 'recurring_contract' },
    { baseAmount: 500, monthsCount: 3, paymentKind: 'recurring_contract' },
    { baseAmount: 1000, monthsCount: 9, paymentKind: 'recurring_contract' },
    { baseAmount: 25, monthsCount: 1, paymentKind: 'one_time_event' },
    { baseAmount: 100, monthsCount: 1, paymentKind: 'one_time_event' },
    { baseAmount: 500, monthsCount: 1, paymentKind: 'one_time_event' },
  ];
  
  for (const tc of testCases) {
    const result = calculateTechnologyAndServiceFees({
      ...tc,
      paymentRail: 'card_debit'
    });
    assert(
      result.percentFee === 0,
      `Debit compliance: $${tc.baseAmount} ${tc.paymentKind}`,
      `Debit percentFee should be 0, got ${result.percentFee}`,
      { result }
    );
    assert(
      result.displayBreakdown.percentApplied === 0,
      `Debit displayBreakdown: $${tc.baseAmount} ${tc.paymentKind}`,
      `Debit displayBreakdown.percentApplied should be 0, got ${result.displayBreakdown.percentApplied}`,
      { result }
    );
  }
})();

// =========================================
// 4. ACH DISCOUNT LOGIC TESTS
// =========================================

console.log('\n=== TESTING ACH DISCOUNT LOGIC ===\n');

// Verify ACH always costs less than credit card
(() => {
  const testCases: Array<{baseAmount: number, monthsCount: number, paymentKind: PaymentKind}> = [
    { baseAmount: 100, monthsCount: 1, paymentKind: 'recurring_contract' },
    { baseAmount: 300, monthsCount: 3, paymentKind: 'recurring_contract' },
    { baseAmount: 50, monthsCount: 1, paymentKind: 'one_time_event' },
    { baseAmount: 200, monthsCount: 1, paymentKind: 'one_time_event' },
  ];
  
  for (const tc of testCases) {
    const credit = calculateTechnologyAndServiceFees({ ...tc, paymentRail: 'card_credit' });
    const ach = calculateTechnologyAndServiceFees({ ...tc, paymentRail: 'ach' });
    
    assert(
      ach.totalAmount < credit.totalAmount,
      `ACH cheaper than credit: $${tc.baseAmount} ${tc.paymentKind}`,
      `ACH (${ach.totalAmount}) should be less than credit (${credit.totalAmount})`,
      { credit: credit.totalAmount, ach: ach.totalAmount }
    );
    
    assert(
      ach.techFee < credit.techFee,
      `ACH techFee lower: $${tc.baseAmount} ${tc.paymentKind}`,
      `ACH techFee (${ach.techFee}) should be less than credit techFee (${credit.techFee})`,
      { creditFee: credit.techFee, achFee: ach.techFee }
    );
  }
})();

// =========================================
// 5. DUAL PRICING FUNCTION TESTS
// =========================================

console.log('\n=== TESTING DUAL PRICING ===\n');

(() => {
  const dual = getDualPricing(100, 1, 'recurring_contract');
  
  assertApproxEqual(dual.card.techFee, 6.00, 'getDualPricing card techFee');
  assertApproxEqual(dual.ach.techFee, 4.50, 'getDualPricing ACH techFee');
  assertApproxEqual(dual.savings, 1.50, 'getDualPricing savings');
  
  assert(dual.card.paymentRail === 'card_credit', 'getDualPricing card rail is credit', `Got ${dual.card.paymentRail}`);
  assert(dual.ach.paymentRail === 'ach', 'getDualPricing ACH rail is ach', `Got ${dual.ach.paymentRail}`);
})();

// =========================================
// 6. MONTHS COUNT DERIVATION TESTS
// =========================================

console.log('\n=== TESTING MONTHS COUNT DERIVATION ===\n');

(() => {
  assert(deriveMonthsCount('monthly') === 1, 'deriveMonthsCount monthly', `Got ${deriveMonthsCount('monthly')}`);
  assert(deriveMonthsCount('quarterly') === 3, 'deriveMonthsCount quarterly', `Got ${deriveMonthsCount('quarterly')}`);
  assert(deriveMonthsCount('paid_in_full') === 9, 'deriveMonthsCount paid_in_full default', `Got ${deriveMonthsCount('paid_in_full')}`);
  assert(deriveMonthsCount('paid_in_full', 12) === 12, 'deriveMonthsCount paid_in_full custom', `Got ${deriveMonthsCount('paid_in_full', 12)}`);
  assert(deriveMonthsCount('one_time') === 1, 'deriveMonthsCount one_time', `Got ${deriveMonthsCount('one_time')}`);
})();

// =========================================
// 7. FEE CONFIG CONSTANTS TESTS
// =========================================

console.log('\n=== TESTING FEE CONFIG ===\n');

(() => {
  assert(FEE_CONFIG.CARD_CREDIT_PERCENT === 0.03, 'Credit percent is 3%', `Got ${FEE_CONFIG.CARD_CREDIT_PERCENT}`);
  assert(FEE_CONFIG.CARD_DEBIT_PERCENT === 0, 'Debit percent is 0%', `Got ${FEE_CONFIG.CARD_DEBIT_PERCENT}`);
  assert(FEE_CONFIG.ACH_PERCENT === 0.015, 'ACH percent is 1.5%', `Got ${FEE_CONFIG.ACH_PERCENT}`);
  assert(FEE_CONFIG.RECURRING_FLAT_PER_MONTH === 3.00, 'Recurring flat is $3/mo', `Got ${FEE_CONFIG.RECURRING_FLAT_PER_MONTH}`);
  assert(FEE_CONFIG.ONE_TIME_FLAT === 1.00, 'One-time flat is $1', `Got ${FEE_CONFIG.ONE_TIME_FLAT}`);
})();

// =========================================
// 8. FEE VERSION TESTS
// =========================================

console.log('\n=== TESTING FEE VERSION ===\n');

(() => {
  assert(FEE_VERSION.startsWith('v1_2026'), 'Fee version format', `Got ${FEE_VERSION}`);
  assert(FEE_VERSION.includes('parent_paid'), 'Fee version includes parent_paid', `Got ${FEE_VERSION}`);
  
  // Verify every calculation returns the correct version
  const result = calculateTechnologyAndServiceFees({
    baseAmount: 100,
    monthsCount: 1,
    paymentKind: 'recurring_contract',
    paymentRail: 'card_credit'
  });
  assert(result.feeVersion === FEE_VERSION, 'Calculation returns feeVersion', `Got ${result.feeVersion}`);
})();

// =========================================
// 9. TERMINOLOGY COMPLIANCE TESTS
// =========================================

console.log('\n=== TESTING TERMINOLOGY ===\n');

(() => {
  const result = calculateTechnologyAndServiceFees({
    baseAmount: 100,
    monthsCount: 1,
    paymentKind: 'recurring_contract',
    paymentRail: 'card_credit'
  });
  
  assert(
    result.displayBreakdown.label === 'Technology and Service Fees',
    'Label uses correct terminology',
    `Got: ${result.displayBreakdown.label}`
  );
  
  assert(
    !result.displayBreakdown.label.toLowerCase().includes('convenience'),
    'Label does not say convenience fee',
    `Got: ${result.displayBreakdown.label}`
  );
  
  assert(
    !result.displayBreakdown.label.toLowerCase().includes('surcharge'),
    'Label does not say surcharge',
    `Got: ${result.displayBreakdown.label}`
  );
})();

// =========================================
// 10. EDGE CASE TESTS
// =========================================

console.log('\n=== TESTING EDGE CASES ===\n');

// Zero amount
(() => {
  const result = calculateTechnologyAndServiceFees({
    baseAmount: 0,
    monthsCount: 1,
    paymentKind: 'recurring_contract',
    paymentRail: 'card_credit'
  });
  assertApproxEqual(result.techFee, 3.00, 'Zero base amount still has flat fee');
  assertApproxEqual(result.percentFee, 0, 'Zero base amount has no percent fee');
})();

// Very small amount
(() => {
  const result = calculateTechnologyAndServiceFees({
    baseAmount: 1,
    monthsCount: 1,
    paymentKind: 'recurring_contract',
    paymentRail: 'card_credit'
  });
  assertApproxEqual(result.techFee, 3.03, '$1 base amount credit fee');
})();

// Large amount
(() => {
  const result = calculateTechnologyAndServiceFees({
    baseAmount: 10000,
    monthsCount: 12,
    paymentKind: 'recurring_contract',
    paymentRail: 'card_credit'
  });
  assertApproxEqual(result.techFee, 336.00, 'Large amount: 3% of 10000 + 12*$3');
})();

// =========================================
// GENERATE FINAL REPORT
// =========================================

console.log('\n\n');
console.log('═'.repeat(60));
console.log('    PARENT-PAID BILLING E2E TEST REPORT');
console.log('═'.repeat(60));
console.log();

const passed = results.filter(r => r.passed);
const failed = results.filter(r => !r.passed);

const categories = {
  'Pricing Engine (Recurring)': results.filter(r => r.name.includes('×') && r.name.includes('mo')),
  'Pricing Engine (Events)': results.filter(r => r.name.includes('Event')),
  'Debit Compliance': results.filter(r => r.name.includes('Debit compliance') || r.name.includes('Debit displayBreakdown')),
  'ACH Discount Logic': results.filter(r => r.name.includes('ACH cheaper') || r.name.includes('ACH techFee')),
  'Dual Pricing': results.filter(r => r.name.includes('getDualPricing')),
  'Months Derivation': results.filter(r => r.name.includes('deriveMonthsCount')),
  'Fee Config': results.filter(r => r.name.includes('percent') || r.name.includes('flat')),
  'Fee Version': results.filter(r => r.name.includes('version') || r.name.includes('feeVersion')),
  'Terminology': results.filter(r => r.name.includes('Label') || r.name.includes('terminology')),
  'Edge Cases': results.filter(r => r.name.includes('base amount') || r.name.includes('Large')),
};

for (const [category, tests] of Object.entries(categories)) {
  const catPassed = tests.filter(t => t.passed).length;
  const catTotal = tests.length;
  const status = catPassed === catTotal ? '✅ PASS' : '❌ FAIL';
  console.log(`${category}: ${status} (${catPassed}/${catTotal})`);
}

console.log();
console.log('─'.repeat(60));
console.log();

if (failed.length > 0) {
  console.log('FAILED TESTS:');
  console.log();
  for (const f of failed) {
    console.log(`  ❌ ${f.name}`);
    console.log(`     ${f.message}`);
    if (f.details) {
      console.log(`     Details: ${JSON.stringify(f.details)}`);
    }
    console.log();
  }
}

console.log('─'.repeat(60));
console.log();
console.log(`TOTAL: ${passed.length}/${results.length} tests passed`);
console.log();

const allPassed = failed.length === 0;
console.log(`OVERALL STATUS: ${allPassed ? '✅ READY FOR PRODUCTION' : '❌ NEEDS FIXES'}`);
console.log();
console.log('═'.repeat(60));

// Exit with appropriate code
process.exit(allPassed ? 0 : 1);
