require('dotenv').config();
const { query } = require('./src/config/db');

async function updateDb() {
  try {
    console.log('Updating sms_track_links for target_url...');
    await query("UPDATE sms_track_links SET target_url = 'https://smartping.ai/', track_link_id = '129242' WHERE id = 1");
    console.log('Update successful! target_url set to https://smartping.ai/');
    process.exit(0);
  } catch (e) {
    console.error('Failed to update db:', e);
    process.exit(1);
  }
}

updateDb();
