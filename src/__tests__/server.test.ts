import request from 'supertest';
import app, { server, rateLimitStore } from '@/server';
import * as jwt from 'jsonwebtoken';
import { justifyText } from '@/services/justify-engine';

// Mock jsonwebtoken to control token generation and verification
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

// Mock the justifyText service
jest.mock('../services/justify-engine', () => ({
  justifyText: jest.fn(),
}));

describe('API Endpoints', () => {
  let token: string;
  const MOCK_SECRET_KEY = 'mock-secret-key';
  const MOCK_IP = '::1'; // Consistent IP for testing

  // Spies for rateLimitStore
  let getWordCountSpy: jest.SpyInstance;
  let incrementWordCountSpy: jest.SpyInstance;
  let resetStoreSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Reset the spies
    getWordCountSpy = jest.spyOn(rateLimitStore, 'getWordCount');
    incrementWordCountSpy = jest.spyOn(rateLimitStore, 'incrementWordCount');
    resetStoreSpy = jest.spyOn(rateLimitStore, 'resetStore');

    // Reset the store explicitly
    await rateLimitStore.resetStore();

    // Mock jwt.sign to return a consistent token for testing
    (jwt.sign as jest.Mock).mockReturnValue('mock-token');

    // Mock jwt.verify to simulate a valid token by default
    (jwt.verify as jest.Mock).mockImplementation((token, secret, callback) => {
      if (token === 'mock-token' && secret === MOCK_SECRET_KEY) {
        callback(null, { ip: MOCK_IP });
      } else {
        callback(new Error('Invalid token'));
      }
    });

    // Mock justifyText to return a simple result
    (justifyText as jest.Mock).mockReturnValue(['justified text']);

    // Set environment variable for JWT secret
    process.env.JWT_SECRET = MOCK_SECRET_KEY;
  });

  afterEach(() => {
    // Restore spies to original implementation
    getWordCountSpy.mockRestore();
    incrementWordCountSpy.mockRestore();
    resetStoreSpy.mockRestore();
  });

  it('should return a token on POST /api/token', async () => {
    (jwt.sign as jest.Mock).mockReturnValue('a-new-mock-token');

    const res = await request(app).post('/api/token').send({ email: 'test@example.com' });
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.token).toEqual('a-new-mock-token');
    expect(jwt.sign).toHaveBeenCalledWith({ email: 'test@example.com' }, MOCK_SECRET_KEY);
  });

  it('should return 400 on POST /api/token without an email', async () => {
    const res = await request(app).post('/api/token').send({});
    expect(res.statusCode).toEqual(400);
    expect(res.text).toContain('Email is required');
  });

  it('should justify text on POST /api/justify with a valid token', async () => {
    token = 'mock-token';
    const textToJustify = 'This is a sample text that needs to be justified.';

    const res = await request(app)
      .post('/api/justify')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'text/plain')
      .send(textToJustify);

    expect(res.statusCode).toEqual(200);
    expect(res.text).toEqual('justified text');
    expect(jwt.verify).toHaveBeenCalledWith(token, MOCK_SECRET_KEY, expect.any(Function));
    expect(justifyText).toHaveBeenCalledWith(textToJustify, 80);
    expect(incrementWordCountSpy).toHaveBeenCalled();
  });

  it('should return 401 for POST /api/justify without a token', async () => {
    const textToJustify = 'This is a sample text.';
    const res = await request(app)
      .post('/api/justify')
      .set('Content-Type', 'text/plain')
      .send(textToJustify);

    expect(res.statusCode).toEqual(401);
  });

  it('should return 403 for POST /api/justify with an invalid token', async () => {
    (jwt.verify as jest.Mock).mockImplementation((token, secret, callback) => {
      callback(new Error('Invalid token'));
    });

    const textToJustify = 'This is a sample text.';
    const res = await request(app)
      .post('/api/justify')
      .set('Authorization', 'Bearer invalid-token')
      .set('Content-Type', 'text/plain')
      .send(textToJustify);

    expect(res.statusCode).toEqual(403);
  });

  it('should return 400 for POST /api/justify with empty body', async () => {
    token = 'mock-token';

    const res = await request(app)
      .post('/api/justify')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'text/plain')
      .send('');

    expect(res.statusCode).toEqual(400);
    expect(res.text).toContain('Request body must be plain text');
  });

  it('should return 400 for POST /api/justify with non-string body', async () => {
    token = 'mock-token';

    const res = await request(app)
      .post('/api/justify')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({ data: 'not a string' }); 

    expect(res.statusCode).toEqual(400);
    expect(res.text).toContain('Request body must be plain text');
  });

  it('should return 402 when rate limit is exceeded', async () => {
    token = 'mock-token';
    const text = 'word '.repeat(100); // 100 words
    
    // Use the spy to manipulate implementation for this test ONLY
    getWordCountSpy.mockResolvedValue(79990); // Near limit

    const res = await request(app)
      .post('/api/justify')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'text/plain')
      .send(text);

    expect(res.statusCode).toEqual(402);
    expect(res.text).toContain('Payment Required: Rate limit exceeded');
    expect(getWordCountSpy).toHaveBeenCalledWith(token, expect.any(String));
    expect(incrementWordCountSpy).not.toHaveBeenCalled();
  });

  it('should return 500 if justifyText service throws an error', async () => {
    token = 'mock-token';
    const error = new Error('Justification failed');
    (justifyText as jest.Mock).mockImplementation(() => {
      throw error;
    });

    const res = await request(app)
      .post('/api/justify')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'text/plain')
      .send('some text');

    expect(res.statusCode).toEqual(500);
    expect(res.text).toEqual(error.message);
  });

  it('should return 500 if rateLimitStore.getWordCount throws an error', async () => {
    token = 'mock-token';
    const error = new Error('Rate limit store error');
    getWordCountSpy.mockRejectedValue(error);

    const res = await request(app)
      .post('/api/justify')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'text/plain')
      .send('some text');

    expect(res.statusCode).toEqual(500);
    expect(res.text).toContain('Internal Server Error');
  });

  it('should return 500 if rateLimitStore.incrementWordCount throws an error', async () => {
    token = 'mock-token';
    const error = new Error('Rate limit store error');
    incrementWordCountSpy.mockRejectedValue(error);

    const res = await request(app)
      .post('/api/justify')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'text/plain')
      .send('some text');

    expect(res.statusCode).toEqual(500);
    expect(res.text).toContain('Internal Server Error');
  });
});

afterAll(() => {
  server.close();
});