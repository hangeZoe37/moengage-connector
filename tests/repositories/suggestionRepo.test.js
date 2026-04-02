'use strict';

/**
 * tests/repositories/suggestionRepo.test.js
 * Boilerplate test suite for suggestionRepo.
 */

const suggestionRepo = require('../../src/repositories/suggestionRepo');

describe('suggestionRepo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(suggestionRepo).toBeDefined();
  });
});
