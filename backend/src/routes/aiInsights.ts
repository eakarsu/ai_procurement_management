import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { vendorRiskFallback, bidComparisonFallback, complianceGapsFallback } from '../services/aiFallback';

const router = Router();

// Deterministic, labelled insights over the tenant's own records (offline-safe).
router.post('/vendor-risk', async (req: AuthRequest, res, next) => {
  try {
    const vendor = await prisma.vendor.findUnique({ where: { id_tenantId: { id: String(req.body?.vendorId || ''), tenantId: req.user!.tenantId } } });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    const bids = await prisma.bid.findMany({ where: { tenantId: req.user!.tenantId } });
    return res.json({ success: true, data: vendorRiskFallback(vendor as unknown as Record<string, unknown>, bids as unknown as Record<string, unknown>[]) });
  } catch (error) { return next(error); }
});

router.post('/bid-comparison', async (req: AuthRequest, res, next) => {
  try {
    const bids = await prisma.bid.findMany({ where: { tenantId: req.user!.tenantId }, orderBy: { submittedAt: 'desc' }, take: 200 });
    return res.json({ success: true, data: bidComparisonFallback(bids as unknown as Record<string, unknown>[]) });
  } catch (error) { return next(error); }
});

router.post('/compliance-gaps', async (req: AuthRequest, res, next) => {
  try {
    const vendors = await prisma.vendor.findMany({ where: { tenantId: req.user!.tenantId }, take: 500 });
    return res.json({ success: true, data: complianceGapsFallback(vendors as unknown as Record<string, unknown>[]) });
  } catch (error) { return next(error); }
});

export default router;
