import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Generate via: node -e "console.log(crypto.randomBytes(32).toString('hex'))"
const getMasterKey = (): Buffer => {
  const key = process.env.ENCRYPTION_MASTER_KEY;
  if (!key || key.length !== 64) {
    throw new Error('ENCRYPTION_MASTER_KEY must be a 64-character hex string');
  }
  return Buffer.from(key, 'hex');
};

// Packs [ IV (16 bytes) | AuthTag (16 bytes) | Ciphertext ] into one Buffer
export const encrypt = (buffer: Buffer): Buffer => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getMasterKey(), iv);

  const encryptedText = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encryptedText]);
};

export const decrypt = (buffer: Buffer): Buffer => {
  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encryptedText = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, getMasterKey(), iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encryptedText), decipher.final()]);
};
