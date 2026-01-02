import request from 'supertest';
import app, { server } from '../server'; // Import the app and server from server.ts
import * as jwt from 'jsonwebtoken';

// Mock jsonwebtoken to control token generation and verification
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

describe('API Endpoints', () => {
  let token: string;
  const MOCK_SECRET_KEY = 'mock-secret-key';
  const MOCK_IP = '::1'; // Consistent IP for testing

  beforeEach(() => {
    // Reset mocks before each test
    (jwt.sign as jest.Mock).mockReset();
    (jwt.verify as jest.Mock).mockReset();

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

  it('should justify text on POST /api/justify with a valid token', async () => {
    token = 'mock-token';
    const textToJustify = 'This is a sample text that needs to be justified.';

    const res = await request(app)
      .post('/api/justify')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'text/plain')
      .send(textToJustify);

    expect(res.statusCode).toEqual(200);
    expect(res.text).toBeDefined();
    expect(res.text.length).toBeGreaterThan(0);
    expect(jwt.verify).toHaveBeenCalledWith(token, MOCK_SECRET_KEY, expect.any(Function));
  });

  it('should return 401 for POST /api/justify without a token', async () => {
    const textToJustify = 'This is a sample text.';
    const res = await request(app)
      .post('/api/justify')
      .set('Content-Type', 'text/plain')
      .send(textToJustify);

    expect(res.statusCode).toEqual(401);
    expect(res.text).toContain('Unauthorized');
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
    expect(res.text).toContain('Forbidden');
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
});

afterAll(() => {
  // Close the server after all tests are done to prevent open handle issues
  server.close();
});
