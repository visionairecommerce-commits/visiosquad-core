import crypto from 'crypto';
import { HELCIM_CONNECTED_ACCOUNTS_ENABLED, HELCIM_PARTNER_TOKEN, HELCIM_MODE, APP_BASE_URL, ENABLE_SPLIT_CHECKOUT } from './helcim';

export interface ConnectedAccountRegistration {
  onboardingUrl: string;
  registrationId: string;
}

export interface ConnectedAccountCallback {
  status: 'connected' | 'pending' | 'failed';
  connectedAccountId?: string;
  tokenRef?: string;
  error?: string;
}

export interface ConnectedAccountsProvider {
  createRegistration(clubId: string, clubName: string): Promise<ConnectedAccountRegistration>;
  handleCallback(params: Record<string, string>): Promise<ConnectedAccountCallback>;
}

class StubConnectedAccountsProvider implements ConnectedAccountsProvider {
  async createRegistration(clubId: string, clubName: string): Promise<ConnectedAccountRegistration> {
    const registrationId = `stub_reg_${crypto.randomUUID()}`;
    const baseUrl = APP_BASE_URL || '';
    const onboardingUrl = `${baseUrl}/settings/payments/helcim/fake-onboarding?club_id=${clubId}&registration_id=${registrationId}`;
    console.log(`[ConnectedAccounts/Stub] Created registration for club ${clubId}: ${registrationId}`);
    return { onboardingUrl, registrationId };
  }

  async handleCallback(params: Record<string, string>): Promise<ConnectedAccountCallback> {
    const clubId = params.club_id;
    const registrationId = params.registration_id;
    const action = params.action;

    if (action === 'complete') {
      const fakeAccountId = `stub_acct_${crypto.randomUUID().slice(0, 8)}`;
      const fakeTokenRef = `stub_tok_${crypto.randomUUID().slice(0, 8)}`;
      console.log(`[ConnectedAccounts/Stub] Onboarding complete for club ${clubId}: account=${fakeAccountId}`);
      return {
        status: 'connected',
        connectedAccountId: fakeAccountId,
        tokenRef: fakeTokenRef,
      };
    }

    return { status: 'failed', error: 'Onboarding not completed' };
  }
}

class RealHelcimConnectedAccountsProvider implements ConnectedAccountsProvider {
  private baseUrl = HELCIM_MODE === 'sandbox' 
    ? 'https://api.helcim.com/v2' 
    : 'https://api.helcim.com/v2';

  async createRegistration(clubId: string, clubName: string): Promise<ConnectedAccountRegistration> {
    if (!HELCIM_PARTNER_TOKEN) {
      throw new Error('HELCIM_PARTNER_TOKEN is required for real connected accounts');
    }

    const callbackUrl = `${APP_BASE_URL}/settings/payments/helcim/callback`;

    const response = await fetch(`${this.baseUrl}/connected-accounts/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-token': HELCIM_PARTNER_TOKEN,
      },
      body: JSON.stringify({
        businessName: clubName,
        callbackUrl,
        metadata: { clubId },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Helcim registration failed: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return {
      onboardingUrl: data.onboardingUrl || data.url,
      registrationId: data.registrationId || data.id,
    };
  }

  async handleCallback(params: Record<string, string>): Promise<ConnectedAccountCallback> {
    const accountId = params.account_id || params.connectedAccountId;
    const status = params.status;

    if (status === 'active' || status === 'connected') {
      return {
        status: 'connected',
        connectedAccountId: accountId,
        tokenRef: params.token_ref || params.tokenRef,
      };
    }

    if (status === 'pending') {
      return { status: 'pending' };
    }

    return { status: 'failed', error: params.error || 'Unknown callback status' };
  }
}

let providerInstance: ConnectedAccountsProvider | null = null;

export function getConnectedAccountsProvider(): ConnectedAccountsProvider {
  if (providerInstance) return providerInstance;

  if (HELCIM_CONNECTED_ACCOUNTS_ENABLED && HELCIM_PARTNER_TOKEN) {
    console.log('[ConnectedAccounts] Using REAL Helcim provider');
    providerInstance = new RealHelcimConnectedAccountsProvider();
  } else {
    console.log('[ConnectedAccounts] Using STUB provider (partner credentials not available)');
    providerInstance = new StubConnectedAccountsProvider();
  }

  return providerInstance;
}

export function isConnectedAccountsEnabled(): boolean {
  return HELCIM_CONNECTED_ACCOUNTS_ENABLED;
}

export function isUsingStubProvider(): boolean {
  return !HELCIM_PARTNER_TOKEN || !HELCIM_CONNECTED_ACCOUNTS_ENABLED;
}

export interface SplitCheckoutDecision {
  useSplitCheckout: boolean;
  reason: string;
  connectedAccountId?: string;
  connectedAccountTokenRef?: string;
}

export function shouldUseSplitCheckout(club: {
  helcim_connection_status?: string;
  helcim_connected_account_id?: string;
  helcim_connected_account_token_ref?: string;
}): SplitCheckoutDecision {
  if (!ENABLE_SPLIT_CHECKOUT) {
    return { useSplitCheckout: false, reason: 'ENABLE_SPLIT_CHECKOUT is off' };
  }

  if (!HELCIM_CONNECTED_ACCOUNTS_ENABLED) {
    return { useSplitCheckout: false, reason: 'HELCIM_CONNECTED_ACCOUNTS_ENABLED is off' };
  }

  if (club.helcim_connection_status !== 'connected') {
    return { useSplitCheckout: false, reason: `Club connection status: ${club.helcim_connection_status}` };
  }

  if (!club.helcim_connected_account_id) {
    return { useSplitCheckout: false, reason: 'No connected account ID' };
  }

  return {
    useSplitCheckout: true,
    reason: 'Split checkout active',
    connectedAccountId: club.helcim_connected_account_id,
    connectedAccountTokenRef: club.helcim_connected_account_token_ref || undefined,
  };
}
