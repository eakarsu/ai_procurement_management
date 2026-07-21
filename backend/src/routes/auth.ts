import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function tokenFor(user: { id: string; email: string; role: string; tenantId: string }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return jwt.sign(user, secret, { expiresIn: '1h', issuer: 'ai-procurement-management', audience: 'procurement-api' });
}

router.post('/register', async (req, res, next) => {
  try {
    if (process.env.AUTH_MODE === 'oidc' || process.env.NODE_ENV === 'production') return res.status(403).json({ success: false, message: 'Local registration is disabled; use the configured identity provider' });
    const { email, password, firstName, lastName, organization } = req.body ?? {};
    if (!emailPattern.test(String(email)) || typeof password !== 'string' || password.length < 12 || !firstName || !lastName || typeof organization !== 'string' || organization.trim().length < 2) return res.status(400).json({ success: false, message: 'Valid email, names, organization, and a 12+ character password are required' });
    const user = await prisma.$transaction(async tx => {
      const tenant = await tx.tenant.create({ data: { name: organization.trim() } });
      return tx.user.create({ data: { email: email.toLowerCase(), password: await bcrypt.hash(password, 12), firstName, lastName, organization: organization.trim(), role: 'ADMIN', tenantId: tenant.id } });
    });
    return res.status(201).json({ success: true, token: tokenFor({ id: user.id, email: user.email, role: user.role, tenantId: user.tenantId }), user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId, organization: user.organization } });
  } catch (error: any) { if (error?.code === 'P2002') return res.status(409).json({ success: false, message: 'Email already registered' }); return next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    if (process.env.AUTH_MODE === 'oidc' || process.env.NODE_ENV === 'production') return res.status(403).json({ success: false, message: 'Local login is disabled; use the configured identity provider' });
    const { email, password } = req.body ?? {};
    const user = email ? await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } }) : null;
    if (!user || !user.isActive || typeof password !== 'string' || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return res.json({ success: true, token: tokenFor({ id: user.id, email: user.email, role: user.role, tenantId: user.tenantId }), user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId, organization: user.organization } });
  } catch (error) { return next(error); }
});

router.get('/me', authenticateToken, async (req: AuthRequest, res, next) => {
  try { const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, email: true, firstName: true, lastName: true, organization: true, role: true, isActive: true, tenantId: true } }); return user?.tenantId === req.user!.tenantId ? res.json({ success: true, user }) : res.status(404).json({ success: false, message: 'User not found' }); } catch (error) { return next(error); }
});

router.post('/users', authenticateToken, requireRole('ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const { email, password, firstName, lastName, role = 'USER', oidcSubject } = req.body ?? {};
    const allowedRoles = ['ADMIN', 'USER', 'PROCUREMENT_MANAGER', 'EVALUATOR', 'COMPLIANCE_OFFICER'];
    const oidcMode = process.env.AUTH_MODE === 'oidc';
    const generatedPassword = typeof password === 'string' && password ? password : require('crypto').randomBytes(32).toString('hex');
    if (!emailPattern.test(String(email)) || (!oidcMode && generatedPassword.length < 12) || !firstName || !lastName || !allowedRoles.includes(role)) return res.status(400).json({ success: false, message: 'Valid identity and role required' });
    const owner = await prisma.user.findUnique({ where: { id: req.user!.id }, include: { tenant: true } });
    if (!owner || owner.tenantId !== req.user!.tenantId) return res.status(403).json({ success: false, message: 'Tenant identity mismatch' });
    const user = await prisma.user.create({ data: { email: String(email).toLowerCase(), password: await bcrypt.hash(generatedPassword, 12), firstName, lastName, role, tenantId: owner.tenantId, organization: owner.tenant.name, oidcSubject: oidcSubject || null }, select: { id: true, email: true, role: true, tenantId: true } });
    return res.status(201).json({ success: true, user });
  } catch (error) { return next(error); }
});

export default router;
