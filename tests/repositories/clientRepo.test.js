'use strict';

/**
 * tests/repositories/clientRepo.test.js
 * Test suite for clientRepo.
 */

const clientRepo = require('../../src/repositories/clientRepo');
const { query } = require('../../src/config/db');

jest.mock('../../src/config/db', () => ({
  query: jest.fn(),
}));

describe('clientRepo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(clientRepo).toBeDefined();
  });

  describe('findByToken', () => {
    it('should return a client when token exists and is active', async () => {
      const mockClient = { id: 1, bearer_token: 'token123', is_active: 1 };
      query.mockResolvedValue([mockClient]);

      const result = await clientRepo.findByToken('token123');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM clients WHERE bearer_token = ?'),
        ['token123']
      );
      expect(result).toEqual(mockClient);
    });

    it('should return null when token does not exist', async () => {
      query.mockResolvedValue([]);

      const result = await clientRepo.findByToken('invalid');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return a client when ID exists', async () => {
      const mockClient = { id: 5, client_name: 'Test' };
      query.mockResolvedValue([mockClient]);

      const result = await clientRepo.findById(5);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM clients WHERE id = ?'),
        [5]
      );
      expect(result).toEqual(mockClient);
    });
  });

  describe('getAll', () => {
    it('should return all clients', async () => {
      const mockClients = [{ id: 1 }, { id: 2 }];
      query.mockResolvedValue(mockClients);

      const result = await clientRepo.getAll();

      expect(result).toEqual(mockClients);
    });
  });
});
