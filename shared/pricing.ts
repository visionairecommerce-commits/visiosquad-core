/**
 * VisioSquad Technology and Service Fees Pricing Engine
 * 
 * ZERO-LOSS FEE SCHEDULE - Parents pay Technology & Service Fees at checkout.
 * Uses a STANDARD fee with DISCOUNTS for ACH and Debit payments.
 * 
 * @version v2_2026_02_zero_loss_discounts
 */

export const FEE_VERSION = 'v2_2026_02_zero_loss_discounts';

export const FEE_CONFIG = {
  STANDARD_PERCENT: 0.0375,
  ACH_DISCOUNT_PERCENT: 0.0200,
  RECURRING_FLAT_PER_MONTH: 3.50,
  ONE_TIME_FLAT: 1.50,
  ACH_DISCOUNT_FLAT: 0.50,
  RECURRING_MIN_PER_MONTH: 3.00,
  ONE_TIME_MIN: 1.00,
} as const;

export type PaymentRail = 'card_credit' | 'card_debit' | 'ach';
export type PaymentKind = 'recurring_contract' | 'one_time_event';

export interface PricingInput {
  baseAmount: number;
  monthsCount: number;
  paymentKind: PaymentKind;
  paymentRail: PaymentRail;
}

export interface PricingResult {
  baseAmount: number;
  techFee: number;
  totalAmount: number;
  standardFee: number;
  discountAmount: number;
  paymentRail: PaymentRail;
  paymentKind: PaymentKind;
  monthsCount: number;
  feeVersion: string;
  displayBreakdown: {
    label: string;
    standardFee: number;
    discountLabel?: string;
    discountAmount?: number;
    totalFee: number;
  };
}

function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Calculate Technology and Service Fees for checkout
 * 
 * ZERO-LOSS PRICING MODEL:
 * Apply a STANDARD fee first, then apply discounts by payment rail.
 * 
 * A) Recurring contracts (monthsCount >= 1):
 *    STANDARD = (baseAmount * 0.0375) + (monthsCount * 3.50)
 *    
 *    Discounts:
 *    - ACH: subtract (baseAmount * 0.0200) + 0.50
 *      => effective = (baseAmount * 0.0175) + (monthsCount * 3.50) - 0.50
 *      (min: $3.00 * monthsCount)
 *    - Debit: subtract (baseAmount * 0.0375)
 *      => effective = (monthsCount * 3.50) (flat only)
 * 
 * B) One-time events:
 *    STANDARD = (baseAmount * 0.0375) + 1.50
 *    
 *    Discounts:
 *    - ACH: subtract (baseAmount * 0.0200) + 0.50
 *      => effective = (baseAmount * 0.0175) + 1.00
 *      (min: $1.00)
 *    - Debit: subtract (baseAmount * 0.0375)
 *      => effective = 1.50 (flat only)
 * 
 * @param input - Pricing calculation input
 * @returns PricingResult with all fee details
 */
export function calculateTechnologyAndServiceFees(input: PricingInput): PricingResult {
  const { baseAmount, monthsCount, paymentKind, paymentRail } = input;
  
  const isRecurring = paymentKind === 'recurring_contract';
  const flatFee = isRecurring 
    ? FEE_CONFIG.RECURRING_FLAT_PER_MONTH * monthsCount 
    : FEE_CONFIG.ONE_TIME_FLAT;
  
  const standardFee = roundToCents((baseAmount * FEE_CONFIG.STANDARD_PERCENT) + flatFee);
  
  let discountAmount = 0;
  let discountLabel: string | undefined;
  let techFee: number;
  let minFee: number;
  
  if (paymentRail === 'card_debit') {
    discountAmount = roundToCents(baseAmount * FEE_CONFIG.STANDARD_PERCENT);
    discountLabel = 'Debit Discount';
    techFee = flatFee;
  } else if (paymentRail === 'ach') {
    const achDiscountAmount = (baseAmount * FEE_CONFIG.ACH_DISCOUNT_PERCENT) + FEE_CONFIG.ACH_DISCOUNT_FLAT;
    discountAmount = roundToCents(achDiscountAmount);
    discountLabel = 'ACH Discount';
    techFee = roundToCents(standardFee - discountAmount);
    
    minFee = isRecurring 
      ? FEE_CONFIG.RECURRING_MIN_PER_MONTH * monthsCount 
      : FEE_CONFIG.ONE_TIME_MIN;
    
    if (techFee < minFee) {
      discountAmount = roundToCents(standardFee - minFee);
      techFee = minFee;
    }
  } else {
    techFee = standardFee;
  }
  
  techFee = roundToCents(techFee);
  const totalAmount = roundToCents(baseAmount + techFee);
  
  return {
    baseAmount,
    techFee,
    totalAmount,
    standardFee,
    discountAmount,
    paymentRail,
    paymentKind,
    monthsCount,
    feeVersion: FEE_VERSION,
    displayBreakdown: {
      label: 'Technology and Service Fees',
      standardFee,
      discountLabel: discountAmount > 0 ? discountLabel : undefined,
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
      totalFee: techFee,
    },
  };
}

/**
 * Get pricing for all three payment methods to show at checkout
 * 
 * @param baseAmount - Base amount the club is charging
 * @param monthsCount - Number of months (1 for one-time, or derived from pay schedule)
 * @param paymentKind - 'recurring_contract' or 'one_time_event'
 * @returns Object with standard (credit), debit, and ACH pricing for display
 */
export function getTriplePricing(
  baseAmount: number, 
  monthsCount: number, 
  paymentKind: PaymentKind
): {
  standard: PricingResult;
  debit: PricingResult;
  ach: PricingResult;
  debitSavings: number;
  achSavings: number;
} {
  const standard = calculateTechnologyAndServiceFees({
    baseAmount,
    monthsCount,
    paymentKind,
    paymentRail: 'card_credit',
  });
  
  const debit = calculateTechnologyAndServiceFees({
    baseAmount,
    monthsCount,
    paymentKind,
    paymentRail: 'card_debit',
  });
  
  const ach = calculateTechnologyAndServiceFees({
    baseAmount,
    monthsCount,
    paymentKind,
    paymentRail: 'ach',
  });
  
  const debitSavings = roundToCents(standard.totalAmount - debit.totalAmount);
  const achSavings = roundToCents(standard.totalAmount - ach.totalAmount);
  
  return { standard, debit, ach, debitSavings, achSavings };
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use getTriplePricing instead
 */
export function getDualPricing(
  baseAmount: number, 
  monthsCount: number, 
  paymentKind: PaymentKind
): {
  card: PricingResult;
  ach: PricingResult;
  savings: number;
} {
  const triple = getTriplePricing(baseAmount, monthsCount, paymentKind);
  return {
    card: triple.standard,
    ach: triple.ach,
    savings: triple.achSavings,
  };
}

/**
 * Derive monthsCount from payment schedule option
 * 
 * @param paymentPlan - 'monthly' | 'quarterly' | 'paid_in_full'
 * @param seasonMonths - Number of months in the season (default 9)
 * @returns monthsCount for fee calculation
 */
export function deriveMonthsCount(
  paymentPlan: 'monthly' | 'quarterly' | 'paid_in_full' | 'one_time',
  seasonMonths: number = 9
): number {
  switch (paymentPlan) {
    case 'monthly':
      return 1;
    case 'quarterly':
      return 3;
    case 'paid_in_full':
      return seasonMonths;
    case 'one_time':
      return 1;
    default:
      return 1;
  }
}

/**
 * Format fee description for display
 */
export function formatFeeDescription(rail: PaymentRail, kind: PaymentKind): string {
  const isRecurring = kind === 'recurring_contract';
  const flatFee = isRecurring ? FEE_CONFIG.RECURRING_FLAT_PER_MONTH : FEE_CONFIG.ONE_TIME_FLAT;
  
  switch (rail) {
    case 'card_credit':
      return isRecurring ? `3.75% + $${flatFee.toFixed(2)}/month` : `3.75% + $${flatFee.toFixed(2)}`;
    case 'card_debit':
      return isRecurring ? `$${flatFee.toFixed(2)}/month (no %)` : `$${flatFee.toFixed(2)} flat`;
    case 'ach':
      return isRecurring ? `1.75% + $${(flatFee - 0.50).toFixed(2)}/month` : `1.75% + $${(flatFee - 0.50).toFixed(2)}`;
  }
}
