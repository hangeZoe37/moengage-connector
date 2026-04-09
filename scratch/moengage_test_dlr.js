/**
 * scratch/moengage_test_dlr.js
 * 
 * Dependency-free test script:
 * 1. Grabs the most recent message from the DB.
 * 2. Fires a manual DLR to the local connector.
 * 
 * Usage: node scratch/moengage_test_dlr.js
 */

require('dotenv').config();
const http = require('http');
const mysql = require('mysql2/promise');

async function runTest() {
  console.log('--- Starting MoEngage Testing DLR ---');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
  });

  try {
    const [rows] = await connection.execute(
      'SELECT callback_data FROM message_logs ORDER BY id DESC LIMIT 1'
    );

    if (rows.length === 0) {
      console.error('Error: No messages found. Send an RCS message first!');
      process.exit(1);
    }

    const callbackData = rows[0].callback_data;
    const port = process.env.PORT || 3000;
    const payload = JSON.stringify({
      seq_id: callbackData,
      status: 'DELIVERED'
    });

    console.log(`Found message: ${callbackData}. Firing DLR...`);

    const options = {
      hostname: 'localhost',
      port: port,
      path: '/sparc/webhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('--- Result ---');
        console.log(`Status: ${res.statusCode}`);
        console.log(`Response: ${data}`);
        console.log('\nCheck your logs! You should see MoEngage being notified.');
      });
    });

    req.on('error', (e) => console.error(`Problem with request: ${e.message}`));
    req.write(payload);
    req.end();

  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await connection.end();
  }
}

runTest();
