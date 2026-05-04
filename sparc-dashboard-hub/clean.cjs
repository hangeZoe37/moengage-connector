const mysql = require('mysql2/promise');

async function clean() {
  const configs = [
    { db: 'sparc_moengage_db', keep: 'moe_%' },
    { db: 'sparc_clevertap_db', keep: 'ct_%' },
    { db: 'sparc_webengage_db', keep: 'web_%' }
  ];

  for (const c of configs) {
    const conn = await mysql.createConnection({host:'127.0.0.1', user:'root', password:'reset@123', database: c.db});
    
    // Check how many invalid records exist
    const [dlr] = await conn.query(`SELECT COUNT(*) as count FROM dlr_events WHERE callback_data NOT LIKE ?`, [c.keep]);
    const [sug] = await conn.query(`SELECT COUNT(*) as count FROM suggestion_events WHERE callback_data NOT LIKE ?`, [c.keep]);
    const [msg] = await conn.query(`SELECT COUNT(*) as count FROM message_logs WHERE callback_data NOT LIKE ? AND callback_data != '' AND callback_data IS NOT NULL`, [c.keep]);
    
    console.log(`${c.db} invalid - DLR: ${dlr[0].count}, SUG: ${sug[0].count}, MSG: ${msg[0].count}`);
    
    // Delete them
    await conn.query(`DELETE FROM dlr_events WHERE callback_data NOT LIKE ?`, [c.keep]);
    await conn.query(`DELETE FROM suggestion_events WHERE callback_data NOT LIKE ?`, [c.keep]);
    await conn.query(`DELETE FROM message_logs WHERE callback_data NOT LIKE ? AND callback_data != '' AND callback_data IS NOT NULL`, [c.keep]);
    
    console.log(`Cleaned ${c.db}`);
    await conn.end();
  }
}
clean().catch(console.error);
