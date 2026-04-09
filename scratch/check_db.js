const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkClients() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [rows] = await connection.execute('SELECT * FROM clients');
    console.log('Clients count:', rows.length);
    if (rows.length > 0) {
      console.log('First client:', JSON.stringify(rows[0], null, 2));
    } else {
      console.log('No clients found in the database.');
    }
  } catch (err) {
    console.error('Error querying database:', err.message);
  } finally {
    await connection.end();
  }
}

checkClients();
