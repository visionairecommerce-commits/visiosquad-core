/**
 * Zero-Loss Fee Schedule End-to-End Tests
 * 
 * Tests the parent-paid Technology & Service Fees with zero-loss discounts.
 * Run with: npx tsx tests/parent-paid-billing.test.ts
 */

import { 
  calculateTechnologyAndServiceFees, 
  getTriplePricing,
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
// ZERO-LOSS FEE SCHEDULE:
// A) Recurring: STANDARD = (base * 0.0375) + (months * 3.50)
//    - ACH Discount: subtract (base * 0.0200) + 0.50 (min: 3.00 * months)
//    - Debit Discount: subtract (base * 0.0375) => flat only (months * 3.50)
//
// B) One-time: STANDARD = (base * 0.0375) + 1.50
//    - ACH Discount: subtract (base * 0.0200) + 0.50 (min: 1.00)
//    - Debit Discount: subtract (base * 0.0375) => 1.50 flat
// =========================================

console.log('\n=== TESTING RECURRING CONTRACTS ===\n');

// Test: $50 × 1 month – Credit = (50 * 0.0375) + 3.50 = 1.875 + 3.50 = 5.38
(() => {
  const result = calculateTechnologyAndServiceFees({
    baseAmount: 50,
    monthsCount: 1,
    paymentKind: 'recurring_contract',
    paymentRail: 'card_credit'
  });
  assertApproxEqual(result.techFee, 5.38, '$50 × 1mo Credit techFee');
  assertApproxEqual(result.standardFee, 5.38, '$50 × 1mo Credit standardFee');
  assertApproxEqual(result.discountAmount, 0, '$50 × 1mo Credit discountAmount');
  assertApproxEqual(result.totalAmount, 55.38, '$50 × 1mo Credit totalAmount');
  assert(result.paymentRail === 'card_credit', '$50 × 1mo Credit paymentRail', `Got ${result.paymentRail}`);
  assert(result.feeVersion === FEE_VERSION, '$50 × 1mo Credit feeVersion', `Got ${result.feeVersion}`);
})();

// Test: $50 × 1 month – Debit = 3.50 (flat only)
(() => {
  const result = calculateTechnologyAndServiceFees({
    baseAmount: 50,
    monthsCount: 1,
    paymentKind: 'recurring_contract',
    paymentRail: 'card_debit'
  });
  assertApproxEqual(result.techFee, 3.50, '$50 × 1mo Debit techFee (flat only)');
  assertApproxEqual(result.standardFee, 5.38, '$50 × 1mo Debit standardFee');
  assertApproxEqual(result.discountAmount, 1.88, '$50 × 1mo Debit discountAmount');
  assertApproxEqual(result.totalAmount, 53.50, '$50 × 1mo Debit totalAmount');
  assert(result.displayBreakdown.discountLabel === 'Debit Discount', '$50 × 1mo Debit discount label', `Got ${result.displayBreakdown.discountLabel}`);
})();

// Test: $50 × 1 month – ACH = 5.38 - (50*0.02 + 0.5) = 5.38 - 1.50 = 3.88
(() => {
  const result = calculateTechnologyAndServiceFees({
    baseAmount: 50,
    monthsCount: 1,
    paymentKind: 'recurring_contract',
    paymentRail: 'ach'
  });
  assertApproxEqual(result.techFee, 3.88, '$50 × 1mo ACH techFee');
  assertApproxEqual(result.discountAmount, 1.50, '$50 × 1mo ACH discountAmount');
  assertApproxEqual(result.totalAmount, 53.88, '$50 × 1mo ACH totalAmount');
  assert(result.displayBreakdown.discountLabel === 'ACH Discount', '$50 × 1mo ACH discount label', `Got ${result.displayBreakdown.discountLabel}`);
})();

// Test: $900 × 9 months – Credit = (900 * 0.0375) + 31.50 = 33.75 + 31.50 = 65.25
(() => {
  const result = calculateTechnologyAndServiceFees({
    baseAmount: 900,
    monthsCount: 9,
    paymentKind: 'recurring_contract',
    paymentRail: 'card_credit'
  });
  assertApproxEqual(result.techFee, 65.25, '$900 × 9mo Credit techFee');
  assertApproxEqual(result.standardFee, 65.25, '$900 × 9mo Credit standardFee');
  assertApproxEqual(result.totalAmount, 965.25, '$900 × 9mo Credit totalAmount');
})();

// Test: $900 × 9 months – Debit = 31.50 (flat only)
(() => {
  const result = calculateTechnologyAndServiceFees({
    baseAmount: 900,
    monthsCount: 9,
    paymentKind: 'recurring_contract',
    paymentRail: 'card_debit'
  });
  assertApproxEqual(result.techFee, 31.50, '$900 × 9mo Debit techFee (flat only)');
  assertApproxEqual(result.discountAmount, 33.75, '$900 × 9mo Debit discountAmount');
  assertApproxEqual(result.totalAmount, 931.50, '$900 × 9mo Debit totalAmount');
})();

// Test: $900 × 9 months – ACH = 65.25 - (18 + 0.5) = 65.25 - 18.50 = 46.75
// Min = 3.00 * 9 = 27.00, so 46.75 is used (above min)
(() => {
  const result = calculateTechnologyAndServiceFees({
    baseAmount: 900,
    monthsCount: 9,
    paymentKind: 'recurring_contract',
    paymentRail: 'ach'
  });
  assertApproxEqual(result.techFee, 46.75, '$900 × 9mo ACH techFee');
  assertApproxEqual(result.discountAmount, 18.50, '$900 × 9mo ACH discountAmount');
  assertApproxEqual(result.totalAmount, 946.75, '$900 × 9mo ACH totalAmount');
})();

// =========================================
// ONE-TIME EVENTS
// =========================================

console.log('\n=== TESTING ONE-TIME EVENTS ===\n');

// Test: $50 – Credit = (50 * 0.0375) + 1.50 = 1.875 + 1.50 = 3.38
(() => {
  const result = calculateTechnologyAndServiceFees({
    baseAmount: 50,
    monthsCount: 1,
    paymentKind: 'one_time_event',
    paymentRail: 'card_credit'
  });
  assertApproxEqual(result.techFee, 3.38, '$50 Event Credit techFee');
  assertApproxEqual(result.standardFee, 3.38, '$50 Event Credit standardFee');
  assertApproxEqual(result.totalAmount, 53.38, '$50 Event Credit totalAmount');
})();

// Test: $50 – Debit = 1.50 flat
(() => {
  const result = calculateTechnologyAndServiceFees({
    baseAmount: 50,
    monthsCount: 1,
    paymentKind: 'one_time_event',
    paymentRail: 'card_debit'
  });
  assertApproxEqual(result.techFee, 1.50, '$50 Event Debit techFee (flat only)');
  assertApproxEqual(result.discountAmount, 1.88, '$50 Event Debit discountAmount');
  assertApproxEqual(result.totalAmount, 51.50, '$50 Event Debit totalAmount');
})();

// Test: $50 – ACH = 3.38 - (1.0 + 0.5) = 3.38 - 1.50 = 1.88
// Min = 1.00, so 1.88 is used (above min)
(() => {
  const result = calculateTechnologyAndServiceFees({
    baseAmount: 50,
    monthsCount: 1,
    paymentKind: 'one_time_event',
    paymentRail: 'ach'
  });
  assertApproxEqual(result.techFee, 1.88, '$50 Event ACH techFee');
  assertApproxEqual(result.discountAmount, 1.50, '$50 Event ACH discountAmount');
  assertApproxEqual(result.totalAmount, 51.88, '$50 Event ACH totalAmount');
})();

// =========================================
// DEBIT COMPLIANCE TESTS - NO PERCENTAGE
// =========================================

console.log('\n=== TESTING DEBIT COMPLIANCE ===\n');

// Verify debit cards NEVER have percentage fees (debit fee = flat only)
(() => {
  const testCases: Array<{baseAmount: number, monthsCount: number, paymentKind: PaymentKind, expectedFlat: number}> = [
    { baseAmount: 100, monthsCount: 1, paymentKind: 'recurring_contract', expectedFlat: 3.50 },
    { baseAmount: 500, monthsCount: 3, paymentKind: 'recurring_contract', expectedFlat: 10.50 },
    { baseAmount: 1000, monthsCount: 9, paymentKind: 'recurring_contract', expectedFlat: 31.50 },
    { baseAmount: 25, monthsCount: 1, paymentKind: 'one_time_event', expectedFlat: 1.50 },
    { baseAmount: 100, monthsCount: 1, paymentKind: 'one_time_event', expectedFlat: 1.50 },
    { baseAmount: 500, monthsCount: 1, paymentKind: 'one_time_event', expectedFlat: 1.50 },
  ];
  
  for (const tc of testCases) {
    const result = calculateTechnologyAndServiceFees({
      ...tc,
      paymentRail: 'card_debit'
    });
    assertApproxEqual(
      result.techFee,
      tc.expectedFlat,
      `Debit flat-only: $${tc.baseAmount} ${tc.paymentKind} = $${tc.expectedFlat}`
    );
    assert(
      result.displayBreakdown.discountLabel === 'Debit Discount',
      `Debit has discount label: $${tc.baseAmount}`,
      `Got ${result.displayBreakdown.discountLabel}`
    );
  }
})();

// =========================================
// ACH MINIMUM FEE TESTS
// =========================================

console.log('\n=== TESTING ACH MINIMUM FEES ===\n');

// Test ACH minimum for recurring (min = 3.00 * monthsCount)
(() => {
  // Small base amount where discount would go below minimum
  // base=10, standard = 0.375 + 3.50 = 3.88
  // discount = 0.20 + 0.50 = 0.70
  // result = 3.88 - 0.70 = 3.18 (above min 3.00)
  const result = calculateTechnologyAndServiceFees({
    baseAmount: 10,
    monthsCount: 1,
    paymentKind: 'recurring_contract',
    paymentRail: 'ach'
  });
  assert(result.techFee >= 3.00, 'ACH min recurring 1mo', `Got ${result.techFee}`);
})();

// Test ACH minimum for one-time (min = 1.00)
(() => {
  // Very small base amount
  // base=5, standard = 0.19 + 1.50 = 1.69
  // discount = 0.10 + 0.50 = 0.60
  // result = 1.69 - 0.60 = 1.09 (above min 1.00)
  const result = calculateTechnologyAndServiceFees({
    baseAmount: 5,
    monthsCount: 1,
    paymentKind: 'one_time_event',
    paymentRail: 'ach'
  });
  assert(result.techFee >= 1.00, 'ACH min one-time', `Got ${result.techFee}`);
})();

// =========================================
// TRIPLE PRICING FUNCTION TESTS
// =========================================

console.log('\n=== TESTING TRIPLE PRICING ===\n');

(() => {
  const triple = getTriplePricing(100, 1, 'recurring_contract');
  
  // Standard: (100 * 0.0375) + 3.50 = 3.75 + 3.50 = 7.25
  assertApproxEqual(triple.standard.techFee, 7.25, 'getTriplePricing standard techFee');
  
  // Debit: 3.50 flat
  assertApproxEqual(triple.debit.techFee, 3.50, 'getTriplePricing debit techFee');
  
  // ACH: 7.25 - (2.00 + 0.50) = 7.25 - 2.50 = 4.75
  assertApproxEqual(triple.ach.techFee, 4.75, 'getTriplePricing ACH techFee');
  
  // Savings
  assertApproxEqual(triple.debitSavings, 3.75, 'getTriplePricing debitSavings');
  assertApproxEqual(triple.achSavings, 2.50, 'getTriplePricing achSavings');
  
  assert(triple.standard.paymentRail === 'card_credit', 'getTriplePricing standard rail', `Got ${triple.standard.paymentRail}`);
  assert(triple.debit.paymentRail === 'card_debit', 'getTriplePricing debit rail', `Got ${triple.debit.paymentRail}`);
  assert(triple.ach.paymentRail === 'ach', 'getTriplePricing ACH rail', `Got ${triple.ach.paymentRail}`);
})();

// =========================================
// MONTHS COUNT DERIVATION TESTS
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
// FEE CONFIG CONSTANTS TESTS
// =========================================

console.log('\n=== TESTING FEE CONFIG ===\n');

(() => {
  assert(FEE_CONFIG.STANDARD_PERCENT === 0.0375, 'Standard percent is 3.75%', `Got ${FEE_CONFIG.STANDARD_PERCENT}`);
  assert(FEE_CONFIG.ACH_DISCOUNT_PERCENT === 0.0200, 'ACH discount percent is 2%', `Got ${FEE_CONFIG.ACH_DISCOUNT_PERCENT}`);
  assert(FEE_CONFIG.RECURRING_FLAT_PER_MONTH === 3.50, 'Recurring flat is $3.50/mo', `Got ${FEE_CONFIG.RECURRING_FLAT_PER_MONTH}`);
  assert(FEE_CONFIG.ONE_TIME_FLAT === 1.50, 'One-time flat is $1.50', `Got ${FEE_CONFIG.ONE_TIME_FLAT}`);
  assert(FEE_CONFIG.ACH_DISCOUNT_FLAT === 0.50, 'ACH discount flat is $0.50', `Got ${FEE_CONFIG.ACH_DISCOUNT_FLAT}`);
  assert(FEE_CONFIG.RECURRING_MIN_PER_MONTH === 3.00, 'Recurring min is $3.00/mo', `Got ${FEE_CONFIG.RECURRING_MIN_PER_MONTH}`);
  assert(FEE_CONFIG.ONE_TIME_MIN === 1.00, 'One-time min is $1.00', `Got ${FEE_CONFIG.ONE_TIME_MIN}`);
})();

// =========================================
// FEE VERSION TESTS
// =========================================

console.log('\n=== TESTING FEE VERSION ===\n');

(() => {
  assert(FEE_VERSION === 'v2_2026_02_zero_loss_discounts', 'Fee version is v2', `Got ${FEE_VERSION}`);
  assert(FEE_VERSION.includes('zero_loss'), 'Fee version includes zero_loss', `Got ${FEE_VERSION}`);
  
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
// TERMINOLOGY COMPLIANCE TESTS
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
  
  assert(
    !result.displayBreakdown.label.toLowerCase().includes('processing'),
    'Label does not say processing',
    `Got: ${result.displayBreakdown.label}`
  );
})();

// =========================================
// EDGE CASE TESTS
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
  assertApproxEqual(result.techFee, 3.50, 'Zero base amount still has flat fee');
})();

// Very small amount
(() => {
  const result = calculateTechnologyAndServiceFees({
    baseAmount: 1,
    monthsCount: 1,
    paymentKind: 'recurring_contract',
    paymentRail: 'card_credit'
  });
  assertApproxEqual(result.techFee, 3.54, '$1 base amount credit fee'); // 0.0375 + 3.50 = 3.54
})();

// Large amount
(() => {
  const result = calculateTechnologyAndServiceFees({
    baseAmount: 10000,
    monthsCount: 12,
    paymentKind: 'recurring_contract',
    paymentRail: 'card_credit'
  });
  // (10000 * 0.0375) + (12 * 3.50) = 375 + 42 = 417
  assertApproxEqual(result.techFee, 417.00, 'Large amount: 3.75% of 10000 + 12*$3.50');
})();

// =========================================
// GENERATE FINAL REPORT
// =========================================

console.log('\n\n');
console.log('═'.repeat(60));
console.log('    ZERO-LOSS FEE SCHEDULE E2E TEST REPORT');
console.log('═'.repeat(60));
console.log();

const passed = results.filter(r => r.passed);
const failed = results.filter(r => !r.passed);

const categories = {
  'Recurring Contracts': results.filter(r => r.name.includes('×') && r.name.includes('mo')),
  'One-Time Events': results.filter(r => r.name.includes('Event')),
  'Debit Compliance': results.filter(r => r.name.includes('Debit')),
  'ACH Minimums': results.filter(r => r.name.includes('ACH min')),
  'Triple Pricing': results.filter(r => r.name.includes('getTriplePricing')),
  'Months Derivation': results.filter(r => r.name.includes('deriveMonthsCount')),
  'Fee Config': results.filter(r => r.name.includes('percent') || r.name.includes('flat') || r.name.includes('min')),
  'Fee Version': results.filter(r => r.name.includes('version') || r.name.includes('feeVersion') || r.name.includes('zero_loss')),
  'Terminology': results.filter(r => r.name.includes('Label') || r.name.includes('terminology') || r.name.includes('processing')),
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
