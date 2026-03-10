import { calculateTotalCharge } from "../../shared/pricing";

// NEW CENTRALIZED MATH
export function getHelcimFee(amount) {
const breakdown = calculateTotalCharge(amount);
return breakdown.techFee;
}

export function calculateBillingPeriod(startDate, months) {
const start = new Date(startDate);
const end = new Date(startDate);
end.setMonth(start.getMonth() + months);
return { start, end };
}

// RESTORING REQUIRED CONFIG
export const HELCIM_CONFIG = { surchargePercent: 0.03 };
export const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5000';
export const HELCIM_MODE = process.env.HELCIM_MODE || 'test';
export const HELCIM_PARTNER_TOKEN = process.env.HELCIM_PARTNER_TOKEN || '';
export const HELCIM_CONNECTED_ACCOUNTS_ENABLED = true;
export const ENABLE_SPLIT_CHECKOUT = true;
