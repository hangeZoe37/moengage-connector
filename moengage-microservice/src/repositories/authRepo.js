'use strict';

const db = require('../config/db');

class AuthRepo {
  /**
   * Fetches the admin record by username from the shared sparc_admin database.
   */
  async getAdminByUsername(username) {
    const rows = await db.adminQuery(
      'SELECT * FROM admins WHERE username = ? LIMIT 1',
      [username]
    );
    return rows[0] || null;
  }
}

module.exports = new AuthRepo();
