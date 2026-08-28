import { pbkdf2Sync, randomBytes } from 'node:crypto';

const password = process.env.MORAN_ADMIN_PASSWORD;
if (!password || password.length < 12) {
  console.error('請先透過 MORAN_ADMIN_PASSWORD 環境變數提供至少 12 個字元的管理密碼。');
  process.exit(1);
}
// Cloudflare Workers Web Crypto currently accepts at most 100,000 PBKDF2 iterations.
const iterations = 100_000;
const salt = randomBytes(18);
const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
const encode = value => value.toString('base64url');
console.log(`pbkdf2-sha256$${iterations}$${encode(salt)}$${encode(hash)}`);
