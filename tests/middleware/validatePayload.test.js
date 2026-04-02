'use strict';

/**
 * tests/middleware/validatePayload.test.js
 * Boilerplate test suite for validatePayload.
 */

const validatePayload = require('../../src/middleware/validatePayload');

describe('validatePayload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(validatePayload).toBeDefined();
  });
});
