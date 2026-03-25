'use strict';

/**
 * tests/middleware/bearerAuth.test.js
 * Unit tests for bearer token authentication middleware.
 */

jest.mock('../../src/repositories/workspaceRepo');
jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const bearerAuth = require('../../src/middleware/bearerAuth');
const workspaceRepo = require('../../src/repositories/workspaceRepo');

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
    workspaceRepo.findByToken.mockResolvedValue(null);

    await bearerAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 when workspace is disabled', async () => {
    req.headers['authorization'] = 'Bearer valid_token';
    workspaceRepo.findByToken.mockResolvedValue({
      workspace_id: 'ws_1',
      is_active: 0,
    });

    await bearerAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() and attach workspace when token is valid', async () => {
    const workspace = {
      workspace_id: 'ws_1',
      bearer_token: 'valid_token',
      is_active: 1,
    };
    req.headers['authorization'] = 'Bearer valid_token';
    workspaceRepo.findByToken.mockResolvedValue(workspace);

    await bearerAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.workspace).toEqual(workspace);
  });

  it('should also accept Authentication header (MoEngage uses it)', async () => {
    const workspace = {
      workspace_id: 'ws_2',
      bearer_token: 'alt_token',
      is_active: 1,
    };
    req.headers['authentication'] = 'Bearer alt_token';
    workspaceRepo.findByToken.mockResolvedValue(workspace);

    await bearerAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.workspace).toEqual(workspace);
  });

  it('should return 500 on unexpected errors', async () => {
    req.headers['authorization'] = 'Bearer some_token';
    workspaceRepo.findByToken.mockRejectedValue(new Error('DB connection failed'));

    await bearerAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
