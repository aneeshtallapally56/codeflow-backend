
import Redis from "ioredis";

let redis: Redis | null = null;

try {
  redis = new Redis(
    process.env.NODE_ENV === "production"
      ? process.env.REDIS_URL || "redis://localhost:6379"
      : "redis://localhost:6379"
  );

  redis.on('error', (err) => {
    console.warn('⚠️ Redis connection error:', err.message);
    redis = null;
  });

  redis.on('connect', () => {
    console.log('✅ Redis connected successfully');
  });
} catch (error) {
  console.warn('⚠️ Redis not available, some features will be disabled');
  redis = null;
}

// Helper functions to safely use Redis
export const redisGet = async (key: string) => {
  if (!redis) return null;
  try {
    return await redis.get(key);
  } catch (error) {
    console.warn('Redis get error:', error);
    return null;
  }
};

export const redisSet = async (key: string, value: string, ...args: any[]) => {
  if (!redis) return false;
  try {
    return await redis.set(key, value, ...args);
  } catch (error) {
    console.warn('Redis set error:', error);
    return false;
  }
};

export const redisSadd = async (key: string, ...members: string[]) => {
  if (!redis) return 0;
  try {
    return await redis.sadd(key, ...members);
  } catch (error) {
    console.warn('Redis sadd error:', error);
    return 0;
  }
};

export const redisSrem = async (key: string, ...members: string[]) => {
  if (!redis) return 0;
  try {
    return await redis.srem(key, ...members);
  } catch (error) {
    console.warn('Redis srem error:', error);
    return 0;
  }
};

export const redisSmembers = async (key: string) => {
  if (!redis) return [];
  try {
    return await redis.smembers(key);
  } catch (error) {
    console.warn('Redis smembers error:', error);
    return [];
  }
};

export const redisSismember = async (key: string, member: string) => {
  if (!redis) return false;
  try {
    return await redis.sismember(key, member);
  } catch (error) {
    console.warn('Redis sismember error:', error);
    return false;
  }
};

export const redisKeys = async (pattern: string) => {
  if (!redis) return [];
  try {
    return await redis.keys(pattern);
  } catch (error) {
    console.warn('Redis keys error:', error);
    return [];
  }
};

export const redisDel = async (key: string) => {
  if (!redis) return 0;
  try {
    return await redis.del(key);
  } catch (error) {
    console.warn('Redis del error:', error);
    return 0;
  }
};

export default redis;