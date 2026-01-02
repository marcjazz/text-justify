export interface IRateLimitStore {
    getWordCount(token: string, today: string): Promise<number>;
    incrementWordCount(token: string, wordCount: number, today: string): Promise<void>;
    resetStore(): Promise<void>;
}
