require('dotenv').config();
const { query } = require('./src/config/db');

async function fixView() {
  const columns = 'id, callback_data, client_id, connector_type, callback_url, destination, bot_id, template_name, message_type, fallback_order, sparc_message_id, sparc_transaction_id, status, raw_payload, has_url, created_at, updated_at';
  
  const sql = `
    CREATE OR REPLACE VIEW message_logs AS
    SELECT ${columns} FROM moengage_message_logs
    UNION ALL
    SELECT ${columns} FROM clevertap_message_logs
    UNION ALL
    SELECT ${columns} FROM webengage_message_logs
  `;
  try {
    await query(sql);
    console.log('SUCCESS: message_logs view updated with explicit columns.');
    process.exit(0);
  } catch (err) {
    console.error('ERROR updating view:', err.message);
    process.exit(1);
  }
}

fixView();
