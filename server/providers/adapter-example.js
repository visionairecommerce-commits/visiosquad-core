/*
 server/providers/adapter-example.js
 Example adapter for the transaction poller.
 Implements two functions consumed by server/transaction-poller.js:
   - fetchPendingTransactions(limit)
   - saveProcessedTransaction(processed)

 The adapter is intentionally simple and file-based/in-memory so teams can
 swap it for a DB or payment-provider-backed adapter later.

 Fee split architecture: every processed transaction receives a flat $4.00
 split into: $1.00 (budget), $1.00 (taxReserve), $2.00 (companyProfit).
 The adapter does not re-calculate the fee math here (poller uses app/fee.js)
 but persists and exposes the breakdown so downstream systems can reconcile.
*/

'use strict';

const path = require('path');
const fs = require('fs');

// Simple JSON file acting as our "DB" for the example adapter.
// NOTE: this is for local/dev only. Replace with a real DB in production.
const DB_FILE = path.join(__dirname, '..', '..', 'attached_assets', 'adapter-example-db.json');

function ensureDb() {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ pending: [], processed: [] }, null, 2));
  } catch (err) {
    // best-effort; poller will surface errors
    console.error('adapter-example ensureDb error', err);
  }
}

function readDb() {
  ensureDb();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    console.error('adapter-example readDb error', err);
    return { pending: [], processed: [] };
  }
}

function writeDb(db) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('adapter-example writeDb error', err);
  }
}

/**
 * Add a pending transaction (helper for local testing / fixtures)
 * tx should be { id, amount, currency, playerId?, eventId?, createdAt }
 */
function addPendingTransaction(tx) {
  const db = readDb();
  db.pending.push(tx);
  writeDb(db);
  return tx;
}

/**
 * fetchPendingTransactions(limit)
 * Returns up to `limit` pending transactions and marks them as "in-flight" by
 * removing them from the pending list (so subsequent calls won't return them).
 */
async function fetchPendingTransactions(limit = 100) {
  const db = readDb();
  const items = db.pending.slice(0, limit);
  // remove returned items from pending
  db.pending = db.pending.slice(items.length);
  writeDb(db);
  return items;
}

/**
 * saveProcessedTransaction(processed)
 * Persist processed transactions (including fee breakdown). The poller will
 * call this after calculating fees. processed should include:
 *   { id, originalAmount, percentagePortion, flatPortion, feeTotal, totalCharge, flatBreakdown, eventId?, playerId?, processedAt }
 *
 * We persist and also expose an aggregated ledger file for manual inspection.
 */
async function saveProcessedTransaction(processed) {
  const db = readDb();
  db.processed = db.processed || [];
  db.processed.push(processed);
  writeDb(db);

  // Update a simple ledger summary (aggregated by eventId)
  const ledger = {};
  for (const p of db.processed) {
    const eventId = p.eventId || '__no_event__';
    if (!ledger[eventId]) ledger[eventId] = { eventId, transactionCount: 0, totalBase: 0, totalFee: 0, totalCompanyProfit: 0 };
    const agg = ledger[eventId];
    agg.transactionCount += 1;
    agg.totalBase = Math.round((agg.totalBase + (p.originalAmount || 0)) * 100) / 100;
    agg.totalFee = Math.round((agg.totalFee + (p.feeTotal || 0)) * 100) / 100;
    const companyProfit = (p.flatBreakdown && p.flatBreakdown.companyProfit) || 0;
    agg.totalCompanyProfit = Math.round((agg.totalCompanyProfit + companyProfit) * 100) / 100;
  }

  const ledgerPath = path.join(__dirname, '..', '..', 'attached_assets', 'adapter-example-ledger.json');
  try { fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), 'utf8'); } catch (err) { console.error('write ledger error', err); }

  return processed;
}

module.exports = {
  // Helpers
  addPendingTransaction,
  // Adapter contract used by transaction-poller
  fetchPendingTransactions,
  saveProcessedTransaction
};
