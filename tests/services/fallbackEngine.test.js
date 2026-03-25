'use strict';

/**
 * tests/services/fallbackEngine.test.js
 * Unit tests for fallback engine orchestration logic.
 */

// Mock dependencies before requiring the module
jest.mock('../../src/services/sparcClient');
jest.mock('../../src/services/callbackDispatcher');
jest.mock('../../src/repositories/messageRepo');
jest.mock('../../src/config/env', () => ({
  env: {
    SPARC_DLR_WEBHOOK_URL: 'https://connector.example.com/sparc/dlr',
    MOENGAGE_DLR_URL: 'https://api-01.moengage.com/rcs/dlr/sparc',
  },
}));

const sparcClient = require('../../src/services/sparcClient');
const callbackDispatcher = require('../../src/services/callbackDispatcher');
const messageRepo = require('../../src/repositories/messageRepo');
const { processMessage } = require('../../src/services/fallbackEngine');

describe('fallbackEngine', () => {
  const workspace = {
    workspace_id: 'test_workspace',
    moe_dlr_url: 'https://api-01.moengage.com/rcs/dlr/sparc',
    sparc_account: 'test_account',
    sparc_password: 'test_pass',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    messageRepo.updateStatus.mockResolvedValue({});
    callbackDispatcher.dispatchStatus.mockResolvedValue(true);
  });

  it('should send RCS when fallback_order includes "rcs"', async () => {
    sparcClient.sendRCS.mockResolvedValue({ success: true });

    const message = {
      destination: '+919876543210',
      callback_data: 'cb_1',
      content: { type: 'TEXT', parameters: { name: 'Test' } },
      rcs: { bot_id: 'bot_1' },
      fallback_order: ['rcs'],
    };

    await processMessage(message, workspace);

    expect(sparcClient.sendRCS).toHaveBeenCalledTimes(1);
    expect(messageRepo.updateStatus).toHaveBeenCalledWith(
      'cb_1', 'RCS_SENT', expect.any(String)
    );
  });

  it('should attempt SMS fallback when RCS fails and SMS is in fallback_order', async () => {
    sparcClient.sendRCS.mockRejectedValue(new Error('RCS failed'));
    sparcClient.sendSMS.mockResolvedValue({ success: true });

    const message = {
      destination: '+919876543210',
      callback_data: 'cb_2',
      content: { type: 'TEXT', parameters: { name: 'Test' } },
      rcs: { bot_id: 'bot_1' },
      sms: { sender: 'SPARC', message: 'Hello Test' },
      fallback_order: ['rcs', 'sms'],
    };

    await processMessage(message, workspace);

    expect(sparcClient.sendRCS).toHaveBeenCalledTimes(1);
    expect(sparcClient.sendSMS).toHaveBeenCalledTimes(1);
    expect(messageRepo.updateStatus).toHaveBeenCalledWith('cb_2', 'RCS_FAILED');
    expect(messageRepo.updateStatus).toHaveBeenCalledWith('cb_2', 'SMS_SENT');
  });

  it('should NOT attempt SMS when RCS fails but SMS not in fallback_order', async () => {
    sparcClient.sendRCS.mockRejectedValue(new Error('RCS failed'));

    const message = {
      destination: '+919876543210',
      callback_data: 'cb_3',
      content: { type: 'TEXT' },
      rcs: { bot_id: 'bot_1' },
      fallback_order: ['rcs'],
    };

    await processMessage(message, workspace);

    expect(sparcClient.sendRCS).toHaveBeenCalledTimes(1);
    expect(sparcClient.sendSMS).not.toHaveBeenCalled();
  });

  it('should go directly to SMS when fallback_order is ["sms"] only', async () => {
    sparcClient.sendSMS.mockResolvedValue({ success: true });

    const message = {
      destination: '+919876543210',
      callback_data: 'cb_4',
      content: { type: 'TEXT' },
      rcs: { bot_id: 'bot_1' },
      sms: { sender: 'SPARC', message: 'Hello' },
      fallback_order: ['sms'],
    };

    await processMessage(message, workspace);

    expect(sparcClient.sendRCS).not.toHaveBeenCalled();
    expect(sparcClient.sendSMS).toHaveBeenCalledTimes(1);
  });

  it('should default to ["rcs"] when no fallback_order specified', async () => {
    sparcClient.sendRCS.mockResolvedValue({ success: true });

    const message = {
      destination: '+919876543210',
      callback_data: 'cb_5',
      content: { type: 'TEXT' },
      rcs: { bot_id: 'bot_1' },
    };

    await processMessage(message, workspace);

    expect(sparcClient.sendRCS).toHaveBeenCalledTimes(1);
  });
});
