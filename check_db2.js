require('dotenv').config();
const { query } = require('./src/config/db');

async function test() {
  const rows = await query("SELECT id, callback_data, connector_type FROM message_logs WHERE callback_data = 'web_card_1776704434'");
  console.log(rows);
  process.exit(0);
}

test();
