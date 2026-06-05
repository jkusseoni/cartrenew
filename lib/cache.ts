import IORedis from 'ioredis';

// Next.js hot-reload safety ke liye global initialization
const globalForRedisCache = global as unknown as {
  cacheRedis: IORedis | undefined;
};

// 1. Redis Connection for Caching
const redis =
  globalForRedisCache.cacheRedis ||
  new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

if (process.env.NODE_ENV !== 'production') globalForRedisCache.cacheRedis = redis;

/**
 * Custom caching helper function
 * @param key Redis cache store key name
 * @param fetchFn Target function jo DB hit marega agar cache miss hua toh
 * @param ttlSeconds Cache retention time (seconds me) - Default: 1 ghanta (3600s)
 */
export async function getOrSetCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number = 3600
): Promise<T> {
  try {
    // 2. Pehle cache me check karein
    const cachedData = await redis.get(key);
    
    if (cachedData) {
      console.log(`⚡ [Redis Cache] HIT for key: ${key}`);
      return JSON.parse(cachedData) as T;
    }

    console.log(`🐢 [Redis Cache] MISS for key: ${key}. Fetching fresh data...`);
    
    // 3. Agar data nahi mila toh raw function call karein (Database hit)
    const freshData = await fetchFn();

    // 4. Fresh data ko Redis me save karein expiration (TTL) ke sath
    await redis.setex(key, ttlSeconds, JSON.stringify(freshData));
    
    return freshData;
  } catch (error) {
    console.error(`⚠️ [Redis Cache] Error occurred for key: ${key}`, error);
    // Fail-safe: Agar Redis offline hai toh direct raw function bypass karein taaki app crash na ho
    return await fetchFn();
  }
}

// Cache clear karne ke liye helper function (Jaise pricing update hone par call hoga)
export async function invalidateCache(key: string): Promise<void> {
  try {
    await redis.del(key);
    console.log(`🧹 [Redis Cache] Cache invalidated for key: ${key}`);
  } catch (error) {
    console.error(`❌ [Redis Cache] Failed to invalidate key: ${key}`, error);
  }
}