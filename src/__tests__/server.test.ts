import request from 'supertest';
import app, { server, rateLimitStore } from '../server'; // Import the app, server, and rateLimitStore from server.ts
import * as jwt from 'jsonwebtoken';
import { justifyText } from '../services/justify_engine';
import { InMemoryRateLimitStore } from '../services/in-memory-rate-limit-store'; // Import the concrete class

// Mock jsonwebtoken to control token generation and verification
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

// Mock the justifyText service
jest.mock('../services/justify_engine', () => ({
  justifyText: jest.fn(),
}));

// Mock the InMemoryRateLimitStore to control its behavior in tests
jest.mock('../services/in-memory-rate-limit-store', () => {
  return {
    InMemoryRateLimitStore: jest.fn().mockImplementation(() => {
      // Return an object that has the same interface but with jest.fn() for methods
      return {
        getWordCount: jest.fn(),
        incrementWordCount: jest.fn(),
        resetStore: jest.fn(),
      };
    }),
  };
});


describe('API Endpoints', () => {
  let token: string;
  const MOCK_SECRET_KEY = 'mock-secret-key';
  const MOCK_IP = '::1'; // Consistent IP for testing

  beforeEach(async () => {
    // Reset mocks before each test
    (jwt.sign as jest.Mock).mockReset();
    (jwt.verify as jest.Mock).mockReset();
    (justifyText as jest.Mock).mockReset();
    
    // Reset the rate limit store using its mocked method
    await rateLimitStore.resetStore();
    (rateLimitStore.getWordCount as jest.Mock).mockReset();
    (rateLimitStore.incrementWordCount as jest.Mock).mockReset();


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

    // Mock InMemoryRateLimitStore methods to return default values or resolve
    (rateLimitStore.getWordCount as jest.Mock).mockResolvedValue(0);
    (rateLimitStore.incrementWordCount as jest.Mock).mockResolvedValue(undefined);
    (rateLimitStore.resetStore as jest.Mock).mockResolvedValue(undefined);

    // Set environment variable for JWT secret
    process.env.JWT_SECRET = MOCK_SECRET_KEY;
  });

  it('should return a token on POST /api/token', async () => {
    (jwt.sign as jest.Mock).mockReturnValue('a-new-mock-token'); // Override for this specific test

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
    expect(rateLimitStore.incrementWordCount).toHaveBeenCalled();
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
      callback(new Error('Invalid token')); // Simulate invalid token
    });

    const textToJustify = 'This is a sample text.';
    const res = await request(app)
      .post('/api/justify')
      .set('Authorization', `Bearer invalid-token`)
      .set('Content-Type', 'text/plain')
      .send(textToJustify);

    expect(res.statusCode).toEqual(403);
  });

  it('should return 400 for POST /api/justify with empty body', async () => {
    token = 'mock-token'; // Assume a valid token

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
      .send({ data: 'not a string' }); // Sending JSON to test the middleware

    expect(res.statusCode).toEqual(400);
    expect(res.text).toContain('Request body must be plain text');
  });

  it('should return 402 when rate limit is exceeded', async () => {
    token = 'mock-token';
    const text = 'word '.repeat(100); // Small text, 100 words
    
    // Mock getWordCount to return a value that, with the current request, exceeds the limit
    (rateLimitStore.getWordCount as jest.Mock).mockResolvedValue(79990); // Already 79990 words
    // No need to mock incrementWordCount here, as it shouldn't be called

    // This request has 100 words, bringing total to 80090, exceeding 80000 limit
    const res = await request(app)
      .post('/api/justify')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'text/plain')
      .send(text);

    expect(res.statusCode).toEqual(402);
    expect(res.text).toContain('Payment Required: Rate limit exceeded');
    expect(rateLimitStore.getWordCount).toHaveBeenCalledWith(token, expect.any(String));
    // Verify that incrementWordCount was NOT called because limit was exceeded
    expect(rateLimitStore.incrementWordCount).not.toHaveBeenCalled();
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
    (rateLimitStore.getWordCount as jest.Mock).mockRejectedValue(error);

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
    (rateLimitStore.incrementWordCount as jest.Mock).mockRejectedValue(error);

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
  // Close the server after all tests are done to prevent open handle issues
  server.close();
});
