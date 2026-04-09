const mysql = require('mysql2/promise');
require('dotenv').config();

async function getClient() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
  });

  try {
    const [rows] = await connection.execute('SELECT client_name, auth_token FROM clients LIMIT 1');
    console.log(JSON.stringify(rows[0]));
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

getClient();
