/**
 * VisioSquad Technology and Service Fees Pricing Engine
 * 
 * SINGLE SOURCE OF TRUTH for all parent/athlete checkout fees.
 * This replaces the old club-pays platform fee model.
 * 
 * @version v1_2026_02_parent_paid
 */

export const FEE_VERSION = 'v1_2026_02_parent_paid';

export const FEE_CONFIG = {
  CARD_CREDIT_PERCENT: 0.03,
  CARD_DEBIT_PERCENT: 0,
  ACH_PERCENT: 0.015,
  RECURRING_FLAT_PER_MONTH: 3.00,
  ONE_TIME_FLAT: 1.00,
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
  percentFee: number;
  flatFee: number;
  paymentRail: PaymentRail;
  paymentKind: PaymentKind;
  monthsCount: number;
  feeVersion: string;
  displayBreakdown: {
    label: string;
    percentApplied: number;
    flatApplied: number;
    totalFee: number;
    discountMessage?: string;
  };
}

function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Calculate Technology and Service Fees for checkout
 * 
 * PRICING RULES:
 * 
 * Recurring contract payments (monthly/quarterly/season):
 * - Card CREDIT: techFee = (baseAmount * 0.03) + (3.00 * monthsCount)
 * - Card DEBIT:  techFee = (3.00 * monthsCount) -- NO PERCENT
 * - ACH:         techFee = (baseAmount * 0.015) + (3.00 * monthsCount)
 * 
 * One-time payments (tournament/clinic/event/drop-in):
 * - Card CREDIT: techFee = (baseAmount * 0.03) + 1.00
 * - Card DEBIT:  techFee = 1.00 -- NO PERCENT
 * - ACH:         techFee = (baseAmount * 0.015) + 1.00
 * 
 * @param input - Pricing calculation input
 * @returns PricingResult with all fee details
 */
export function calculateTechnologyAndServiceFees(input: PricingInput): PricingResult {
  const { baseAmount, monthsCount, paymentKind, paymentRail } = input;
  
  let percentRate: number;
  let flatFee: number;
  
  switch (paymentRail) {
    case 'card_credit':
      percentRate = FEE_CONFIG.CARD_CREDIT_PERCENT;
      break;
    case 'card_debit':
      percentRate = FEE_CONFIG.CARD_DEBIT_PERCENT;
      break;
    case 'ach':
      percentRate = FEE_CONFIG.ACH_PERCENT;
      break;
  }
  
  if (paymentKind === 'recurring_contract') {
    flatFee = FEE_CONFIG.RECURRING_FLAT_PER_MONTH * monthsCount;
  } else {
    flatFee = FEE_CONFIG.ONE_TIME_FLAT;
  }
  
  const percentFee = roundToCents(baseAmount * percentRate);
  const techFee = roundToCents(percentFee + flatFee);
  const totalAmount = roundToCents(baseAmount + techFee);
  
  let discountMessage: string | undefined;
  if (paymentRail === 'card_debit') {
    discountMessage = 'Debit card discount applied (percentage waived)';
  } else if (paymentRail === 'ach') {
    discountMessage = 'ACH Discount Applied';
  }
  
  return {
    baseAmount,
    techFee,
    totalAmount,
    percentFee,
    flatFee,
    paymentRail,
    paymentKind,
    monthsCount,
    feeVersion: FEE_VERSION,
    displayBreakdown: {
      label: 'Technology and Service Fees',
      percentApplied: percentRate * 100,
      flatApplied: flatFee,
      totalFee: techFee,
      discountMessage,
    },
  };
}

/**
 * Calculate pricing for both Card and ACH to show dual pricing at checkout
 * 
 * @param baseAmount - Base amount the club is charging
 * @param monthsCount - Number of months (1 for one-time, or derived from pay schedule)
 * @param paymentKind - 'recurring_contract' or 'one_time_event'
 * @returns Object with card and ACH pricing for display
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
  const card = calculateTechnologyAndServiceFees({
    baseAmount,
    monthsCount,
    paymentKind,
    paymentRail: 'card_credit',
  });
  
  const ach = calculateTechnologyAndServiceFees({
    baseAmount,
    monthsCount,
    paymentKind,
    paymentRail: 'ach',
  });
  
  const savings = roundToCents(card.totalAmount - ach.totalAmount);
  
  return { card, ach, savings };
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
