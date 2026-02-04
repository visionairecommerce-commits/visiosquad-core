import crypto from 'crypto';

const HELCIM_API_TOKEN = process.env.HELCIM_API_TOKEN;
const HELCIM_ACCOUNT_ID = process.env.HELCIM_ACCOUNT_ID;
const HELCIM_WEBHOOK_SECRET = process.env.HELCIM_WEBHOOK_SECRET;

const HELCIM_BASE_URL = 'https://api.helcim.com/v2';

/**
 * Helcim Webhook Headers interface
 * Helcim sends these three headers with every webhook:
 * - webhook-id: Unique message identifier for idempotency
 * - webhook-timestamp: Unix timestamp of when the webhook was sent
 * - webhook-signature: Space-delimited versioned signatures (e.g., "v1,<sig> v2,<sig>")
 */
export interface HelcimWebhookHeaders {
  webhookId: string;
  webhookTimestamp: string;
  webhookSignature: string;
}

/**
 * Extract Helcim webhook headers from request
 */
export function extractWebhookHeaders(headers: Record<string, string | string[] | undefined>): HelcimWebhookHeaders | null {
  const webhookId = headers['webhook-id'] as string;
  const webhookTimestamp = headers['webhook-timestamp'] as string;
  const webhookSignature = headers['webhook-signature'] as string;
  
  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return null;
  }
  
  return { webhookId, webhookTimestamp, webhookSignature };
}

/**
 * Verify Helcim webhook signature using HMAC-SHA256
 * 
 * Per Helcim docs:
 * 1. Build signedContent = "${webhookId}.${webhookTimestamp}.${rawBody}"
 * 2. Base64-decode the verifier token (HELCIM_WEBHOOK_SECRET) to get HMAC key
 * 3. Generate HMAC-SHA256 signature and base64-encode it
 * 4. Compare against signatures in webhook-signature header (format: "v1,<sig> v2,<sig>")
 */
export function verifyWebhookSignature(
  rawBody: string, 
  headers: HelcimWebhookHeaders
): boolean {
  if (!HELCIM_WEBHOOK_SECRET) {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      console.error('[Helcim Webhook] No webhook secret configured in production - rejecting');
      return false;
    }
    console.warn('[Helcim Webhook] No webhook secret configured - skipping verification (dev mode)');
    return true;
  }

  try {
    // Step 1: Build signed content per Helcim spec
    const signedContent = `${headers.webhookId}.${headers.webhookTimestamp}.${rawBody}`;
    
    // Step 2: Base64-decode the verifier token to get the HMAC key
    const verifierTokenBytes = Buffer.from(HELCIM_WEBHOOK_SECRET, 'base64');
    
    // Step 3: Generate HMAC-SHA256 signature and base64-encode it
    const generatedSignature = crypto
      .createHmac('sha256', verifierTokenBytes)
      .update(signedContent)
      .digest('base64');
    
    // Step 4: Parse and verify against signatures in header
    // Format: "v1,<sig1> v2,<sig2>" - space-delimited, each has version prefix
    const signatures = headers.webhookSignature.split(' ');
    
    for (const sig of signatures) {
      const parts = sig.split(',');
      if (parts.length !== 2) continue;
      
      const signature = parts[1];
      
      // Use timing-safe comparison
      if (signature.length === generatedSignature.length) {
        try {
          const isMatch = crypto.timingSafeEqual(
            Buffer.from(signature, 'base64'),
            Buffer.from(generatedSignature, 'base64')
          );
          if (isMatch) {
            console.log('[Helcim Webhook] Signature verified successfully');
            return true;
          }
        } catch {
          // Continue to next signature if comparison fails
        }
      }
    }
    
    console.warn('[Helcim Webhook] No matching signature found');
    return false;
  } catch (error) {
    console.error('[Helcim Webhook] Signature verification error:', error);
    return false;
  }
}

/**
 * Check if webhook secret is configured
 */
export function isWebhookSecretConfigured(): boolean {
  return !!HELCIM_WEBHOOK_SECRET;
}

interface PaymentRequest {
  amount: number;
  cardToken?: string;
  currency?: string;
  customerCode?: string;
  invoiceNumber?: string;
  comments?: string;
}

interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  message?: string;
  error?: string;
}

export async function processPayment(request: PaymentRequest): Promise<PaymentResponse> {
  if (!HELCIM_API_TOKEN || !HELCIM_ACCOUNT_ID) {
    console.warn('Helcim credentials not configured');
    return {
      success: false,
      error: 'Payment processing not configured',
    };
  }

  try {
    const response = await fetch(`${HELCIM_BASE_URL}/payment/purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-token': HELCIM_API_TOKEN,
        'account-id': HELCIM_ACCOUNT_ID,
      },
      body: JSON.stringify({
        amount: request.amount,
        currency: request.currency || 'USD',
        cardToken: request.cardToken,
        customerCode: request.customerCode,
        invoiceNumber: request.invoiceNumber,
        comments: request.comments,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        transactionId: data.transactionId,
        message: 'Payment processed successfully',
      };
    } else {
      return {
        success: false,
        error: data.errors?.[0]?.message || 'Payment failed',
      };
    }
  } catch (error) {
    console.error('Helcim payment error:', error);
    return {
      success: false,
      error: 'Payment processing error',
    };
  }
}

export async function createCardToken(cardNumber: string, expiry: string, cvv: string): Promise<{ token?: string; error?: string }> {
  if (!HELCIM_API_TOKEN || !HELCIM_ACCOUNT_ID) {
    return { error: 'Payment processing not configured' };
  }

  try {
    const response = await fetch(`${HELCIM_BASE_URL}/card-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-token': HELCIM_API_TOKEN,
        'account-id': HELCIM_ACCOUNT_ID,
      },
      body: JSON.stringify({
        cardNumber,
        cardExpiry: expiry,
        cardCVV: cvv,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return { token: data.cardToken };
    } else {
      return { error: data.errors?.[0]?.message || 'Failed to tokenize card' };
    }
  } catch (error) {
    console.error('Helcim tokenization error:', error);
    return { error: 'Card tokenization error' };
  }
}

export async function createBankToken(
  routingNumber: string,
  accountNumber: string,
  accountType: 'checking' | 'savings'
): Promise<{ token?: string; error?: string }> {
  if (!HELCIM_API_TOKEN || !HELCIM_ACCOUNT_ID) {
    return { error: 'Payment processing not configured' };
  }

  try {
    const response = await fetch(`${HELCIM_BASE_URL}/bank-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-token': HELCIM_API_TOKEN,
        'account-id': HELCIM_ACCOUNT_ID,
      },
      body: JSON.stringify({
        routingNumber,
        accountNumber,
        accountType,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return { token: data.bankToken };
    } else {
      return { error: data.errors?.[0]?.message || 'Failed to tokenize bank account' };
    }
  } catch (error) {
    console.error('Helcim bank tokenization error:', error);
    return { error: 'Bank account tokenization error' };
  }
}

export const CONVENIENCE_FEES = {
  credit_card: 0.03,  // 3% surcharge for credit card
  ach: 1.00,          // $1.00 flat fee for ACH
  cash: 0,
} as const;

export function calculateTotalWithFee(amount: number, method: 'credit_card' | 'ach' | 'cash'): number {
  if (method === 'credit_card') {
    // 3% surcharge for credit card
    return amount * 1.03;
  } else if (method === 'ach') {
    // $1.00 flat fee for ACH
    return amount + 1.00;
  }
  // No fee for cash
  return amount;
}

export function getConvenienceFeeAmount(amount: number, method: 'credit_card' | 'ach' | 'cash'): number {
  if (method === 'credit_card') {
    // Round to 2 decimal places for consistent currency calculations
    return Math.round(amount * 0.03 * 100) / 100;
  } else if (method === 'ach') {
    return 1.00;
  }
  return 0;
}

interface RecurringPaymentResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export async function cancelRecurringPayment(
  athleteId: string,
  contractId: string
): Promise<RecurringPaymentResponse> {
  if (!HELCIM_API_TOKEN || !HELCIM_ACCOUNT_ID) {
    return {
      success: false,
      error: 'Helcim credentials not configured - recurring payment cancellation skipped',
    };
  }

  try {
    // Helcim uses "recurring-plans" endpoint for managing subscriptions
    // First, we need to find the plan associated with this athlete/contract
    const searchResponse = await fetch(`${HELCIM_BASE_URL}/recurring-plans?invoiceNumber=${contractId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'api-token': HELCIM_API_TOKEN,
        'account-id': HELCIM_ACCOUNT_ID,
      },
    });

    if (!searchResponse.ok) {
      return {
        success: false,
        error: 'No recurring payment found for this contract',
      };
    }

    const plans = await searchResponse.json();
    
    // If no plans found, nothing to cancel
    if (!plans || !Array.isArray(plans) || plans.length === 0) {
      return {
        success: true,
        message: 'No recurring payment plans found to cancel',
      };
    }

    // Cancel each recurring plan found
    for (const plan of plans) {
      if (plan.id && plan.status === 'active') {
        const cancelResponse = await fetch(`${HELCIM_BASE_URL}/recurring-plans/${plan.id}/cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-token': HELCIM_API_TOKEN,
            'account-id': HELCIM_ACCOUNT_ID,
          },
        });

        if (!cancelResponse.ok) {
          console.error(`Failed to cancel recurring plan ${plan.id}`);
        }
      }
    }

    return {
      success: true,
      message: 'Recurring payment(s) cancelled successfully',
    };
  } catch (error) {
    console.error('Helcim recurring payment cancellation error:', error);
    return {
      success: false,
      error: 'Failed to cancel recurring payment',
    };
  }
}

interface PlatformBillingRequest {
  amount: number;
  cardToken?: string;
  bankToken?: string;
  clubId: string;
  clubName: string;
  invoiceId: string;
  periodStart: string;
  periodEnd: string;
}

interface PlatformBillingResponse {
  success: boolean;
  transactionId?: string;
  message?: string;
  error?: string;
}

// ============ HELCIM RECURRING API (Model A) ============

// Feature flags for billing mode
// DEPRECATED: These flags are being phased out. Use PARENT_PAID_FEES_ENABLED instead.
export const BILLING_MODE = (process.env.BILLING_MODE || 'app') as 'helcim' | 'app';
export const BILLING_AUTOPAY_PREP_ENABLED = process.env.BILLING_AUTOPAY_PREP_ENABLED !== 'false';
export const BILLING_RECONCILIATION_ENABLED = process.env.BILLING_RECONCILIATION_ENABLED !== 'false';

// NEW: Parent-paid fees model flag
// When true, parents/athletes pay Technology and Service Fees at checkout
// When false, old club-pays model applies (legacy)
export const PARENT_PAID_FEES_ENABLED = process.env.PARENT_PAID_FEES_ENABLED === 'true';

// ============ CARD TYPE DETECTION ============

export type CardFundingType = 'credit' | 'debit' | 'unknown';

/**
 * Detect if a card is credit or debit from Helcim transaction response
 * 
 * Detection strategy:
 * 1. Check Helcim response for cardType/fundingType fields (if provided)
 * 2. Check for debit indicators in card brand (e.g., "DEBIT" in type string)
 * 3. If BIN is available, could use BIN lookup (not storing full PAN)
 * 4. Fallback: Default to DEBIT (flat-only) as compliance-safe fallback
 * 
 * @param helcimResponse - Transaction response from Helcim API
 * @returns 'credit' | 'debit' | 'unknown'
 */
export function detectCardFundingType(helcimResponse: any): CardFundingType {
  if (!helcimResponse) return 'unknown';
  
  // Check explicit funding type field (if Helcim provides it)
  if (helcimResponse.cardFunding) {
    const funding = helcimResponse.cardFunding.toLowerCase();
    if (funding === 'debit') return 'debit';
    if (funding === 'credit') return 'credit';
  }
  
  // Check cardType field for debit indicator
  if (helcimResponse.cardType) {
    const cardType = helcimResponse.cardType.toLowerCase();
    if (cardType.includes('debit')) return 'debit';
    if (cardType.includes('credit')) return 'credit';
  }
  
  // Check card brand for common debit indicators
  if (helcimResponse.cardBrand) {
    const brand = helcimResponse.cardBrand.toLowerCase();
    // Maestro and Interac are typically debit
    if (brand.includes('maestro') || brand.includes('interac')) return 'debit';
  }
  
  // Check for debit network indicator
  if (helcimResponse.debitNetwork || helcimResponse.isPinDebit) {
    return 'debit';
  }
  
  // Fallback: Default to debit for compliance safety
  // This ensures we never overcharge (flat fee only for unknown cards)
  console.log('[Card Detection] Unable to determine card type, defaulting to debit for compliance');
  return 'debit';
}

/**
 * Convert detected card funding type to payment rail
 * 
 * @param fundingType - 'credit' | 'debit' | 'unknown'
 * @returns Payment rail for fee calculation
 */
export function cardFundingToPaymentRail(fundingType: CardFundingType): 'card_credit' | 'card_debit' {
  if (fundingType === 'credit') return 'card_credit';
  // Default unknown to debit for compliance (flat fee only)
  return 'card_debit';
}

/**
 * Calculate deterministic billing period for a given billing day
 * Rule: Billing on day X covers the period from (X of previous month) to (X-1 of current month)
 * Example: Billing on Mar 15 covers Feb 15 – Mar 14
 */
export function calculateBillingPeriod(billingDay: number, billingDate: Date = new Date()): { periodStart: Date; periodEnd: Date } {
  const year = billingDate.getFullYear();
  const month = billingDate.getMonth();
  
  // Period end is day before billing day in current month
  const periodEnd = new Date(year, month, billingDay - 1);
  
  // Period start is billing day of previous month
  const periodStart = new Date(year, month - 1, billingDay);
  
  return { periodStart, periodEnd };
}

/**
 * Check if we're in the no-touch window (24h before billing through 12h after)
 * During this window, we should NOT PATCH recurringAmount unless no transaction exists
 * 
 * Uses proper date arithmetic to handle month boundaries correctly.
 */
export function isInNoTouchWindow(billingDay: number, now: Date = new Date()): boolean {
  // Calculate the actual billing date for this period
  // Find the next upcoming billing date (or current if we're on billing day)
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const hour = now.getHours();
  
  // Determine which billing date is relevant
  // If we're past the billing day this month, use this month's billing date for the window check
  // If we're before or on the billing day, use this month's billing date
  let billingDate: Date;
  
  // Handle end-of-month edge case: if billingDay > days in current month, use last day
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const effectiveBillingDay = Math.min(billingDay, daysInMonth);
  
  billingDate = new Date(year, month, effectiveBillingDay, 0, 0, 0, 0);
  
  // If we're past this month's billing date + 12h window, consider next month's billing date
  const billingDatePlus12h = new Date(billingDate.getTime() + 12 * 60 * 60 * 1000);
  if (now > billingDatePlus12h) {
    // We're past the window for this month, calculate next month's billing date
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const daysInNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
    const nextEffectiveBillingDay = Math.min(billingDay, daysInNextMonth);
    billingDate = new Date(nextYear, nextMonth, nextEffectiveBillingDay, 0, 0, 0, 0);
  }
  
  // Calculate window boundaries using absolute timestamps
  // Window starts: 24 hours before billing date midnight
  const windowStart = new Date(billingDate.getTime() - 24 * 60 * 60 * 1000);
  // Window ends: 12 hours after billing date midnight
  const windowEnd = new Date(billingDate.getTime() + 12 * 60 * 60 * 1000);
  
  // Check if now is within the window
  return now >= windowStart && now <= windowEnd;
}

/**
 * Get or create a Helcim payment plan for a specific billing day and payment method
 * Plans are created lazily on demand
 */
export async function getOrCreatePlan(
  billingDay: number, 
  paymentMethod: 'card' | 'bank'
): Promise<{ planId: number; error?: string }> {
  if (!HELCIM_API_TOKEN || !HELCIM_ACCOUNT_ID) {
    return { planId: 0, error: 'Helcim credentials not configured' };
  }
  
  const planName = `visiosquad-${paymentMethod}-day-${String(billingDay).padStart(2, '0')}`;
  
  try {
    // First, try to find existing plan
    const searchResponse = await fetch(`${HELCIM_BASE_URL}/payment-plans?name=${encodeURIComponent(planName)}`, {
      method: 'GET',
      headers: {
        'api-token': HELCIM_API_TOKEN,
        'Content-Type': 'application/json',
      },
    });
    
    if (searchResponse.ok) {
      const plans = await searchResponse.json();
      if (Array.isArray(plans) && plans.length > 0) {
        const existingPlan = plans.find((p: any) => p.name === planName && p.status === 'active');
        if (existingPlan) {
          console.log(`[Helcim] Found existing plan: ${planName} (ID: ${existingPlan.id})`);
          return { planId: existingPlan.id };
        }
      }
    }
    
    // Create new plan if not found
    console.log(`[Helcim] Creating new payment plan: ${planName}`);
    const createResponse = await fetch(`${HELCIM_BASE_URL}/payment-plans`, {
      method: 'POST',
      headers: {
        'api-token': HELCIM_API_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: planName,
        description: `VisioSquad platform fees - Day ${billingDay} (${paymentMethod})`,
        type: 'cycle',
        billingPeriod: 'monthly',
        billingPeriodIncrements: 1,
        dateBilling: String(billingDay),
        termType: 'forever',
        recurringAmount: 0, // Set per-subscription
        paymentMethod: paymentMethod,
        taxType: 'no_tax',
        currency: 'USD',
      }),
    });
    
    const planData = await createResponse.json();
    
    if (createResponse.ok && planData.id) {
      console.log(`[Helcim] Created plan: ${planName} (ID: ${planData.id})`);
      return { planId: planData.id };
    } else {
      return { planId: 0, error: planData.errors?.[0]?.message || 'Failed to create plan' };
    }
  } catch (error) {
    console.error('[Helcim] Error getting/creating plan:', error);
    return { planId: 0, error: 'Failed to get or create payment plan' };
  }
}

/**
 * Create a subscription for a club to a specific payment plan
 */
export async function createSubscription(
  customerCode: string,
  planId: number,
  recurringAmount: number = 0
): Promise<{ subscriptionId: string; error?: string }> {
  if (!HELCIM_API_TOKEN) {
    return { subscriptionId: '', error: 'Helcim credentials not configured' };
  }
  
  try {
    const response = await fetch(`${HELCIM_BASE_URL}/subscriptions`, {
      method: 'POST',
      headers: {
        'api-token': HELCIM_API_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentPlanId: planId,
        customerCode: customerCode,
        recurringAmount: recurringAmount,
      }),
    });
    
    const data = await response.json();
    
    if (response.ok && data.id) {
      console.log(`[Helcim] Created subscription ${data.id} for customer ${customerCode}`);
      return { subscriptionId: String(data.id) };
    } else {
      return { subscriptionId: '', error: data.errors?.[0]?.message || 'Failed to create subscription' };
    }
  } catch (error) {
    console.error('[Helcim] Error creating subscription:', error);
    return { subscriptionId: '', error: 'Failed to create subscription' };
  }
}

/**
 * Update subscription recurring amount (PATCH)
 * Used by prep job to set variable monthly fees
 */
export async function updateSubscriptionAmount(
  subscriptionId: string,
  recurringAmount: number
): Promise<{ success: boolean; error?: string }> {
  if (!HELCIM_API_TOKEN) {
    return { success: false, error: 'Helcim credentials not configured' };
  }
  
  try {
    const response = await fetch(`${HELCIM_BASE_URL}/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      headers: {
        'api-token': HELCIM_API_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recurringAmount: recurringAmount,
      }),
    });
    
    if (response.ok) {
      console.log(`[Helcim] Updated subscription ${subscriptionId} amount to $${recurringAmount.toFixed(2)}`);
      return { success: true };
    } else {
      const data = await response.json();
      return { success: false, error: data.errors?.[0]?.message || 'Failed to update subscription' };
    }
  } catch (error) {
    console.error('[Helcim] Error updating subscription:', error);
    return { success: false, error: 'Failed to update subscription amount' };
  }
}

/**
 * Get subscription details including payment history
 */
export async function getSubscription(subscriptionId: string): Promise<{ subscription: any; error?: string }> {
  if (!HELCIM_API_TOKEN) {
    return { subscription: null, error: 'Helcim credentials not configured' };
  }
  
  try {
    const response = await fetch(`${HELCIM_BASE_URL}/subscriptions/${subscriptionId}`, {
      method: 'GET',
      headers: {
        'api-token': HELCIM_API_TOKEN,
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      return { subscription: data };
    } else {
      const data = await response.json();
      return { subscription: null, error: data.errors?.[0]?.message || 'Failed to get subscription' };
    }
  } catch (error) {
    console.error('[Helcim] Error getting subscription:', error);
    return { subscription: null, error: 'Failed to get subscription' };
  }
}

/**
 * Get transaction details by ID (used by webhook handler)
 */
export async function getTransactionDetails(transactionId: string): Promise<{ transaction: any; error?: string }> {
  if (!HELCIM_API_TOKEN) {
    return { transaction: null, error: 'Helcim credentials not configured' };
  }
  
  try {
    const response = await fetch(`${HELCIM_BASE_URL}/card-transactions/${transactionId}`, {
      method: 'GET',
      headers: {
        'api-token': HELCIM_API_TOKEN,
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      return { transaction: data };
    } else {
      const data = await response.json();
      return { transaction: null, error: data.errors?.[0]?.message || 'Failed to get transaction' };
    }
  } catch (error) {
    console.error('[Helcim] Error getting transaction:', error);
    return { transaction: null, error: 'Failed to get transaction details' };
  }
}

/**
 * Get transactions for a date range (used by reconciliation)
 */
export async function getTransactionsInRange(
  dateFrom: string,
  dateTo: string,
  customerCode?: string
): Promise<{ transactions: any[]; error?: string }> {
  if (!HELCIM_API_TOKEN) {
    return { transactions: [], error: 'Helcim credentials not configured' };
  }
  
  try {
    let url = `${HELCIM_BASE_URL}/card-transactions?dateFrom=${dateFrom}&dateTo=${dateTo}`;
    if (customerCode) {
      url += `&customerCode=${encodeURIComponent(customerCode)}`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'api-token': HELCIM_API_TOKEN,
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      return { transactions: Array.isArray(data) ? data : [] };
    } else {
      const data = await response.json();
      return { transactions: [], error: data.errors?.[0]?.message || 'Failed to get transactions' };
    }
  } catch (error) {
    console.error('[Helcim] Error getting transactions:', error);
    return { transactions: [], error: 'Failed to get transactions' };
  }
}

export async function chargePlatformBilling(request: PlatformBillingRequest): Promise<PlatformBillingResponse> {
  if (!HELCIM_API_TOKEN || !HELCIM_ACCOUNT_ID) {
    console.warn('[Helcim Platform Billing] Credentials not configured');
    return {
      success: false,
      error: 'Payment processing not configured',
    };
  }

  // Determine which token to use
  const token = request.cardToken || request.bankToken;
  if (!token) {
    return {
      success: false,
      error: 'No billing token provided',
    };
  }

  try {
    const isCard = !!request.cardToken;
    const invoiceNumber = `PLAT-${request.invoiceId.slice(0, 8)}`;
    
    console.log(`[Helcim Platform Billing] Charging club ${request.clubName} (${request.clubId}) - Amount: $${request.amount.toFixed(2)}`);

    const response = await fetch(`${HELCIM_BASE_URL}/payment/purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-token': HELCIM_API_TOKEN,
        'account-id': HELCIM_ACCOUNT_ID,
      },
      body: JSON.stringify({
        amount: request.amount,
        currency: 'USD',
        ...(isCard ? { cardToken: token } : { bankToken: token }),
        invoiceNumber,
        comments: `Platform fees for ${request.clubName} - Period: ${request.periodStart} to ${request.periodEnd}`,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`[Helcim Platform Billing] SUCCESS - Transaction ID: ${data.transactionId}`);
      return {
        success: true,
        transactionId: data.transactionId,
        message: 'Platform billing payment processed successfully',
      };
    } else {
      const errorMsg = data.errors?.[0]?.message || 'Payment failed';
      console.error(`[Helcim Platform Billing] FAILED - ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
      };
    }
  } catch (error) {
    console.error('[Helcim Platform Billing] Error:', error);
    return {
      success: false,
      error: 'Payment processing error',
    };
  }
}
