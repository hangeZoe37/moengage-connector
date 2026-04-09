'use strict';

/**
 * src/controllers/adminController.js
 * Controller for Admin Panel routes (/admin-api/*).
 * All routes are protected by adminAuth middleware (ADMIN_BEARER_TOKEN).
 */

const adminRepo   = require('../repositories/adminRepo');
const clientRepo  = require('../repositories/clientRepo');
const messageRepo = require('../repositories/messageRepo');
const dlrRepo     = require('../repositories/dlrRepo');
const { query }   = require('../config/db');
const logger      = require('../config/logger');
const crypto      = require('crypto');

async function getOverviewStats(req, res) {
  try {
    const stats = await adminRepo.getTodayStats();
    let clients = await adminRepo.getClientStatsToday();

    // Calculate fallback_rate
    clients = clients.map(c => {
      const fallback_rate = c.total > 0 ? (c.sms_fallback / c.total) * 100 : 0;
      return { ...c, fallback_rate };
    });

    res.json({ stats, clients });
  } catch (error) {
    logger.error('Admin getOverviewStats error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getClients(req, res) {
  try {
    const clients = await clientRepo.getAll();
    const safeClients = clients.map(c => ({
      ...c,
      rcs_password: c.rcs_password ? '***' : null,
      sms_password: c.sms_password ? '***' : null,
    }));
    res.json({ clients: safeClients });
  } catch (error) {
    logger.error('Admin getClients error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createClient(req, res) {
  try {
    const { client_name } = req.body;
    if (!client_name) {
      return res.status(400).json({ error: 'client_name is required' });
    }
    const bearer_token = req.body.bearer_token || crypto.randomBytes(32).toString('hex');

    const id = await clientRepo.createClient({ ...req.body, bearer_token });
    const newClient = await clientRepo.findById(id);
    if (newClient) {
      newClient.rcs_password = newClient.rcs_password ? '***' : null;
      newClient.sms_password = newClient.sms_password ? '***' : null;
    }

    logger.info('Admin: new client created', { clientId: id, clientName: client_name });
    res.status(201).json({ status: 'success', client: newClient });
  } catch (error) {
    logger.error('Admin createClient failed', { error: error.message });
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Bearer token already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}

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
    logger.error('Admin updateClient failed', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function toggleClientStatus(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid client id' });

    const client = await clientRepo.findById(id);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    await query('UPDATE clients SET is_active = NOT is_active WHERE id = ?', [id]);

    const updated = await clientRepo.findById(id);
    logger.info('Admin: client status toggled', { clientId: id, is_active: updated?.is_active });
    res.json({ status: 'success', is_active: updated?.is_active });
  } catch (error) {
    logger.error('Admin toggleClientStatus failed', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getMessages(req, res) {
  try {
    const limit  = Math.min(parseInt(req.query.limit,  10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0,  0);

    const filters = {
      clientId: req.query.clientId,
      status:   req.query.status,
      channel:  req.query.channel,
      dateFrom: req.query.dateFrom,
      dateTo:   req.query.dateTo,
    };

    const data = await adminRepo.getMessages(filters, limit, offset);
    res.json({ ...data, limit, offset });
  } catch (error) {
    logger.error('Admin getMessages failed', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getMessageDetail(req, res) {
  try {
    const id = parseInt(req.params.msgId, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid msgId' });

    const message = await messageRepo.findById(id);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    const events = await dlrRepo.findByCallbackData(message.callback_data);
    res.json({ message, dlrEvents: events });
  } catch (error) {
    logger.error('Admin getMessageDetail failed', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getDlrTracker(req, res) {
  try {
    const limit  = Math.min(parseInt(req.query.limit,  10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0,  0);

    const filters = {
      clientId: req.query.clientId,
      state:    req.query.state || 'stuck',
      dateFrom: req.query.dateFrom,
      dateTo:   req.query.dateTo,
    };

    // Both queries run in parallel at the DB level
    const [events, total] = await Promise.all([
      adminRepo.getDlrTracker(filters, limit, offset),
      adminRepo.countDlrTracker(filters),
    ]);

    res.json({ events, total, limit, offset });
  } catch (error) {
    logger.error('Admin getDlrTracker failed', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getOverviewStats,
  getClients,
  createClient,
  updateClient,
  toggleClientStatus,
  getMessages,
  getMessageDetail,
  getDlrTracker,
};
