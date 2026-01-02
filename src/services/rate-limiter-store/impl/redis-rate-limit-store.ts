import { createClient, RedisClientType } from 'redis';
import { IRateLimitStore } from '@rate-limiter/rate-limit-store.interface';

export class RedisRateLimiterStore implements IRateLimitStore {
    private client: RedisClientType;

    constructor(url: string) {
        this.client = createClient({ url });
        this.client.on('error', (err) => console.error('Redis Client Error', err));
        this.client.connect().catch(err => console.error('Redis Connection Error', err));
    }

    private getKey(token: string, today: string): string {
        return `rate-limit:${token}:${today}`;
    }

    async getWordCount(token: string, today: string): Promise<number> {
        const key = this.getKey(token, today);
        const count = await this.client.get(key);
        return count ? parseInt(count, 10) : 0;
    }

    async incrementWordCount(token: string, wordCount: number, today: string): Promise<void> {
        const key = this.getKey(token, today);
        // INCRBY creates the key if it doesn't exist
        await this.client.incrBy(key, wordCount);
        // Set expiration to 24 hours if it's a new key or just to be safe
        await this.client.expire(key, 86400); 
    }

    async resetStore(): Promise<void> {
        // This is mainly for testing or admin purposes. 
        // In a real Redis store, you might want to FLUSHDB or just delete specific keys.
        await this.client.flushDb();
    }

    async close(): Promise<void> {
        await this.client.quit();
    }
}
