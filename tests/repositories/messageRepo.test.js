'use strict';

/**
 * tests/repositories/messageRepo.test.js
 * Boilerplate test suite for messageRepo.
 */

const messageRepo = require('../../src/repositories/messageRepo');

describe('messageRepo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(messageRepo).toBeDefined();
  });
});
