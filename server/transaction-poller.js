// server/transaction-poller.js
// Scaffold for a transaction poller that will apply the fee logic from app/fee.js

const { calculateFees } = require('../app/fee');

async function processTransaction(transaction) {
  // transaction should include at least { id, amountCents }
  if (!transaction || typeof transaction.amountCents !== 'number') {
    throw new Error('Invalid transaction');
  }

  const fees = calculateFees(transaction.amountCents);

  // TODO: integrate with payments provider (Stripe/Webhook), DB, and accounting workflows
  // - mark amounts to company profit, tax reserve, and budget (CEO allowance)
  // - emit events for downstream processors

  console.log(`Processed txn ${transaction.id}: amount=${transaction.amountCents} cents, fees=${fees.totalFeeCents} cents`);
  return { transactionId: transaction.id, fees };
}

async function startPoller(intervalMs = 60000) {
  console.log('Transaction poller started (scaffold). Interval:', intervalMs);
  // TODO: implement polling logic to fetch new transactions and call processTransaction
}

module.exports = { startPoller, processTransaction };
