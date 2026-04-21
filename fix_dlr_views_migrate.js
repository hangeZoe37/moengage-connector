require('dotenv').config();
const { query } = require('./src/config/db');

async function fixDlrViewAndMigrate() {
  console.log('Step 1: Checking column order in dlr_events tables...');
  const mCols = await query('DESCRIBE moengage_dlr_events');
  const wCols = await query('DESCRIBE webengage_dlr_events');
  console.log('MOENGAGE cols:', mCols.map(f => f.Field).join(', '));
  console.log('WEBENGAGE cols:', wCols.map(f => f.Field).join(', '));

  // Fix the dlr_events view with explicit columns in correct order
  const cols = mCols.map(f => f.Field).join(', ');
  console.log('\nStep 2: Recreating dlr_events view with explicit columns...');
  const viewSql = `
    CREATE OR REPLACE VIEW dlr_events AS
    SELECT ${cols} FROM moengage_dlr_events
    UNION ALL
    SELECT ${cols} FROM clevertap_dlr_events
    UNION ALL
    SELECT ${cols} FROM webengage_dlr_events
  `;
  await query(viewSql);
  console.log('dlr_events view updated ✅');

  // Fix suggestion_events view too
  const sCols = await query('DESCRIBE moengage_suggestion_events');
  const sCsv = sCols.map(f => f.Field).join(', ');
  const sugViewSql = `
    CREATE OR REPLACE VIEW suggestion_events AS
    SELECT ${sCsv} FROM moengage_suggestion_events
    UNION ALL
    SELECT ${sCsv} FROM clevertap_suggestion_events
    UNION ALL
    SELECT ${sCsv} FROM webengage_suggestion_events
  `;
  await query(sugViewSql);
  console.log('suggestion_events view updated ✅');

  // Step 3: Migrate misrouted WebEngage DLR records from moengage table
  console.log('\nStep 3: Migrating misrouted WebEngage DLRs...');
  const misrouted = await query(
    "SELECT * FROM moengage_dlr_events WHERE callback_data LIKE 'web\\_%'"
  );
  console.log(`Found ${misrouted.length} WebEngage DLRs in moengage_dlr_events`);

  if (misrouted.length > 0) {
    for (const row of misrouted) {
      await query(
        `INSERT IGNORE INTO webengage_dlr_events
         (callback_data, sparc_status, moe_status, error_message, event_timestamp, callback_dispatched, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [row.callback_data, row.sparc_status, row.moe_status, row.error_message, row.event_timestamp, row.callback_dispatched, row.created_at]
      );
      await query("DELETE FROM moengage_dlr_events WHERE id = ?", [row.id]);
    }
    console.log(`Migrated ${misrouted.length} records ✅`);
  }

  // Step 4: Migrate misrouted WebEngage suggestion events
  console.log('\nStep 4: Migrating misrouted WebEngage suggestion events...');
  const misroutedSug = await query(
    "SELECT * FROM moengage_suggestion_events WHERE callback_data LIKE 'web\\_%'"
  );
  console.log(`Found ${misroutedSug.length} WebEngage suggestion events in moengage_suggestion_events`);

  if (misroutedSug.length > 0) {
    for (const row of misroutedSug) {
      await query(
        `INSERT IGNORE INTO webengage_suggestion_events
         (callback_data, suggestion_text, postback_data, event_timestamp, callback_dispatched, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [row.callback_data, row.suggestion_text, row.postback_data, row.event_timestamp, row.callback_dispatched, row.created_at]
      );
      await query("DELETE FROM moengage_suggestion_events WHERE id = ?", [row.id]);
    }
    console.log(`Migrated ${misroutedSug.length} suggestion records ✅`);
  }

  console.log('\nAll done! ✅');
  process.exit(0);
}

fixDlrViewAndMigrate().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
