'use strict';

const { adminQuery } = require('../config/db');

class AuthRepo {
  /**
   * Fetches the admin record by username.
   */
  async getAdminByUsername(username) {
    const rows = await adminQuery(
      'SELECT * FROM admins WHERE username = ? LIMIT 1',
      [username]
    );
    return rows[0] || null;
  }
}

module.exports = new AuthRepo();
