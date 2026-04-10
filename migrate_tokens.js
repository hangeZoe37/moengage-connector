'use strict';
require('dotenv').config();
const { query } = require('./src/config/db');
const crypto = require('crypto');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

async function migrateTokens() {
  console.log('Starting Bearer Token Migration...');
  try {
    const clients = await query('SELECT id, bearer_token FROM clients');
    console.log(`Found ${clients.length} clients.`);
    let migrated = 0;
    for (const c of clients) {
      // SHA-256 hex is always exactly 64 chars. If already hashed, skip.
      const isHashed = /^[a-f0-9]{64}$/i.test(c.bearer_token);
      if (!isHashed) {
        const hashed = hashToken(c.bearer_token);
        await query('UPDATE clients SET bearer_token = ? WHERE id = ?', [hashed, c.id]);
        console.log(`  Client ${c.id}: token hashed.`);
        migrated++;
      } else {
        console.log(`  Client ${c.id}: already hashed, skipped.`);
      }
    }
    console.log(`Done. ${migrated} token(s) migrated.`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}
migrateTokens();
