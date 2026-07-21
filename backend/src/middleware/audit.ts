import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from './auth';

export function auditMutation(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!['POST','PUT','PATCH','DELETE'].includes(req.method)) return next();
  const original = res.json.bind(res);
  res.json = (body: unknown) => {
    if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
      const parts = req.path.split('/').filter(Boolean);
      prisma.auditLog.create({ data: { userId: req.user.id, tenantId: req.user.tenantId, action: req.method, entityType: req.baseUrl.split('/').pop() || 'unknown', entityId: parts[0] || (body as any)?.data?.id || 'collection', newValues: req.method === 'DELETE' ? undefined : (req.body ?? {}), oldValues: req.method === 'DELETE' ? (req.body ?? {}) : undefined, ipAddress: req.ip || null, userAgent: req.headers['user-agent'] || null } }).catch((error: unknown) => console.error('Audit write failed', error));
    }
    return original(body);
  };
  next();
}
