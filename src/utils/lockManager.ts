import redisClient from "./redis";

const LOCK_PREFIX = "file-lock:";

export const lockFile = async (path: string, userId: string) => {
  const key = `${LOCK_PREFIX}${path}`;
  const success = await (redisClient as any).set(key, userId, "NX", "EX", 300);
  return success === "OK";
};

export const unlockFile = async (path: string, userId: string) => {
  const key = `${LOCK_PREFIX}${path}`;
  const current = await redisClient.get(key);
  if (current === userId) {
    await redisClient.del(key);
  }
};

export const getFileLock = async (path: string) => {
  const key = `file-lock:${path}`;
  return await redisClient.get(key); // returns userId or null
};