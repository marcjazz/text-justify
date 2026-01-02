import { IRateLimitStore } from '../services/rate-limiter-store/rate-limit-store.interface';
import { InMemoryRateLimiterStore } from '../services/rate-limiter-store/impl/in-memory-rate-limit-store';
import { RedisRateLimiterStore } from '../services/rate-limiter-store/impl/redis-rate-limit-store';

// Mock Redis client
const mockRedisClient = {
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    incrBy: jest.fn(),
    expire: jest.fn(),
    flushDb: jest.fn(),
    quit: jest.fn(),
};

jest.mock('redis', () => ({
    createClient: jest.fn(() => mockRedisClient),
}));

function runRateLimitStoreTests(
    implementationName: string,
    setup: () => IRateLimitStore | Promise<IRateLimitStore>,
    teardown?: (store: IRateLimitStore) => Promise<void>
) {
    describe(`${implementationName}`, () => {
        let store: IRateLimitStore;

        beforeEach(async () => {
            jest.clearAllMocks();
            store = await setup();
            await store.resetStore();
        });

        afterEach(async () => {
            if (teardown) {
                await teardown(store);
            }
        });

        it('should initialize count to 0 for a new token', async () => {
            const count = await store.getWordCount('token1', '2026-01-02');
            expect(count).toBe(0);
        });

        it('should increment word count for an existing token', async () => {
            const today = '2026-01-02';
            await store.incrementWordCount('token1', 100, today);
            const count = await store.getWordCount('token1', today);
            expect(count).toBe(100);
        });

        it('should reset count for a new date', async () => {
            await store.incrementWordCount('token1', 100, '2026-01-02');
            const countNewDate = await store.getWordCount('token1', '2026-01-03');
            expect(countNewDate).toBe(0);
        });

        it('should handle increment for a new date', async () => {
            await store.incrementWordCount('token1', 100, '2026-01-02');
            await store.incrementWordCount('token1', 50, '2026-01-03');
            const count = await store.getWordCount('token1', '2026-01-03');
            expect(count).toBe(50);
        });

        it('should reset the entire store', async () => {
            await store.incrementWordCount('token1', 100, '2026-01-02');
            await store.resetStore();
            const count = await store.getWordCount('token1', '2026-01-02');
            expect(count).toBe(0);
        });
    });
}

// Run tests for InMemory implementation
runRateLimitStoreTests('InMemoryRateLimiterStore', () => new InMemoryRateLimiterStore());

// Run tests for Redis implementation
runRateLimitStoreTests(
    'RedisRateLimiterStore',
    () => {
        // Setup Redis mock behavior for these tests
        const redisData: Record<string, string> = {};
        mockRedisClient.get.mockImplementation(async (key: string) => redisData[key] || null);
        mockRedisClient.incrBy.mockImplementation(async (key: string, value: number) => {
            const current = parseInt(redisData[key] || '0', 10);
            redisData[key] = (current + value).toString();
            return current + value;
        });
        mockRedisClient.flushDb.mockImplementation(async () => {
            for (const key in redisData) delete redisData[key];
        });

        return new RedisRateLimiterStore('redis://localhost:6379');
    },
    async (store) => {
        if (store instanceof RedisRateLimiterStore) {
            await store.close();
        }
    }
);