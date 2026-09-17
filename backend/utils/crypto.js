const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.AES_SECRET_KEY, 'hex'); // 32 bytes

if (KEY.length !== 32) {
  throw new Error(
    'AES_SECRET_KEY in .env must be a 64-character hex string (32 bytes) for AES-256.'
  );
}

/**
 * Encrypts a Buffer using AES-256-GCM.
 * Returns { encryptedData, iv, authTag } all as Buffers.
 */
function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { encryptedData: encrypted, iv, authTag };
}
const secretKey = process.env.ENCRYPTION_KEY;

if (!secretKey) {
  throw new Error("ENCRYPTION_KEY environment variable is not defined.");
}

const keyBuffer = Buffer.from(secretKey, 'hex'); // or 'utf-8'
/**
 * Decrypts a Buffer using AES-256-GCM.
 */
function decryptBuffer(encryptedData, iv, authTag) {
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
}

/**
 * SHA-256 hash of a Buffer -> hex string.
 * Used as the document's integrity fingerprint (chain-of-custody proof).
 * In the final submission this hash is what gets anchored on-chain.
 */
function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

module.exports = { encryptBuffer, decryptBuffer, sha256 };
