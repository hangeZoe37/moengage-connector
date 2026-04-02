'use strict';

/**
 * src/controllers/dashboardController.js
 * Handles Dashboard APIs: metrics, logs, clients, and SSE streaming.
 */

const messageRepo = require('../repositories/messageRepo');
const clientRepo = require('../repositories/clientRepo');
const { dashboardEmitter } = require('../services/dashboardService');
const logger = require('../config/logger');

/**
 * GET /api/dashboard/metrics
 */
async function getMetrics(req, res) {
  try {
    const stats = await messageRepo.getStats();
    const timeline = await messageRepo.getTimelineStats();
    res.json({ stats, timeline });
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
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;
    const logs = await messageRepo.getRecentLogs(limit, offset);
    res.json({ logs });
  } catch (error) {
    logger.error('Dashboard getLogs failed', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/dashboard/clients
 */
async function getClients(req, res) {
  try {
    const clients = await clientRepo.getAll();
    res.json({ clients });
  } catch (error) {
    logger.error('Dashboard getClients failed', { error: error.message });
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
  res.flushHeaders();

  const onUpdate = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  dashboardEmitter.on('update', onUpdate);

  // Send initial keep-alive
  res.write(': keep-alive\n\n');

  req.on('close', () => {
    dashboardEmitter.off('update', onUpdate);
  });
}

module.exports = {
  getMetrics,
  getLogs,
  getClients,
  streamLogs
};
