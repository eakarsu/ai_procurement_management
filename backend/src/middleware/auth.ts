import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request { user?: { id: string; email: string; role: string; tenantId: string } }
let jwksCache: { expires: number; keys: crypto.JsonWebKey[] } | null = null;

async function oidcIdentity(token: string) {
  const issuer = process.env.OIDC_ISSUER, audience = process.env.OIDC_AUDIENCE, jwksUrl = process.env.OIDC_JWKS_URL;
  if (!issuer || !audience || !jwksUrl) throw new Error('OIDC is not configured');
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || decoded.header.alg !== 'RS256' || !decoded.header.kid) throw new Error('Unsupported identity token');
  if (!jwksCache || jwksCache.expires < Date.now()) {
    const response = await fetch(jwksUrl, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Identity key retrieval failed');
    const body = await response.json() as { keys?: crypto.JsonWebKey[] };
    jwksCache = { keys: body.keys || [], expires: Date.now() + 300_000 };
  }
  const jwk = jwksCache.keys.find(key => key.kid === decoded.header.kid);
  if (!jwk) throw new Error('Identity signing key not found');
  const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const claims = jwt.verify(token, key, { algorithms: ['RS256'], issuer, audience }) as JwtPayload;
  if (!claims.sub || typeof claims.email !== 'string' || claims.email_verified !== true) throw new Error('Verified identity email required');
  let user = await prisma.user.findFirst({ where: { OR: [{ oidcSubject: claims.sub }, { email: claims.email.toLowerCase() }], isActive: true } });
  if (user && !user.oidcSubject) user = await prisma.user.update({ where: { id: user.id }, data: { oidcSubject: claims.sub } });
  if (!user) throw new Error('Identity is not provisioned');
  return { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) { res.status(401).json({ success: false, message: 'Access token required' }); return; }
  try {
    if (process.env.AUTH_MODE === 'oidc') req.user = await oidcIdentity(token);
    else {
      const secret = process.env.JWT_SECRET;
      if (!secret || secret.length < 32) throw new Error('Authentication is not configured');
      const claims = jwt.verify(token, secret, { issuer: 'ai-procurement-management', audience: 'procurement-api' }) as JwtPayload;
      const user = await prisma.user.findUnique({ where: { id: String(claims.id || '') } });
      if (!user?.isActive || user.tenantId !== claims.tenantId) throw new Error('Stale identity');
      req.user = { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId };
    }
    next();
  } catch { res.status(403).json({ success: false, message: 'Invalid or expired token' }); }
};

export const requireRole = (...roles: string[]) => (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) { res.status(401).json({ success: false, message: 'Authentication required' }); return; }
  if (!roles.includes(req.user.role)) { res.status(403).json({ success: false, message: 'Insufficient permissions' }); return; }
  next();
};
