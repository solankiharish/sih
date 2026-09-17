const express = require('express');
const { readTable } = require('../utils/db');
const { verifyToken, allowRoles } = require('../middleware/auth');

const router = express.Router();

// GET /api/audit - admin only, full chain-of-custody log
router.get('/', verifyToken, allowRoles('admin'), (req, res) => {
  const logs = readTable('auditlogs').sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
  res.json({ logs });
});

module.exports = router;
