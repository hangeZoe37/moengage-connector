'use strict';

/**
 * tests/middleware/bearerAuth.test.js
 * Unit tests for bearer token authentication middleware.
 */

jest.mock('../../src/repositories/clientRepo');
jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const bearerAuth = require('../../src/middleware/bearerAuth');
const clientRepo = require('../../src/repositories/clientRepo');

describe('bearerAuth middleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      headers: {},
      ip: '127.0.0.1',
      path: '/test',
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('should return 401 when Authorization header is missing', async () => {
    await bearerAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization header is malformed', async () => {
    req.headers['authorization'] = 'InvalidFormat';

    await bearerAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when token is not found in DB', async () => {
    req.headers['authorization'] = 'Bearer unknown_token';
    clientRepo.findByToken.mockResolvedValue(null);

    await bearerAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 when client is disabled', async () => {
    req.headers['authorization'] = 'Bearer valid_token';
    clientRepo.findByToken.mockResolvedValue({
      id: 1,
      client_name: 'test_client',
      is_active: 0,
    });

    await bearerAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() and attach client when token is valid', async () => {
    const client = {
      id: 1,
      client_name: 'test_client',
      bearer_token: 'valid_token',
      is_active: 1,
    };
    req.headers['authorization'] = 'Bearer valid_token';
    clientRepo.findByToken.mockResolvedValue(client);

    await bearerAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.client).toEqual(client);
  });

  it('should also accept Authentication header (MoEngage uses it)', async () => {
    const client = {
      id: 2,
      client_name: 'alt_client',
      bearer_token: 'alt_token',
      is_active: 1,
    };
    req.headers['authentication'] = 'Bearer alt_token';
    clientRepo.findByToken.mockResolvedValue(client);

    await bearerAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.client).toEqual(client);
  });

  it('should return 500 on unexpected errors', async () => {
    req.headers['authorization'] = 'Bearer some_token';
    clientRepo.findByToken.mockRejectedValue(new Error('DB connection failed'));

    await bearerAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
