const mysql = require('mysql2/promise');
require('dotenv').config();

async function syncCredentials() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [result] = await connection.execute(
      `UPDATE clients SET 
        rcs_username = ?, 
        rcs_password = ?, 
        sms_username = ?, 
        sms_password = ? 
       WHERE id = 1`,
      [
        process.env.SPARC_SERVICE_ACCOUNT,
        process.env.SPARC_API_PASSWORD,
        process.env.SPARC_SMS_USERNAME,
        process.env.SPARC_SMS_PASSWORD
      ]
    );
    
    if (result.affectedRows > 0) {
      console.log('Successfully synced credentials for client ID 1.');
    } else {
      console.log('No client with ID 1 found to update.');
    }
  } catch (err) {
    console.error('Error updating database:', err.message);
  } finally {
    await connection.end();
  }
}

syncCredentials();
