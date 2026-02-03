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
