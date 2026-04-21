require('dotenv').config();
const { query } = require('./src/config/db');

async function test() {
  const rows = await query("SELECT id, callback_data, connector_type FROM webengage_message_logs ORDER BY id DESC LIMIT 5");
  console.log(rows);
  process.exit(0);
}

test();
