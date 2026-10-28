import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const cost = 32768;
const blockSize = 8;
const parallelization = 3;
const keyLength = 64;

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, {
      N: cost,
      r: blockSize,
      p: parallelization,
      maxmem: 64 * 1024 * 1024,
    }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt);
  return `scrypt$${cost}$${blockSize}$${parallelization}$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  const [algorithm, storedCost, storedBlockSize, storedParallelization, salt, key] = parts;

  if (parts.length !== 6 || algorithm !== "scrypt" || storedCost !== String(cost)
    || storedBlockSize !== String(blockSize) || storedParallelization !== String(parallelization)
    || !salt || !/^[a-f0-9]{32}$/.test(salt) || !key || !/^[a-f0-9]{128}$/.test(key)) {
    return false;
  }

  const actual = await derive(password, salt);
  return timingSafeEqual(actual, Buffer.from(key, "hex"));
}
