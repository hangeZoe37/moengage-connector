'use strict';

/**
 * tests/middleware/rateLimiter.test.js
 * Boilerplate test suite for rateLimiter.
 */

const rateLimiter = require('../../src/middleware/rateLimiter');

describe('rateLimiter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(rateLimiter).toBeDefined();
  });
});
