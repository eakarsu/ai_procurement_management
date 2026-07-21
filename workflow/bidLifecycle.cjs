const transitions = { SUBMITTED:['UNDER_EVALUATION','REJECTED'], UNDER_EVALUATION:['EVALUATED','REJECTED'], EVALUATED:['AWARDED','REJECTED'] };
function validateBid(input) {
  const amount = Number(input?.budget);
  if (!input?.title || !input?.vendorId || !Number.isFinite(amount) || amount <= 0) throw new Error('invalid bid');
  return { ...input, budget: amount };
}
function transitionBid(status, target, role) {
  if (!['ADMIN','PROCUREMENT_MANAGER','EVALUATOR'].includes(role)) throw new Error('forbidden');
  if (!transitions[status]?.includes(target)) throw new Error('invalid transition');
  return target;
}
module.exports = { validateBid, transitionBid };
