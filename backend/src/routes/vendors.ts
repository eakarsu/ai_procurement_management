import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const data = await prisma.vendor.findMany({ where: { tenantId: req.user!.tenantId }, orderBy: { createdAt: 'desc' } });
    return res.json({ success: true, data });
  } catch (error) { return next(error); }
});

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const data = await prisma.vendor.findUnique({ where: { id_tenantId: { id: String(req.params.id), tenantId: req.user!.tenantId } } });
    return data ? res.json({ success: true, data }) : res.status(404).json({ success: false, message: 'Vendor not found' });
  } catch (error) { return next(error); }
});

router.post('/', requireRole('ADMIN', 'PROCUREMENT_MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const { name, email, phone, website, address, businessType, industryType } = req.body ?? {};
    if (!name || (email && !String(email).includes('@'))) return res.status(400).json({ success: false, message: 'Name and valid email are required' });
    const data = await prisma.vendor.create({ data: { name, email, phone, website, address, businessType, industryType, createdById: req.user!.id, tenantId: req.user!.tenantId } });
    return res.status(201).json({ success: true, data });
  } catch (error) { return next(error); }
});

router.put('/:id', requireRole('ADMIN', 'PROCUREMENT_MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const allowed = ['name', 'email', 'phone', 'website', 'address', 'businessType', 'industryType', 'qualificationStatus', 'isActive'];
    const update = Object.fromEntries(Object.entries(req.body ?? {}).filter(([key]) => allowed.includes(key)));
    const current = await prisma.vendor.findUnique({ where: { id_tenantId: { id: String(req.params.id), tenantId: req.user!.tenantId } } });
    if (!current) return res.status(404).json({ success: false, message: 'Vendor not found' });
    const data = await prisma.vendor.update({ where: { id_tenantId: { id: current.id, tenantId: current.tenantId } }, data: update });
    return res.json({ success: true, data });
  } catch (error) { return next(error); }
});

router.delete('/:id', requireRole('ADMIN', 'PROCUREMENT_MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const result = await prisma.vendor.deleteMany({ where: { id: String(req.params.id), tenantId: req.user!.tenantId } });
    return result.count ? res.status(204).send() : res.status(404).json({ success: false, message: 'Vendor not found' });
  } catch (error) { return next(error); }
});

export default router;
