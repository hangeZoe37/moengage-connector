const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateAssistantId() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const assistantId = '677baf920f6d1f157306740b';
    const [result] = await connection.execute(
      'UPDATE clients SET rcs_assistant_id = ? WHERE id = 1',
      [assistantId]
    );
    
    if (result.affectedRows > 0) {
      console.log('Successfully updated assistant ID for client 1 to:', assistantId);
    } else {
      console.log('No client with ID 1 found.');
    }
  } catch (err) {
    console.error('Error updating database:', err.message);
  } finally {
    await connection.end();
  }
}

updateAssistantId();
