import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();

export function parseTaskPriority(value: unknown): string {
  return value === 'LOW' || value === 'HIGH' ? value : 'NORMAL';
}
export function parseTaskStatus(value: unknown): string | null {
  return value === 'OPEN' || value === 'DONE' || value === 'CANCELLED' ? value : null;
}

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const status = parseTaskStatus(String(req.query.status || ''));
    const data = await prisma.staffTask.findMany({
      where: { tenantId: req.user!.tenantId, ...(status ? { status } : {}) },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return res.json({ success: true, data });
  } catch (error) { return next(error); }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title) return res.status(422).json({ success: false, message: 'title is required' });
    const dueAt = typeof req.body?.dueAt === 'string' && !Number.isNaN(Date.parse(req.body.dueAt)) ? new Date(req.body.dueAt) : null;
    const data = await prisma.staffTask.create({
      data: {
        title: title.slice(0, 200),
        description: typeof req.body?.description === 'string' ? req.body.description.slice(0, 2000) : null,
        priority: parseTaskPriority(req.body?.priority),
        dueAt, tenantId: req.user!.tenantId, userId: req.user!.id,
      },
    });
    return res.status(201).json({ success: true, data });
  } catch (error) { return next(error); }
});

router.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const status = req.body?.status === undefined ? undefined : parseTaskStatus(String(req.body.status));
    if (req.body?.status !== undefined && !status) return res.status(422).json({ success: false, message: 'status must be OPEN, DONE, or CANCELLED' });
    const existing = await prisma.staffTask.findFirst({ where: { id: String(req.params.id), tenantId: req.user!.tenantId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Task not found' });
    const patch: { status?: string; completedAt?: Date | null; title?: string; priority?: string } = {};
    if (status !== undefined && status !== null) { patch.status = status; patch.completedAt = status === 'DONE' ? new Date() : null; }
    if (typeof req.body?.title === 'string' && req.body.title.trim()) patch.title = req.body.title.trim().slice(0, 200);
    if (req.body?.priority !== undefined) patch.priority = parseTaskPriority(req.body.priority);
    const data = await prisma.staffTask.update({ where: { id: existing.id }, data: patch });
    return res.json({ success: true, data });
  } catch (error) { return next(error); }
});

export default router;
