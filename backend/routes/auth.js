const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { readTable, writeTable } = require('../utils/db');
const { logAction } = require('../utils/audit');
const { verifyToken, allowRoles } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const users = readTable('users');
  const user = users.find((u) => u.username === username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    fullName: user.fullName,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

  logAction({ user: payload, action: 'LOGIN', details: 'User logged in' });

  res.json({ token, user: payload });
});

// GET /api/auth/me  - current user info
router.get('/me', verifyToken, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/users - admin creates investigator/judge accounts
router.post('/users', verifyToken, allowRoles('admin'), (req, res) => {
  const { username, password, role, fullName } = req.body;

  if (!username || !password || !role || !fullName) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (!['admin', 'investigator', 'judge'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin, investigator, or judge.' });
  }

  const users = readTable('users');
  if (users.some((u) => u.username === username)) {
    return res.status(409).json({ error: 'Username already exists.' });
  }

  const newUser = {
    id: uuidv4(),
    username,
    password: bcrypt.hashSync(password, 10),
    role,
    fullName,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  writeTable('users', users);

  logAction({
    user: req.user,
    action: 'CREATE_USER',
    details: `Created ${role} account: ${username}`,
  });

  const { password: _pw, ...safeUser } = newUser;
  res.status(201).json({ user: safeUser });
});

// GET /api/auth/users - admin only, list all users
router.get('/users', verifyToken, allowRoles('admin'), (req, res) => {
  const users = readTable('users').map(({ password, ...rest }) => rest);
  res.json({ users });
});

module.exports = router;
