import { IRateLimitStore } from "@rate-limiter/rate-limit-store.interface";

export class InMemoryRateLimiterStore implements IRateLimitStore {
  private store: Record<string, { count: number; date: string }> = {};

  async getWordCount(token: string, today: string): Promise<number> {
    if (!this.store[token] || this.store[token].date !== today) {
      this.store[token] = { count: 0, date: today };
    }
    return this.store[token].count;
  }

  async incrementWordCount(
    token: string,
    wordCount: number,
    today: string
  ): Promise<void> {
    if (!this.store[token] || this.store[token].date !== today) {
      this.store[token] = { count: 0, date: today };
    }
    this.store[token].count += wordCount;
  }

  async resetStore(): Promise<void> {
    this.store = {};
  }
}
