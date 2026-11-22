const { promisify } = require('node:util');
const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');

const scryptAsync = promisify(scrypt);
const SALT_LENGTH = 16;
const HASH_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

async function hashPassword(password) {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await scryptAsync(password, salt, HASH_LENGTH, SCRYPT_OPTIONS);
  return `scrypt$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
}

async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== 'string') {
    return false;
  }
  const [algorithm, saltValue, hashValue, extra] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !saltValue || !hashValue || extra !== undefined) {
    return false;
  }

  const salt = Buffer.from(saltValue, 'base64url');
  const expectedHash = Buffer.from(hashValue, 'base64url');
  if (salt.length !== SALT_LENGTH || expectedHash.length !== HASH_LENGTH) {
    return false;
  }

  const actualHash = await scryptAsync(password, salt, HASH_LENGTH, SCRYPT_OPTIONS);
  return timingSafeEqual(actualHash, expectedHash);
}

module.exports = { hashPassword, verifyPassword };
