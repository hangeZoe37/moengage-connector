'use strict';

const { Router } = require('express');
const clientRepo = require('../repositories/clientRepo');

const router = Router();

/**
 * Helper endpoint for Postman to sync with the database.
 * Returns the first active client's configuration.
 */
router.get('/sync-config', async (req, res) => {
  try {
    const clients = await clientRepo.getAll();
    const client = clients.find(c => c.is_active);

    if (!client) {
      return res.status(404).json({ error: 'No active clients found in DB' });
    }

    // Map EXACTLY what is in the DB
    res.json({
      client_name: client.client_name,
      bot_id: client.rcs_username,          // tstrcs444
      rcs_assistant_id: client.rcs_assistant_id, // 677baf92...
      sms_sender: client.sms_username,      // testotp01.trans
      sms_template_id: '1234567890',        // Default for testing
      bearer_token_in_db: client.bearer_token, // The 5d537485... hash
      rcs_password: client.rcs_password,
      sms_password: client.sms_password
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Mock endpoint to receive MoEngage status updates (DLRs)
 */
router.post('/moengage-dlr', (req, res) => {
  console.log('--- RECEIVED MOENGAGE DLR ---');
  console.log(JSON.stringify(req.body, null, 2));
  console.log('-----------------------------');
  res.status(200).json({ status: 'Success' });
});

module.exports = router;
