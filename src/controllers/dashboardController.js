'use strict';

/**
 * src/controllers/dashboardController.js
 * Handles Dashboard APIs: metrics, logs, clients, DLR events, SSE streaming.
 */

const messageRepo = require('../repositories/messageRepo');
const dlrRepo = require('../repositories/dlrRepo');
const clientRepo = require('../repositories/clientRepo');
const { dashboardEmitter } = require('../services/dashboardService');
const logger = require('../config/logger');

/**
 * GET /api/dashboard/metrics
 */
async function getMetrics(req, res) {
  try {
    const [stats, timeline, channelStats] = await Promise.all([
      messageRepo.getStats(),
      messageRepo.getTimelineStats(),
      messageRepo.getChannelStats(),
    ]);
    res.json({ stats, timeline, channelStats });
  } catch (error) {
    logger.error('Dashboard getMetrics failed', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/dashboard/logs
 */
async function getLogs(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;
    const clientId = req.query.client_id ? parseInt(req.query.client_id, 10) : null;

    const [logs, total] = await Promise.all([
      messageRepo.getRecentLogs(limit, offset, clientId),
      messageRepo.countMessages(clientId),
    ]);
    res.json({ logs, total, limit, offset });
  } catch (error) {
    logger.error('Dashboard getLogs failed', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/dashboard/messages/:id
 * Returns a single message with its DLR event history.
 */
async function getMessageDetail(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid message id' });

    const message = await messageRepo.findById(id);

    if (!message) return res.status(404).json({ error: 'Message not found' });

    const events = await dlrRepo.findByCallbackData(message.callback_data);

    // Parse raw_payload if stored as string
    let parsedPayload = message.raw_payload;
    if (typeof parsedPayload === 'string') {
      try { parsedPayload = JSON.parse(parsedPayload); } catch (_) {}
    }

    res.json({ message: { ...message, raw_payload: parsedPayload }, dlrEvents: events });
  } catch (error) {
    logger.error('Dashboard getMessageDetail failed', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/dashboard/dlr-events
 */
async function getDlrEvents(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;
    const clientId = req.query.client_id ? parseInt(req.query.client_id, 10) : null;

    const [events, total] = await Promise.all([
      dlrRepo.getRecent(limit, offset, clientId),
      dlrRepo.countEvents(clientId),
    ]);
    res.json({ events, total, limit, offset });
  } catch (error) {
    logger.error('Dashboard getDlrEvents failed', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/dashboard/clients
 */
async function getClients(req, res) {
  try {
    const clients = await clientRepo.getAll();
    // Obfuscate passwords
    const safeClients = clients.map(c => ({
      ...c,
      rcs_password: c.rcs_password ? '***' : null,
      sms_password: c.sms_password ? '***' : null,
    }));
    res.json({ clients: safeClients });
  } catch (error) {
    logger.error('Dashboard getClients failed', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/dashboard/clients
 */
async function onboardClient(req, res) {
  try {
    const {
      client_name,
      rcs_username,
      rcs_password,
      sms_username,
      sms_password,
      rcs_assistant_id,
    } = req.body;

    if (!client_name) {
      return res.status(400).json({ error: 'client_name is required' });
    }

    // Auto-generate bearer_token if not provided
    const bearer_token =
      req.body.bearer_token || require('crypto').randomBytes(32).toString('hex');

    const insertId = await clientRepo.createClient({
      client_name,
      bearer_token,
      rcs_username,
      rcs_password,
      sms_username,
      sms_password,
      rcs_assistant_id,
    });

    const newClient = await clientRepo.findById(insertId);
    if (newClient) {
      newClient.rcs_password = newClient.rcs_password ? '***' : null;
      newClient.sms_password = newClient.sms_password ? '***' : null;
    }

    logger.info('New client onboarded', { clientId: insertId, clientName: client_name });
    res.status(201).json({ status: 'success', client: newClient });
  } catch (error) {
    logger.error('Dashboard onboardClient failed', { error: error.message });
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Bearer token already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PUT /api/dashboard/clients/:id
 */
async function updateClient(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const client = await clientRepo.findById(id);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    await clientRepo.updateClient(id, req.body);
    const updated = await clientRepo.findById(id);
    if (updated) {
      updated.rcs_password = updated.rcs_password ? '***' : null;
      updated.sms_password = updated.sms_password ? '***' : null;
    }
    res.json({ status: 'success', client: updated });
  } catch (error) {
    logger.error('Dashboard updateClient failed', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * DELETE /api/dashboard/clients/:id
 * Soft-deactivates a client (sets is_active = 0).
 */
async function deactivateClient(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const client = await clientRepo.findById(id);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    await clientRepo.deactivateClient(id);
    logger.info('Client deactivated', { clientId: id });
    res.json({ status: 'success' });
  } catch (error) {
    logger.error('Dashboard deactivateClient failed', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/dashboard/logs/stream (SSE)
 */
function streamLogs(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering for SSE
  res.flushHeaders();

  const onUpdate = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  dashboardEmitter.on('update', onUpdate);

  // Send initial keep-alive comment
  res.write(': keep-alive\n\n');

  // Heartbeat every 25s to prevent proxy timeouts
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    dashboardEmitter.off('update', onUpdate);
  });
}

module.exports = {
  getMetrics,
  getLogs,
  getMessageDetail,
  getDlrEvents,
  getClients,
  onboardClient,
  updateClient,
  deactivateClient,
  streamLogs,
};
