'use strict';

/**
 * tests/services/fallbackEngine.test.js
 * Unit tests for fallback engine orchestration logic and buildMoeStatusPayload helper.
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
const { processMessage, buildMoeStatusPayload } = require('../../src/services/fallbackEngine');

// ─────────────────────────────────────────────────────────────────────────────
// buildMoeStatusPayload — unit tests (pure, no mocks needed)
// ─────────────────────────────────────────────────────────────────────────────
describe('buildMoeStatusPayload', () => {
  it('should build a valid RCS_SENT payload', () => {
    const before = Math.floor(Date.now() / 1000);
    const result = buildMoeStatusPayload('RCS_SENT', 'cb_abc123');
    const after = Math.floor(Date.now() / 1000);

    expect(result).toHaveProperty('statuses');
    expect(Array.isArray(result.statuses)).toBe(true);
    expect(result.statuses[0].status).toBe('RCS_SENT');
    expect(result.statuses[0].callback_data).toBe('cb_abc123');
    expect(typeof result.statuses[0].timestamp).toBe('string');

    const ts = parseInt(result.statuses[0].timestamp, 10);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('should build a valid SMS_SENT payload with no error_message', () => {
    const result = buildMoeStatusPayload('SMS_SENT', 'cb_sms_001');
    expect(result.statuses[0].status).toBe('SMS_SENT');
    expect(result.statuses[0].callback_data).toBe('cb_sms_001');
    expect(result.statuses[0].error_message).toBeUndefined();
  });

  it('should include error_message for RCS_DELIVERY_FAILED', () => {
    const result = buildMoeStatusPayload('RCS_DELIVERY_FAILED', 'cb_fail', 'Network unreachable');
    expect(result.statuses[0].status).toBe('RCS_DELIVERY_FAILED');
    expect(result.statuses[0].error_message).toBe('Network unreachable');
  });

  it('should include error_message for SMS_DELIVERY_FAILED', () => {
    const result = buildMoeStatusPayload('SMS_DELIVERY_FAILED', 'cb_sms_fail', 'DND number');
    expect(result.statuses[0].error_message).toBe('DND number');
  });

  it('should include error_message for RCS_SENT_FAILED', () => {
    const result = buildMoeStatusPayload('RCS_SENT_FAILED', 'cb_sf', 'Invalid phone');
    expect(result.statuses[0].status).toBe('RCS_SENT_FAILED');
    expect(result.statuses[0].error_message).toBe('Invalid phone');
  });

  it('should NOT include error_message when status is a success status, even if error text is provided', () => {
    // Protects against leaking error strings into success callbacks
    const result = buildMoeStatusPayload('RCS_SENT', 'cb_ok', 'should be ignored');
    expect(result.statuses[0].error_message).toBeUndefined();
  });

  it('should NOT include error_message when no errorMessage argument is given', () => {
    const result = buildMoeStatusPayload('RCS_DELIVERY_FAILED', 'cb_noe');
    expect(result.statuses[0].error_message).toBeUndefined();
  });

  it('payload shape must match MoEngage statuses array format exactly', () => {
    const result = buildMoeStatusPayload('SMS_DELIVERED', 'cb_shape');
    expect(result).toHaveProperty('statuses');
    expect(Array.isArray(result.statuses)).toBe(true);
    expect(result.statuses).toHaveLength(1);
    const item = result.statuses[0];
    expect(item).toHaveProperty('status');
    expect(item).toHaveProperty('callback_data');
    expect(item).toHaveProperty('timestamp');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// processMessage — integration flow tests (mocked deps)
// ─────────────────────────────────────────────────────────────────────────────
describe('fallbackEngine.processMessage', () => {
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

  it('should send RCS and dispatch RCS_SENT callback when fallback_order includes "rcs"', async () => {
    sparcClient.sendRCS.mockResolvedValue({ success: true });

    const message = {
      destination: '+919876543210',
      callback_data: 'cb_1',
      content: { type: 'TEXT', data: { parameters: { name: 'Test' } } },
      rcs: { bot_id: 'bot_1' },
      fallback_order: ['rcs'],
    };

    await processMessage(message, workspace);

    expect(sparcClient.sendRCS).toHaveBeenCalledTimes(1);
    expect(messageRepo.updateStatus).toHaveBeenCalledWith('cb_1', 'RCS_SENT', expect.any(String));

    // CRITICAL: verify the correct status is dispatched (not UNKNOWN)
    const dispatchedPayload = callbackDispatcher.dispatchStatus.mock.calls[0][1];
    expect(dispatchedPayload.statuses[0].status).toBe('RCS_SENT');
    expect(dispatchedPayload.statuses[0].callback_data).toBe('cb_1');
  });

  it('should attempt SMS fallback when RCS fails and SMS is in fallback_order', async () => {
    sparcClient.sendRCS.mockRejectedValue(new Error('RCS failed'));
    sparcClient.sendSMS.mockResolvedValue({ success: true });

    const message = {
      destination: '+919876543210',
      callback_data: 'cb_2',
      content: { type: 'TEXT', data: {} },
      rcs: { bot_id: 'bot_1' },
      sms: { sender: 'SPARC', message: 'Hello Test' },
      fallback_order: ['rcs', 'sms'],
    };

    await processMessage(message, workspace);

    expect(sparcClient.sendRCS).toHaveBeenCalledTimes(1);
    expect(sparcClient.sendSMS).toHaveBeenCalledTimes(1);
    expect(messageRepo.updateStatus).toHaveBeenCalledWith('cb_2', 'RCS_SENT_FAILED');
    expect(messageRepo.updateStatus).toHaveBeenCalledWith('cb_2', 'SMS_SENT');

    // Verify RCS_DELIVERY_FAILED callback dispatched with correct status
    const failDispatch = callbackDispatcher.dispatchStatus.mock.calls.find(
      (call) => call[1].statuses[0].status === 'RCS_DELIVERY_FAILED'
    );
    expect(failDispatch).toBeDefined();

    // Verify SMS_SENT callback dispatched with correct status
    const smsDispatch = callbackDispatcher.dispatchStatus.mock.calls.find(
      (call) => call[1].statuses[0].status === 'SMS_SENT'
    );
    expect(smsDispatch).toBeDefined();
  });

  it('should NOT attempt SMS when RCS fails but SMS not in fallback_order', async () => {
    sparcClient.sendRCS.mockRejectedValue(new Error('RCS failed'));

    const message = {
      destination: '+919876543210',
      callback_data: 'cb_3',
      content: { type: 'TEXT', data: {} },
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
      content: { type: 'TEXT', data: {} },
      rcs: { bot_id: 'bot_1' },
      sms: { sender: 'SPARC', message: 'Hello' },
      fallback_order: ['sms'],
    };

    await processMessage(message, workspace);

    expect(sparcClient.sendRCS).not.toHaveBeenCalled();
    expect(sparcClient.sendSMS).toHaveBeenCalledTimes(1);

    // CRITICAL: verify the SMS_SENT callback has the correct status
    const smsPayload = callbackDispatcher.dispatchStatus.mock.calls[0][1];
    expect(smsPayload.statuses[0].status).toBe('SMS_SENT');
  });

  it('should default to ["rcs"] when no fallback_order specified', async () => {
    sparcClient.sendRCS.mockResolvedValue({ success: true });

    const message = {
      destination: '+919876543210',
      callback_data: 'cb_5',
      content: { type: 'TEXT', data: {} },
      rcs: { bot_id: 'bot_1' },
    };

    await processMessage(message, workspace);

    expect(sparcClient.sendRCS).toHaveBeenCalledTimes(1);
  });

  it('should dispatch SMS_DELIVERY_FAILED with error_message when SMS send fails', async () => {
    sparcClient.sendSMS.mockRejectedValue(new Error('SMS DND'));

    const message = {
      destination: '+919876543210',
      callback_data: 'cb_6',
      content: { type: 'TEXT', data: {} },
      rcs: { bot_id: 'bot_1' },
      sms: { sender: 'SPARC', message: 'Hello' },
      fallback_order: ['sms'],
    };

    await processMessage(message, workspace);

    expect(messageRepo.updateStatus).toHaveBeenCalledWith('cb_6', 'SMS_SENT_FAILED');

    // The failure callback must carry the error message and correct status
    const failDispatch = callbackDispatcher.dispatchStatus.mock.calls.find(
      (call) => call[1].statuses[0].status === 'SMS_DELIVERY_FAILED'
    );
    expect(failDispatch).toBeDefined();
    expect(failDispatch[1].statuses[0].error_message).toBe('SMS DND');
  });
});
