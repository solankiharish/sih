const bcrypt = require('bcryptjs');
const { readTable, writeTable } = require('./db');

function seedUsers() {
  const users = readTable('users');
  if (users.length > 0) return; // already seeded

  const defaultUsers = [
    {
      id: 'u-admin-001',
      username: 'admin',
      password: bcrypt.hashSync('Admin@123', 10),
      role: 'admin',
      fullName: 'System Administrator',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'u-inv-001',
      username: 'investigator1',
      password: bcrypt.hashSync('Invest@123', 10),
      role: 'investigator',
      fullName: 'R. Sharma (Investigating Officer)',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'u-judge-001',
      username: 'judge1',
      password: bcrypt.hashSync('Judge@123', 10),
      role: 'judge',
      fullName: 'Hon. Justice K. Verma',
      createdAt: new Date().toISOString(),
    },
  ];

  writeTable('users', defaultUsers);
  console.log('Seeded default demo users: admin / investigator1 / judge1');
}

function ensureTables() {
  const tables = ['users', 'documents', 'auditlogs'];
  tables.forEach((t) => {
    const existing = readTable(t);
    if (!Array.isArray(existing)) writeTable(t, []);
  });
}

module.exports = { seedUsers, ensureTables };
