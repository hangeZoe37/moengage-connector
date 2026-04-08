'use strict';

/**
 * src/controllers/adminController.js
 * Controller for Admin Panel routes (/admin).
 */

const adminRepo = require('../repositories/adminRepo');
const clientRepo = require('../repositories/clientRepo');
const messageRepo = require('../repositories/messageRepo');
const dlrRepo = require('../repositories/dlrRepo');
const logger = require('../config/logger');
const crypto = require('crypto');

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
    
    res.status(201).json({ status: 'success', client: newClient });
  } catch (error) {
    logger.error('Admin createClient failed', { error: error.message });
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
    
    // Instead of completely deleting, we update is_active status (as requested in the prompt: "Deactivating a client stops processing...")
    // Wait, clientRepo.deactivateClient deletes it. Let's write a custom query here or update clientRepo directly.
    const { query } = require('../config/db');
    await query('UPDATE clients SET is_active = NOT is_active WHERE id = ?', [id]);
    
    res.json({ status: 'success' });
  } catch (error) {
    logger.error('Admin toggleClientStatus failed', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getMessages(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;
    
    const filters = {
      clientId: req.query.clientId,
      status: req.query.status,
      channel: req.query.channel,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo
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
    const filters = {
      clientId: req.query.clientId,
      state: req.query.state || 'stuck', // default 'stuck' or 'exhausted'
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo
    };
    
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const rows = await adminRepo.getDlrTracker(filters);
    
    // Do simple in-memory pagination for DLR tracker since volume of stuck is usually low
    const total = rows.length;
    const paginated = rows.slice(offset, offset + limit);

    res.json({ events: paginated, total, limit, offset });
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
  getDlrTracker
};
