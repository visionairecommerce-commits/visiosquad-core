const { calculateFees } = require('../app/fee');

test('calculateFees for $100', () => {
  const r = calculateFees(100);
  expect(r.percentFee).toBeCloseTo(3.00);
  expect(r.flatFee).toBe(4.00);
  expect(r.totalFee).toBeCloseTo(7.00);
  expect(r.allocations.ceo).toBe(1.00);
  expect(r.allocations.taxReserve).toBe(1.00);
  expect(r.allocations.companyProfit).toBe(2.00);
});
