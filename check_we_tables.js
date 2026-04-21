require('dotenv').config();
const { query } = require('./src/config/db');

async function checkTables() {
  const tables = await query("SHOW TABLES LIKE 'webengage_%'");
  console.log('WebEngage tables found:');
  tables.forEach(t => console.log(' -', Object.values(t)[0]));
  process.exit(0);
}
checkTables();
