/**
 * Mock Services for Billing V2 E2E Tests
 * 
 * Provides mock implementations for:
 * - Helcim payment processing
 * - Resend email service
 * 
 * These mocks intercept network calls and record invocations for assertions.
 */

export interface HelcimMockResponse {
  transactionId: string;
  success: boolean;
  cardFunding?: 'credit' | 'debit';
  cardType?: string;
  amount?: number;
}

export interface CapturedEmail {
  to: string | string[];
  subject: string;
  html: string;
  sentAt: Date;
}

let helcimMockConfig: {
  rail: 'card_credit' | 'card_debit' | 'ach' | 'unknown';
  transactionId: string;
  shouldSucceed: boolean;
} = {
  rail: 'card_credit',
  transactionId: 'T1000',
  shouldSucceed: true,
};

let capturedEmails: CapturedEmail[] = [];
let helcimCallCount = 0;
let capturedHelcimRequests: { url: string; body: any; amount?: number }[] = [];

/**
 * Configure Helcim mock behavior
 */
export function configureHelcimMock(config: {
  rail?: 'card_credit' | 'card_debit' | 'ach' | 'unknown';
  transactionId?: string;
  shouldSucceed?: boolean;
}) {
  helcimMockConfig = {
    rail: config.rail ?? 'card_credit',
    transactionId: config.transactionId ?? 'T1000',
    shouldSucceed: config.shouldSucceed ?? true,
  };
  helcimCallCount = 0;
  capturedHelcimRequests = [];
}

/**
 * Get Helcim mock call count
 */
export function getHelcimCallCount(): number {
  return helcimCallCount;
}

/**
 * Clear captured emails
 */
export function clearCapturedEmails(): void {
  capturedEmails = [];
}

/**
 * Get all captured emails
 */
export function getCapturedEmails(): CapturedEmail[] {
  return [...capturedEmails];
}

/**
 * Get the most recent captured email
 */
export function getLatestEmail(): CapturedEmail | undefined {
  return capturedEmails[capturedEmails.length - 1];
}

/**
 * Get all captured Helcim requests
 */
export function getCapturedHelcimRequests(): { url: string; body: any; amount?: number }[] {
  return [...capturedHelcimRequests];
}

/**
 * Get the most recent Helcim request
 */
export function getLatestHelcimRequest(): { url: string; body: any; amount?: number } | undefined {
  return capturedHelcimRequests[capturedHelcimRequests.length - 1];
}

/**
 * Clear captured Helcim requests
 */
export function clearCapturedHelcimRequests(): void {
  capturedHelcimRequests = [];
}

/**
 * Mock response generator for Helcim API
 */
function createHelcimMockResponse(): HelcimMockResponse {
  const rail = helcimMockConfig.rail;
  
  let cardFunding: 'credit' | 'debit' | undefined;
  let cardType: string | undefined;
  
  if (rail === 'card_credit') {
    cardFunding = 'credit';
    cardType = 'Visa Credit';
  } else if (rail === 'card_debit') {
    cardFunding = 'debit';
    cardType = 'Visa Debit';
  } else if (rail === 'unknown') {
    cardFunding = undefined;
    cardType = undefined;
  }
  
  return {
    transactionId: helcimMockConfig.transactionId,
    success: helcimMockConfig.shouldSucceed,
    cardFunding,
    cardType,
  };
}

/**
 * Install global fetch mock for Helcim and Resend
 * Call this before running tests
 */
export function installGlobalMocks(): void {
  const originalFetch = global.fetch;
  
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    
    if (url.includes('api.helcim.com')) {
      helcimCallCount++;
      const mockResponse = createHelcimMockResponse();
      
      // Capture the request payload for verification
      let requestBody: any = {};
      if (init?.body) {
        try {
          requestBody = JSON.parse(init.body as string);
        } catch (e) {
          requestBody = {};
        }
      }
      capturedHelcimRequests.push({
        url,
        body: requestBody,
        amount: requestBody.amount,
      });
      
      if (!mockResponse.success) {
        return new Response(
          JSON.stringify({ errors: [{ message: 'Payment failed' }] }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({
          transactionId: mockResponse.transactionId,
          status: 'APPROVED',
          cardFunding: mockResponse.cardFunding,
          cardType: mockResponse.cardType,
          amount: requestBody.amount || 100,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (url.includes('api.resend.com')) {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      
      capturedEmails.push({
        to: body.to,
        subject: body.subject,
        html: body.html,
        sentAt: new Date(),
      });
      
      return new Response(
        JSON.stringify({ id: `mock-email-${Date.now()}` }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return originalFetch(input, init);
  };
}

/**
 * Assert email contains expected content
 */
export function assertEmailContent(email: CapturedEmail | undefined, checks: {
  containsTerminology?: boolean;
  noForbiddenTerms?: boolean;
  hasDiscountLine?: string;
}): { passed: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!email) {
    return { passed: false, errors: ['No email captured'] };
  }
  
  const html = email.html.toLowerCase();
  
  if (checks.containsTerminology) {
    if (!html.includes('technology and service fees')) {
      errors.push('Email missing "Technology and Service Fees"');
    }
  }
  
  if (checks.noForbiddenTerms) {
    const forbidden = ['surcharge', 'convenience fee', 'processing fee', 'credit card fee'];
    for (const term of forbidden) {
      if (html.includes(term.toLowerCase())) {
        errors.push(`Email contains forbidden term: "${term}"`);
      }
    }
  }
  
  if (checks.hasDiscountLine) {
    if (!html.includes(checks.hasDiscountLine.toLowerCase())) {
      errors.push(`Email missing discount line: "${checks.hasDiscountLine}"`);
    }
  }
  
  return { passed: errors.length === 0, errors };
}
