// app/fee.js
// Fee module for VisioSquad

const FLAT_FEE = 1.00; // USD
const PROCESSING_RATE = 0.03; // 3%

function calculateFee(amountCents) {
  // amountCents: integer cents
  const amount = amountCents / 100;
  const variable = amount * PROCESSING_RATE;
  const total = FLAT_FEE + variable;
  // Return total fee in cents, rounded up to nearest cent
  return Math.ceil(total * 100);
}

module.exports = {
  FLAT_FEE,
  PROCESSING_RATE,
  calculateFee,
};
