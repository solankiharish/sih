const { v4: uuidv4 } = require('uuid');
const { readTable, writeTable } = require('./db');

/**
 * Records an audit trail entry. This is the "chain of custody" log for
 * every action taken on a document. In the final submission, the hash
 * of each log entry can be anchored on-chain for tamper-evidence.
 */
function logAction({ user, action, documentId = null, details = '' }) {
  const logs = readTable('auditlogs');
  const entry = {
    id: uuidv4(),
    userId: user.id,
    username: user.username,
    role: user.role,
    action, // e.g. LOGIN, UPLOAD_DOCUMENT, VIEW_DOCUMENT, DOWNLOAD_DOCUMENT
    documentId,
    details,
    timestamp: new Date().toISOString(),
  };
  logs.push(entry);
  writeTable('auditlogs', logs);
  return entry;
}

module.exports = { logAction };
