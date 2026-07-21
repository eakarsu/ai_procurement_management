import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest, requireRole } from '../middleware/auth';

const router = Router();
const transitions: Record<string, string[]> = {
  SUBMITTED: ['UNDER_EVALUATION', 'REJECTED'],
  UNDER_EVALUATION: ['EVALUATED', 'REJECTED'],
  EVALUATED: ['AWARDED', 'REJECTED'],
};

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const data = await prisma.bid.findMany({ where: { tenantId: req.user!.tenantId }, include: { vendor: true }, orderBy: { submittedAt: 'desc' } });
    return res.json({ success: true, data });
  } catch (error) { return next(error); }
});

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const data = await prisma.bid.findUnique({ where: { id_tenantId: { id: String(req.params.id), tenantId: req.user!.tenantId } }, include: { vendor: true, evaluations: true } });
    return data ? res.json({ success: true, data }) : res.status(404).json({ success: false, message: 'Bid not found' });
  } catch (error) { return next(error); }
});

router.post('/', requireRole('ADMIN', 'PROCUREMENT_MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const { title, description, budget, proposedAmount, vendorId, proposedTimeline, technicalApproach } = req.body ?? {};
    const amount = Number(proposedAmount ?? budget);
    if (!title || !vendorId || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: 'Title, vendor, and a positive amount are required' });
    const tenantId = req.user!.tenantId;
    const vendor = await prisma.vendor.findUnique({ where: { id_tenantId: { id: vendorId, tenantId } } });
    if (!vendor?.isActive) return res.status(409).json({ success: false, message: 'Active tenant vendor required' });
    const data = await prisma.bid.create({ data: { title, description, proposedAmount: amount, proposedTimeline: proposedTimeline ? Number(proposedTimeline) : null, technicalApproach, vendorId, tenantId, status: 'SUBMITTED' } });
    return res.status(201).json({ success: true, data });
  } catch (error) { return next(error); }
});

router.patch('/:id/status', requireRole('ADMIN', 'PROCUREMENT_MANAGER', 'EVALUATOR'), async (req: AuthRequest, res, next) => {
  try {
    const tenantId = req.user!.tenantId;
    const current = await prisma.bid.findUnique({ where: { id_tenantId: { id: String(req.params.id), tenantId } } });
    const target = String(req.body?.status ?? '');
    if (!current) return res.status(404).json({ success: false, message: 'Bid not found' });
    if (!transitions[current.status]?.includes(target)) return res.status(409).json({ success: false, message: 'Invalid bid status transition' });
    const data = await prisma.bid.update({ where: { id_tenantId: { id: current.id, tenantId } }, data: { status: target as never, ...(target === 'EVALUATED' ? { evaluatedAt: new Date() } : {}) } });
    return res.json({ success: true, data });
  } catch (error) { return next(error); }
});

router.delete('/:id', requireRole('ADMIN', 'PROCUREMENT_MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const result = await prisma.bid.deleteMany({ where: { id: String(req.params.id), tenantId: req.user!.tenantId } });
    return result.count ? res.status(204).send() : res.status(404).json({ success: false, message: 'Bid not found' });
  } catch (error) { return next(error); }
});

export default router;
