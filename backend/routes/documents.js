const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readTable, writeTable } = require('../utils/db');
const { encryptBuffer, decryptBuffer, sha256 } = require('../utils/crypto');
const { logAction } = require('../utils/audit');
const { verifyToken, allowRoles } = require('../middleware/auth');

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

// Keep the file in memory so we can encrypt it before ever touching disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB demo limit
});

// POST /api/documents/upload  (investigator only)
router.post(
  '/upload',
  verifyToken,
  allowRoles('investigator', 'admin'),
  upload.single('file'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    const { caseId, title, description } = req.body;
    if (!caseId || !title) {
      return res.status(400).json({ error: 'caseId and title are required.' });
    }

    // 1. Compute SHA-256 hash of the ORIGINAL file -> integrity fingerprint
    const originalHash = sha256(req.file.buffer);

    // 2. Encrypt the file contents with AES-256-GCM
    const { encryptedData, iv, authTag } = encryptBuffer(req.file.buffer);

    // 3. Persist only the encrypted bytes to disk
    const storedFileName = `${uuidv4()}.enc`;
    fs.writeFileSync(path.join(UPLOAD_DIR, storedFileName), encryptedData);

    // 4. Save metadata (never store the raw file or plaintext key material)
    const documents = readTable('documents');
    const doc = {
      id: uuidv4(),
      caseId,
      title,
      description: description || '',
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      storedFileName,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      hash: originalHash,
      uploadedById: req.user.id,
      uploadedByName: req.user.fullName,
      uploadedByRole: req.user.role,
      timestamp: new Date().toISOString(),
    };
    documents.push(doc);
    writeTable('documents', documents);

    logAction({
      user: req.user,
      action: 'UPLOAD_DOCUMENT',
      documentId: doc.id,
      details: `Uploaded "${title}" for case ${caseId} (SHA-256: ${originalHash.slice(0, 16)}...)`,
    });

    const { iv: _iv, authTag: _at, storedFileName: _sfn, ...safeDoc } = doc;
    res.status(201).json({ document: safeDoc });
  }
);

// GET /api/documents  - list documents (role-aware)
router.get('/', verifyToken, (req, res) => {
  const documents = readTable('documents');

  // Admin & judge can see everything (judges review evidence across cases);
  // investigators only see what they personally uploaded.
  let visible = documents;
  if (req.user.role === 'investigator') {
    visible = documents.filter((d) => d.uploadedById === req.user.id);
  }

  const safe = visible
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .map(({ iv, authTag, storedFileName, ...rest }) => rest);

  res.json({ documents: safe });
});

// GET /api/documents/:id/view - decrypt, verify integrity, stream back
router.get('/:id/view', verifyToken, (req, res) => {
  const documents = readTable('documents');
  const doc = documents.find((d) => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });

  if (req.user.role === 'investigator' && doc.uploadedById !== req.user.id) {
    return res.status(403).json({ error: 'You can only access documents you uploaded.' });
  }

  const encPath = path.join(UPLOAD_DIR, doc.storedFileName);
  if (!fs.existsSync(encPath)) {
    return res.status(410).json({ error: 'Encrypted file missing from storage.' });
  }

  try {
    const encryptedData = fs.readFileSync(encPath);
    const iv = Buffer.from(doc.iv, 'hex');
    const authTag = Buffer.from(doc.authTag, 'hex');
    const decrypted = decryptBuffer(encryptedData, iv, authTag);

    // Integrity check: re-hash the decrypted plaintext and compare
    const currentHash = sha256(decrypted);
    const integrityOk = currentHash === doc.hash;

    logAction({
      user: req.user,
      action: 'VIEW_DOCUMENT',
      documentId: doc.id,
      details: `Viewed "${doc.title}" — integrity ${integrityOk ? 'VERIFIED' : 'FAILED'}`,
    });

    if (!integrityOk) {
      // GCM auth tag would normally throw first, but we double check the
      // logical hash too and refuse to serve tampered evidence either way.
      return res.status(409).json({
        error: 'Integrity check failed. Document may have been tampered with.',
      });
    }

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('X-Document-Hash', doc.hash);
    res.setHeader('X-Integrity-Verified', 'true');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${doc.originalName}"`
    );
    res.send(decrypted);
  } catch (err) {
    // AES-GCM auth tag mismatch throws here -> tampering / corruption
    logAction({
      user: req.user,
      action: 'VIEW_DOCUMENT_FAILED',
      documentId: doc.id,
      details: `Decryption/integrity failure: ${err.message}`,
    });
    res.status(409).json({
      error: 'Decryption failed. File integrity could not be verified (possible tampering).',
    });
  }
});

// GET /api/documents/:id/verify - just check integrity without returning file
router.get('/:id/verify', verifyToken, (req, res) => {
  const documents = readTable('documents');
  const doc = documents.find((d) => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });

  const encPath = path.join(UPLOAD_DIR, doc.storedFileName);
  try {
    const encryptedData = fs.readFileSync(encPath);
    const iv = Buffer.from(doc.iv, 'hex');
    const authTag = Buffer.from(doc.authTag, 'hex');
    const decrypted = decryptBuffer(encryptedData, iv, authTag);
    const currentHash = sha256(decrypted);
    res.json({
      documentId: doc.id,
      storedHash: doc.hash,
      recomputedHash: currentHash,
      integrityVerified: currentHash === doc.hash,
    });
  } catch (err) {
    res.json({
      documentId: doc.id,
      storedHash: doc.hash,
      recomputedHash: null,
      integrityVerified: false,
      error: err.message,
    });
  }
});

module.exports = router;
