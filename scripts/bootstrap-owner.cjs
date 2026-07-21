const crypto = require('node:crypto');
const bcrypt = require('../backend/node_modules/bcryptjs');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

if (process.env.ALLOW_IDENTITY_BOOTSTRAP !== '1') throw new Error('Set ALLOW_IDENTITY_BOOTSTRAP=1 for this one-time operation');
for (const key of ['DATABASE_URL', 'TENANT_NAME', 'OWNER_EMAIL', 'OWNER_NAME', 'OIDC_SUBJECT']) if (!process.env[key]) throw new Error(`${key} is required`);
const [firstName, ...rest] = process.env.OWNER_NAME.trim().split(/\s+/);
const prisma = new PrismaClient();
(async () => {
  const existing = await prisma.user.findFirst({ where: { OR: [{ email: process.env.OWNER_EMAIL.toLowerCase() }, { oidcSubject: process.env.OIDC_SUBJECT }] } });
  if (existing) throw new Error('Owner email or OIDC subject is already provisioned');
  const user = await prisma.$transaction(async tx => {
    const tenant = await tx.tenant.create({ data: { name: process.env.TENANT_NAME } });
    return tx.user.create({ data: { email: process.env.OWNER_EMAIL.toLowerCase(), password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12), firstName, lastName: rest.join(' ') || 'Owner', role: 'ADMIN', organization: tenant.name, tenantId: tenant.id, oidcSubject: process.env.OIDC_SUBJECT } });
  });
  console.log(JSON.stringify({ event: 'tenant_owner_bootstrapped', tenantId: user.tenantId, userId: user.id, email: user.email }));
})().finally(() => prisma.$disconnect());
