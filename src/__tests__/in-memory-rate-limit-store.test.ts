import { InMemoryRateLimiterStore } from '../services/rate-limiter-store/impl/in-memory-rate-limit-store';

describe('InMemoryRateLimiterStore', () => {
    let store: InMemoryRateLimiterStore;

    beforeEach(() => {
        store = new InMemoryRateLimiterStore();
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
