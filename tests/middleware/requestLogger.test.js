'use strict';

/**
 * tests/middleware/requestLogger.test.js
 * Boilerplate test suite for requestLogger.
 */

const requestLogger = require('../../src/middleware/requestLogger');

describe('requestLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(requestLogger).toBeDefined();
  });
});
