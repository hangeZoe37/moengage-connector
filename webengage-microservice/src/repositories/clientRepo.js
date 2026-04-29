'use strict';

const { pools } = require('../config/db');

async function findById(id) {
  const [rows] = await pools.WEBENGAGE.query(
    'SELECT * FROM clients WHERE id = ?',
    [id]
  );
  return rows[0];
}

async function findByApiKey(apiKey) {
  const [rows] = await pools.WEBENGAGE.query(
    'SELECT * FROM clients WHERE rcs_username = ?',
    [apiKey]
  );
  return rows[0];
}

module.exports = {
  findById,
  findByApiKey
};
