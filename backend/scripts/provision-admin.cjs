const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  if (process.env.BOOTSTRAP_ACKNOWLEDGEMENT !== 'create-initial-admin') {
    throw new Error('BOOTSTRAP_ACKNOWLEDGEMENT=create-initial-admin is required');
  }
  const email = String(process.env.PROVISION_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.PROVISION_ADMIN_PASSWORD || '');
  const name = String(process.env.PROVISION_ADMIN_NAME || '').trim();
  const company = String(process.env.PROVISION_COMPANY_NAME || '').trim();
  if (!email.includes('@') || password.length < 12 || !name || !company) {
    throw new Error('PROVISION_ADMIN_EMAIL, PROVISION_ADMIN_PASSWORD (12+ characters), PROVISION_ADMIN_NAME, and PROVISION_COMPANY_NAME are required');
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const parts = name.split(/\s+/);
    const firstName = parts.shift();
    const lastName = parts.join(' ') || 'Administrator';
    const user = await prisma.user.update({ where: { email }, data: {
      password: await bcrypt.hash(password, 10), firstName, lastName,
      role: 'ADMIN', organization: company, isActive: true,
    } });
    console.log(JSON.stringify({ event: 'initial_admin_updated', userId: user.id }));
    return;
  }
  const parts = name.split(/\s+/);
  const firstName = parts.shift();
  const lastName = parts.join(' ') || 'Administrator';
  const user = await prisma.$transaction(async (transaction) => {
    const tenant = await transaction.tenant.create({ data: { name: company } });
    return transaction.user.create({
      data: {
        email,
        password: await bcrypt.hash(password, 10),
        firstName,
        lastName,
        role: 'ADMIN',
        organization: company,
        tenantId: tenant.id,
      },
    });
  });
  console.log(JSON.stringify({ event: 'initial_admin_created', userId: user.id }));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
