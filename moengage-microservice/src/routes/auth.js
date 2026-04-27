'use strict';

/**
 * src/routes/auth.js
 * Exposes login endpoint for the microservice.
 */

const { Router } = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const authRepo = require('../repositories/authRepo');
const logger = require('../config/logger');

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const admin = await authRepo.getAdminByUsername(username);
    
    if (!admin) {
      logger.warn('Admin login failed: Unknown user', { ip: req.ip, username });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Evaluate against bcrypt stored hash
    const isValid = await bcrypt.compare(password, admin.password_hash);
    if (!isValid) {
      logger.warn('Admin login failed: Invalid password', { ip: req.ip, username });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Issue a JWT token valid for 24 hours
    const token = jwt.sign(
      { username: admin.username, role: 'admin' }, 
      process.env.JWT_SECRET || 'localdev_jwt_secret_do_not_use_in_prod', 
      { expiresIn: '24h' }
    );
    
    logger.info('Admin login successful', { ip: req.ip, username });
    return res.json({ token, message: 'Login successful' });
  } catch (error) {
    logger.error('Error during admin login', { error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
