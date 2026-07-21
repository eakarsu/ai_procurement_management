const test = require('node:test');
const assert = require('node:assert/strict');
const { validateBid, transitionBid } = require('./bidLifecycle.cjs');
test('accepts a persisted bid command with a positive budget', () => assert.equal(validateBid({title:'RFP',vendorId:'v1',budget:'42'}).budget, 42));
test('rejects malformed and non-positive bids', () => assert.throws(() => validateBid({title:'RFP',vendorId:'v1',budget:0}), /invalid bid/));
test('enforces bid lifecycle and role boundary', () => { assert.equal(transitionBid('SUBMITTED','UNDER_EVALUATION','EVALUATOR'),'UNDER_EVALUATION'); assert.throws(() => transitionBid('SUBMITTED','AWARDED','ADMIN'), /invalid transition/); assert.throws(() => transitionBid('SUBMITTED','REJECTED','USER'), /forbidden/); });
