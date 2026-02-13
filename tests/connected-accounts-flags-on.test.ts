/**
 * Connected Accounts - Flags ON Subprocess Test
 *
 * This test runs with ENABLE_SPLIT_CHECKOUT=true and
 * HELCIM_CONNECTED_ACCOUNTS_ENABLED=true to validate the positive path
 * of shouldUseSplitCheckout and feature flag HTTP endpoint.
 *
 * Run standalone:
 *   ENABLE_SPLIT_CHECKOUT=true HELCIM_CONNECTED_ACCOUNTS_ENABLED=true npx tsx tests/connected-accounts-flags-on.test.ts
 *
 * Or called automatically by connected-accounts.test.ts
 */

import request from 'supertest';
import { createApp } from '../server/app';

interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function assert(
  condition: boolean,
  category: string,
  testName: string,
  message: string,
  details?: any,
) {
  results.push({
    name: testName,
    category,
    passed: condition,
    message: condition ? 'PASS' : `FAIL: ${message}`,
    details,
  });
  if (!condition) {
    console.log(`  x ${testName}: ${message}`);
    if (details) console.log(`     Details: ${JSON.stringify(details)}`);
  } else {
    console.log(`  + ${testName}`);
  }
}

import { shouldUseSplitCheckout, isConnectedAccountsEnabled, isUsingStubProvider } from '../server/lib/helcim-connected-accounts';
import { ENABLE_SPLIT_CHECKOUT, HELCIM_CONNECTED_ACCOUNTS_ENABLED } from '../server/lib/helcim';

async function main() {
  console.log('\n=== FLAGS ON: SPLIT CHECKOUT POSITIVE PATH ===\n');

  assert(
    ENABLE_SPLIT_CHECKOUT === true,
    'Flags On',
    'ENABLE_SPLIT_CHECKOUT is true',
    `Got: ${ENABLE_SPLIT_CHECKOUT}`,
  );

  assert(
    HELCIM_CONNECTED_ACCOUNTS_ENABLED === true,
    'Flags On',
    'HELCIM_CONNECTED_ACCOUNTS_ENABLED is true',
    `Got: ${HELCIM_CONNECTED_ACCOUNTS_ENABLED}`,
  );

  assert(
    isConnectedAccountsEnabled() === true,
    'Flags On',
    'isConnectedAccountsEnabled() returns true',
    `Got: ${isConnectedAccountsEnabled()}`,
  );

  const fullyConnected = shouldUseSplitCheckout({
    helcim_connection_status: 'connected',
    helcim_connected_account_id: 'acct_real_456',
    helcim_connected_account_token_ref: 'tok_real_xyz',
  });

  assert(
    fullyConnected.useSplitCheckout === true,
    'Flags On',
    'Fully connected club => split checkout active',
    `Got: ${fullyConnected.useSplitCheckout}`,
    fullyConnected,
  );

  assert(
    fullyConnected.connectedAccountId === 'acct_real_456',
    'Flags On',
    'Decision includes connectedAccountId',
    `Got: ${fullyConnected.connectedAccountId}`,
  );

  assert(
    fullyConnected.connectedAccountTokenRef === 'tok_real_xyz',
    'Flags On',
    'Decision includes connectedAccountTokenRef',
    `Got: ${fullyConnected.connectedAccountTokenRef}`,
  );

  assert(
    fullyConnected.reason === 'Split checkout active',
    'Flags On',
    'Decision reason is "Split checkout active"',
    `Got: ${fullyConnected.reason}`,
  );

  const notConnected = shouldUseSplitCheckout({
    helcim_connection_status: 'not_connected',
  });
  assert(
    notConnected.useSplitCheckout === false,
    'Flags On',
    'Not connected club => no split checkout even with flags on',
    `Got: ${notConnected.useSplitCheckout}`,
  );

  const pending = shouldUseSplitCheckout({
    helcim_connection_status: 'pending',
    helcim_connected_account_id: 'acct_pending',
  });
  assert(
    pending.useSplitCheckout === false,
    'Flags On',
    'Pending club => no split checkout even with flags on',
    `Got: ${pending.useSplitCheckout}`,
  );

  const noAccountId = shouldUseSplitCheckout({
    helcim_connection_status: 'connected',
    helcim_connected_account_id: undefined,
  });
  assert(
    noAccountId.useSplitCheckout === false,
    'Flags On',
    'Connected but no account ID => no split checkout',
    `Got: ${noAccountId.useSplitCheckout}`,
  );

  console.log('\n=== FLAGS ON: HTTP FEATURE FLAGS ENDPOINT ===\n');

  const { app, httpServer } = await createApp({ skipVite: true, skipScheduledJobs: true });
  try {
    const flagsRes = await request(app).get('/api/connected-accounts/feature-flags');
    assert(
      flagsRes.status === 200,
      'Flags On HTTP',
      'GET /feature-flags returns 200',
      `Got: ${flagsRes.status}`,
    );
    assert(
      flagsRes.body.splitCheckoutEnabled === true,
      'Flags On HTTP',
      'splitCheckoutEnabled=true in response',
      `Got: ${flagsRes.body.splitCheckoutEnabled}`,
    );
    assert(
      flagsRes.body.connectedAccountsEnabled === true,
      'Flags On HTTP',
      'connectedAccountsEnabled=true in response',
      `Got: ${flagsRes.body.connectedAccountsEnabled}`,
    );
  } finally {
    httpServer.close();
  }

  const totalPassed = results.filter((r) => r.passed).length;
  const totalTests = results.length;

  console.log('\n' + '-'.repeat(50));
  console.log(`\nTOTAL: ${totalPassed}/${totalTests} tests passed\n`);

  if (totalPassed < totalTests) {
    console.log('FAILURES:');
    results.filter((r) => !r.passed).forEach((f) => {
      console.log(`  FAIL: [${f.category}] ${f.name} - ${f.message}`);
    });
  }

  process.exit(totalPassed === totalTests ? 0 : 1);
}

main().catch((err) => {
  console.error('Flags-on test runner error:', err);
  process.exit(1);
});
