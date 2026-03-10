import { TOTAL_PLATFORM_FEE } from "../app/fee.js";

export const FEE_CONFIG = {
  CARD_PERCENT: 0.03,
  PLATFORM_FEE: TOTAL_PLATFORM_FEE
};

export const FEE_VERSION = "v1";

export function calculateTotalCharge(clubAmount) {
  const creditCardFee = Math.round(clubAmount * FEE_CONFIG.CARD_PERCENT * 100) / 100;
  const totalTechnologyFee = creditCardFee + FEE_CONFIG.PLATFORM_FEE;

  return {
    clubAmount: clubAmount,
    techFee: totalTechnologyFee,
    totalToClient: clubAmount + totalTechnologyFee
  };
}

// Backwards-compatible export for callers expecting calculateTechnologyAndServiceFees
export function calculateTechnologyAndServiceFees(amount) {
  const res = calculateTotalCharge(amount);
  return {
    technologyFee: res.techFee,
    serviceFee: FEE_CONFIG.PLATFORM_FEE,
    total: res.totalToClient
  };
}
