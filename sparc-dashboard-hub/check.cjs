const mysql = require('mysql2/promise');

async function run() {
  const c = await mysql.createConnection({host:'127.0.0.1', user:'root', password:'reset@123', database:'sparc_moengage_db'});
  const [rows] = await c.query("SELECT status, has_fallback FROM message_logs WHERE status LIKE '%SMS%' OR has_fallback > 0 LIMIT 5");
  console.log(rows);
  await c.end();
}
run();
