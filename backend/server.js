require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { ensureTables, seedUsers } = require('./utils/seed');
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const auditRoutes = require('./routes/audit');

const app = express();
const PORT = process.env.PORT || 5000;

// Make sure data & upload directories exist
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

ensureTables();
seedUsers();

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/audit', auditRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'SIH26190 backend running.' });
});

// Serve the frontend (static HTML/CSS/JS) so the whole thing runs as one app
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// Generic error handler (e.g. multer file-too-large errors)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error.' });
});

app.listen(PORT, () => {
  console.log(`\n🔒 SIH26190 Secure Document Management System`);
  console.log(`   Backend running at http://localhost:${PORT}`);
  console.log(`   Demo logins:`);
  console.log(`     admin          / Admin@123`);
  console.log(`     investigator1  / Invest@123`);
  console.log(`     judge1         / Judge@123\n`);
});
