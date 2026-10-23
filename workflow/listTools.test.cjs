const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
// Requires the compiled backend (run `npx tsc` in backend/ first).
const { filterVendors, toCsv } = require('../backend/dist/lib/listTools.js');
const { vendorRiskFallback, bidComparisonFallback, complianceGapsFallback } = require('../backend/dist/services/aiFallback.js');
const { parseTaskPriority, parseTaskStatus } = require('../backend/dist/routes/tasks.js');

const vendors = [
  { id: 'v1', name: 'Acme Supplies', email: 'a@example.com', industryType: 'IT', qualificationStatus: 'QUALIFIED', isActive: true, riskLevel: 'LOW', overallScore: 0 },
  { id: 'v2', name: 'Beta Parts', email: 'b@example.com', industryType: 'Manufacturing', qualificationStatus: 'PENDING', isActive: false, riskLevel: 'HIGH' },
];

test('search and filter narrow the vendor list', () => {
  assert.equal(filterVendors(vendors, { q: 'acme' }).length, 1);
  assert.equal(filterVendors(vendors, { qualificationStatus: 'PENDING' })[0].id, 'v2');
  assert.equal(filterVendors(vendors, {}).length, 2);
});

test('CSV export preserves false and zero values', () => {
  const csv = toCsv(vendors);
  assert.ok(csv.includes('Acme Supplies,a@example.com,IT,QUALIFIED,true,LOW'));
  assert.ok(toCsv([{ name: 'Zero', score: 0 }], ['name', 'score']).includes('Zero,0'));
});

test('deterministic insights are labelled and preserve falsy values', () => {
  const risk = vendorRiskFallback(vendors[0], [{ vendorId: 'v1' }]);
  assert.equal(risk.aiGenerated, false);
  assert.equal(risk.sections.find((s) => s.title === 'Overall score').detail, 0);
  assert.equal(bidComparisonFallback([{ id: 'b1', title: 'Bid A', proposedAmount: 500 }]).aiGenerated, false);
  assert.equal(complianceGapsFallback(vendors).sections.find((s) => s.title === 'Inactive vendors').detail, 1);
});

test('task helpers validate strictly and routes stay behind auth', () => {
  assert.equal(parseTaskPriority('HIGH'), 'HIGH');
  assert.equal(parseTaskPriority('urgent'), 'NORMAL');
  assert.equal(parseTaskStatus('DONE'), 'DONE');
  assert.equal(parseTaskStatus('DELETED'), null);
  const index = fs.readFileSync(path.join(__dirname, '../backend/src/index.ts'), 'utf8');
  assert.ok(index.includes("'/api/tasks', authenticateToken"));
  assert.ok(index.includes("'/api/ai-insights', authenticateToken"));
});
