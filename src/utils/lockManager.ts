import { redisSet, redisGet, redisDel } from "./redis";

const LOCK_PREFIX = "file-lock:";

export const lockFile = async (path: string, userId: string) => {
  const key = `${LOCK_PREFIX}${path}`;
  const success = await redisSet(key, userId, "NX", "EX", 300);
  return success === "OK";
};

export const unlockFile = async (path: string, userId: string) => {
  const key = `${LOCK_PREFIX}${path}`;
  const current = await redisGet(key);
  if (current === userId) {
    await redisDel(key);
  }
};

export const getFileLock = async (path: string) => {
  const key = `file-lock:${path}`;
  return await redisGet(key); // returns userId or null
};