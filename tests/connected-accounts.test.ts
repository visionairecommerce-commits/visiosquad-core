/**
 * Connected Accounts & Split Checkout Test Suite
 *
 * Tests the Helcim Connected Accounts adapter layer, split checkout decision
 * logic, feature flag behaviour, and the HTTP API routes.
 *
 * Run with:
 *   npx tsx tests/connected-accounts.test.ts
 *
 * Note: ENABLE_SPLIT_CHECKOUT and HELCIM_CONNECTED_ACCOUNTS_ENABLED default
 * to false, so **all existing payment flows remain unchanged**.
 */

import request from 'supertest';
import { spawn } from 'child_process';
import { createApp } from '../server/app';
import type { Express } from 'express';
import type { Server } from 'http';

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

import {
  shouldUseSplitCheckout,
  getConnectedAccountsProvider,
  isConnectedAccountsEnabled,
  isUsingStubProvider,
  type SplitCheckoutDecision,
} from '../server/lib/helcim-connected-accounts';
import { ENABLE_SPLIT_CHECKOUT, HELCIM_CONNECTED_ACCOUNTS_ENABLED } from '../server/lib/helcim';

async function runSplitCheckoutTests() {
  console.log('\n=== SPLIT CHECKOUT DECISION LOGIC (flags off) ===\n');

  const decision1 = shouldUseSplitCheckout({
    helcim_connection_status: 'connected',
    helcim_connected_account_id: 'acct_123',
    helcim_connected_account_token_ref: 'tok_abc',
  });
  assert(
    decision1.useSplitCheckout === false,
    'Split Checkout',
    'Flags off => no split checkout even with full club data',
    `Expected false, got ${decision1.useSplitCheckout}`,
    decision1,
  );
  assert(
    decision1.reason.includes('ENABLE_SPLIT_CHECKOUT'),
    'Split Checkout',
    'Reason references ENABLE_SPLIT_CHECKOUT flag',
    `Reason was: ${decision1.reason}`,
  );

  const decision2 = shouldUseSplitCheckout({
    helcim_connection_status: 'not_connected',
  });
  assert(
    decision2.useSplitCheckout === false,
    'Split Checkout',
    'Not connected club => no split checkout',
    `Expected false, got ${decision2.useSplitCheckout}`,
    decision2,
  );

  const decision3 = shouldUseSplitCheckout({
    helcim_connection_status: 'connected',
    helcim_connected_account_id: undefined,
  });
  assert(
    decision3.useSplitCheckout === false,
    'Split Checkout',
    'Connected but no account ID => no split checkout',
    `Expected false, got ${decision3.useSplitCheckout}`,
    decision3,
  );

  const decision4 = shouldUseSplitCheckout({});
  assert(
    decision4.useSplitCheckout === false,
    'Split Checkout',
    'Empty club object => no split checkout',
    `Expected false, got ${decision4.useSplitCheckout}`,
    decision4,
  );

}

async function runStubProviderTests() {
  console.log('\n=== STUB PROVIDER ===\n');

  assert(
    isUsingStubProvider() === true,
    'Stub Provider',
    'Dev environment uses stub provider',
    `isUsingStubProvider() = ${isUsingStubProvider()}`,
  );

  assert(
    isConnectedAccountsEnabled() === false,
    'Stub Provider',
    'Connected accounts disabled by default',
    `isConnectedAccountsEnabled() = ${isConnectedAccountsEnabled()}`,
  );

  const provider = getConnectedAccountsProvider();
  const reg = await provider.createRegistration('club_test', 'Test Club');

  assert(
    typeof reg.onboardingUrl === 'string' && reg.onboardingUrl.length > 0,
    'Stub Provider',
    'Stub registration returns onboarding URL',
    `Got: ${reg.onboardingUrl}`,
  );

  assert(
    typeof reg.registrationId === 'string' && reg.registrationId.startsWith('stub_reg_'),
    'Stub Provider',
    'Stub registration ID has stub_ prefix',
    `Got: ${reg.registrationId}`,
  );

  assert(
    reg.onboardingUrl.includes('fake-onboarding'),
    'Stub Provider',
    'Stub onboarding URL points to fake onboarding page',
    `URL: ${reg.onboardingUrl}`,
  );

  const connected = await provider.handleCallback({
    club_id: 'club_test',
    registration_id: reg.registrationId,
    action: 'complete',
  });

  assert(
    connected.status === 'connected',
    'Stub Provider',
    'Stub callback with action=complete => connected',
    `Got status: ${connected.status}`,
  );

  assert(
    typeof connected.connectedAccountId === 'string' &&
      connected.connectedAccountId.startsWith('stub_acct_'),
    'Stub Provider',
    'Stub callback returns fake account ID',
    `Got: ${connected.connectedAccountId}`,
  );

  assert(
    typeof connected.tokenRef === 'string' && connected.tokenRef.startsWith('stub_tok_'),
    'Stub Provider',
    'Stub callback returns fake token ref',
    `Got: ${connected.tokenRef}`,
  );

  const failed = await provider.handleCallback({
    club_id: 'club_test',
    registration_id: 'irrelevant',
    action: 'cancel',
  });

  assert(
    failed.status === 'failed',
    'Stub Provider',
    'Stub callback with non-complete action => failed',
    `Got status: ${failed.status}`,
  );

  assert(
    typeof failed.error === 'string' && failed.error.length > 0,
    'Stub Provider',
    'Failed callback includes error message',
    `Error: ${failed.error}`,
  );
}

function runFeatureFlagTests() {
  console.log('\n=== FEATURE FLAGS ===\n');

  assert(
    ENABLE_SPLIT_CHECKOUT === false,
    'Feature Flags',
    'ENABLE_SPLIT_CHECKOUT defaults to false',
    `Got: ${ENABLE_SPLIT_CHECKOUT}`,
  );

  assert(
    HELCIM_CONNECTED_ACCOUNTS_ENABLED === false,
    'Feature Flags',
    'HELCIM_CONNECTED_ACCOUNTS_ENABLED defaults to false',
    `Got: ${HELCIM_CONNECTED_ACCOUNTS_ENABLED}`,
  );
}

async function runHttpTests() {
  console.log('\n=== HTTP ROUTES ===\n');

  const result = await createApp({ skipVite: true, skipScheduledJobs: true });
  const app = result.app;
  const httpServer = result.httpServer;

  try {
    const flagsRes = await request(app).get('/api/connected-accounts/feature-flags');
    assert(
      flagsRes.status === 200,
      'HTTP Routes',
      'GET /feature-flags returns 200',
      `Got status ${flagsRes.status}`,
    );
    assert(
      flagsRes.body.splitCheckoutEnabled === false,
      'HTTP Routes',
      'Feature flags response: splitCheckoutEnabled=false',
      `Got: ${flagsRes.body.splitCheckoutEnabled}`,
    );
    assert(
      flagsRes.body.connectedAccountsEnabled === false,
      'HTTP Routes',
      'Feature flags response: connectedAccountsEnabled=false',
      `Got: ${flagsRes.body.connectedAccountsEnabled}`,
    );
    assert(
      flagsRes.body.usingStubProvider === true,
      'HTTP Routes',
      'Feature flags response: usingStubProvider=true',
      `Got: ${flagsRes.body.usingStubProvider}`,
    );

    const statusRes = await request(app).get('/api/connected-accounts/status');
    assert(
      statusRes.status === 403,
      'HTTP Routes',
      'GET /status without auth => 403',
      `Got status ${statusRes.status}`,
    );

    const initiateRes = await request(app).post('/api/connected-accounts/initiate');
    assert(
      initiateRes.status === 403,
      'HTTP Routes',
      'POST /initiate without auth => 403',
      `Got status ${initiateRes.status}`,
    );

    const callbackRes = await request(app).post('/api/connected-accounts/callback');
    assert(
      callbackRes.status === 403,
      'HTTP Routes',
      'POST /callback without auth => 403',
      `Got status ${callbackRes.status}`,
    );

    const disconnectRes = await request(app).post('/api/connected-accounts/disconnect');
    assert(
      disconnectRes.status === 403,
      'HTTP Routes',
      'POST /disconnect without auth => 403',
      `Got status ${disconnectRes.status}`,
    );

    const webhookNoClub = await request(app)
      .post('/api/webhooks/connected-accounts')
      .send({});
    assert(
      webhookNoClub.status === 400,
      'HTTP Routes',
      'POST /webhooks/connected-accounts without club_id => 400',
      `Got status ${webhookNoClub.status}`,
    );
    assert(
      webhookNoClub.body.error === 'club_id required',
      'HTTP Routes',
      'Webhook error message: club_id required',
      `Got: ${webhookNoClub.body.error}`,
    );

  } finally {
    httpServer.close();
  }
}

function runBackwardCompatTests() {
  console.log('\n=== BACKWARD COMPATIBILITY ===\n');

  const fullyConnectedClub = {
    helcim_connection_status: 'connected',
    helcim_connected_account_id: 'acct_real_123',
    helcim_connected_account_token_ref: 'tok_real_abc',
  };
  const decision = shouldUseSplitCheckout(fullyConnectedClub);

  assert(
    decision.useSplitCheckout === false,
    'Backward Compat',
    'Even fully-connected club gets no split checkout when flags off',
    `Got: ${decision.useSplitCheckout}`,
    decision,
  );

  assert(
    decision.reason.includes('ENABLE_SPLIT_CHECKOUT'),
    'Backward Compat',
    'Decision reason clearly references disabled flag',
    `Reason: ${decision.reason}`,
  );

  assert(
    ENABLE_SPLIT_CHECKOUT === false && HELCIM_CONNECTED_ACCOUNTS_ENABLED === false,
    'Backward Compat',
    'Both flags confirmed off - existing payment flows unchanged',
    `ENABLE_SPLIT_CHECKOUT=${ENABLE_SPLIT_CHECKOUT}, HELCIM_CONNECTED_ACCOUNTS_ENABLED=${HELCIM_CONNECTED_ACCOUNTS_ENABLED}`,
  );
}

async function runFlagsOnSubprocess(): Promise<{ passed: number; total: number; ok: boolean }> {
  console.log('\n=== FLAGS ON: SUBPROCESS TEST ===\n');
  return new Promise((resolve) => {
    const proc = spawn('npx', ['tsx', 'tests/connected-accounts-flags-on.test.ts'], {
      env: {
        ...process.env,
        ENABLE_SPLIT_CHECKOUT: 'true',
        HELCIM_CONNECTED_ACCOUNTS_ENABLED: 'true',
      },
      shell: true,
      cwd: process.cwd(),
    });

    let output = '';
    proc.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);
    });
    proc.stderr.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', (code) => {
      const match = output.match(/TOTAL: (\d+)\/(\d+) tests passed/);
      const passed = match ? parseInt(match[1]) : 0;
      const total = match ? parseInt(match[2]) : 0;
      const ok = code === 0 && passed === total && total > 0;

      assert(
        ok,
        'Flags On (subprocess)',
        `Flags-on subprocess: ${passed}/${total} passed`,
        ok ? 'All flags-on tests passed' : `Subprocess exited with code ${code}`,
        { passed, total, exitCode: code },
      );

      resolve({ passed, total, ok });
    });
  });
}

async function main() {
  await runSplitCheckoutTests();
  await runStubProviderTests();
  runFeatureFlagTests();
  await runHttpTests();
  runBackwardCompatTests();
  await runFlagsOnSubprocess();

  console.log('\n');
  console.log('='.repeat(66));
  console.log('    CONNECTED ACCOUNTS & SPLIT CHECKOUT TEST REPORT');
  console.log('='.repeat(66));

  const categories = new Map<string, { passed: number; total: number }>();
  for (const r of results) {
    if (!categories.has(r.category)) {
      categories.set(r.category, { passed: 0, total: 0 });
    }
    const cat = categories.get(r.category)!;
    cat.total++;
    if (r.passed) cat.passed++;
  }

  for (const [cat, counts] of categories) {
    const icon = counts.passed === counts.total ? 'PASS' : 'FAIL';
    console.log(`${cat}: ${icon} (${counts.passed}/${counts.total})`);
  }

  const totalPassed = results.filter((r) => r.passed).length;
  const totalTests = results.length;

  console.log('\n' + '-'.repeat(66));
  console.log(`\nTOTAL: ${totalPassed}/${totalTests} tests passed\n`);

  if (totalPassed === totalTests) {
    console.log('OVERALL STATUS: READY FOR PRODUCTION');
  } else {
    console.log('OVERALL STATUS: FAILURES DETECTED');
    const failures = results.filter((r) => !r.passed);
    for (const f of failures) {
      console.log(`  FAIL: [${f.category}] ${f.name} - ${f.message}`);
    }
  }

  console.log('='.repeat(66));
  process.exit(totalPassed === totalTests ? 0 : 1);
}

main().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
