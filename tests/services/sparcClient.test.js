'use strict';

/**
 * tests/services/sparcClient.test.js
 * Boilerplate test suite for sparcClient.
 */

const sparcClient = require('../../src/services/sparcClient');

describe('sparcClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(sparcClient).toBeDefined();
  });
});
