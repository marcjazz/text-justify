import request from 'supertest';
import app, { server, rateLimitStore } from '../server'; // Import the app and server from server.ts
import * as jwt from 'jsonwebtoken';
import { justifyText } from '../services/justify_engine';

// Mock jsonwebtoken to control token generation and verification
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

// Mock the justifyText service
jest.mock('../services/justify_engine', () => ({
  justifyText: jest.fn(),
}));

describe('API Endpoints', () => {
  let token: string;
  const MOCK_SECRET_KEY = 'mock-secret-key';
  const MOCK_IP = '::1'; // Consistent IP for testing

  beforeEach(() => {
    // Reset mocks before each test
    (jwt.sign as jest.Mock).mockReset();
    (jwt.verify as jest.Mock).mockReset();
    (justifyText as jest.Mock).mockReset();
    
    // Clear the in-memory store before each test
    for (const key in rateLimitStore) {
      delete rateLimitStore[key];
    }

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
      .set('Authorization', 'Bearer invalid-token')
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
      .set('Content-Type', 'application/json')
      .send({ data: 'not a string' });

    expect(res.statusCode).toEqual(400);
    expect(res.text).toContain('Request body must be plain text');
  });

  it('should return 402 when rate limit is exceeded', async () => {
    token = 'mock-token';
    const text = 'word '.repeat(20000); // 20000 words
    
    // Four requests should be just under the 80000 limit
    for (let i = 0; i < 4; i++) {
      await request(app)
        .post('/api/justify')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'text/plain')
        .send(text);
    }
    
    // The fifth request should exceed the limit
    const res = await request(app)
      .post('/api/justify')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'text/plain')
      .send('one more word');

    expect(res.statusCode).toEqual(402);
    expect(res.text).toContain('Payment Required: Rate limit exceeded');
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
});

afterAll(() => {
  // Close the server after all tests are done to prevent open handle issues
  server.close();
});
