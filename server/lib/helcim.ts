const HELCIM_API_TOKEN = process.env.HELCIM_API_TOKEN;
const HELCIM_ACCOUNT_ID = process.env.HELCIM_ACCOUNT_ID;

const HELCIM_BASE_URL = 'https://api.helcim.com/v2';

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

export const CONVENIENCE_FEES = {
  credit_card: 0.03,
  ach: 0,
  cash: 0,
} as const;

export function calculateTotalWithFee(amount: number, method: 'credit_card' | 'ach' | 'cash'): number {
  const fee = CONVENIENCE_FEES[method];
  return amount * (1 + fee);
}
