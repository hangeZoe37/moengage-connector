const http = require('http');

const bearerToken = 'REPLACE_WITH_SECURE_BEARER_TOKEN';
const port = 3000;

const payload = JSON.stringify({
  messages: [
    {
      destination: "+919990927990",
      callback_data: "test_delay_" + Date.now(),
      fallback_order: ["RCS"],
      rcs: {
        bot_id: "677baf920f6d1f157306740b",
        message_content: {
          type: "TEXT",
          data: {
            text: "Testing delay..."
          }
        }
      }
    }
  ]
});

const options = {
  hostname: 'localhost',
  port: port,
  path: '/integrations/moengage/rcs/send',
  method: 'POST',
  headers: {
    'Authentication': 'Bearer ' + bearerToken,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

console.log('--- Sending request to connector ---');
const start = Date.now();

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log(`Response received in ${Date.now() - start}ms`);
    console.log('Status:', res.statusCode);
    console.log('Body:', data);
    console.log('\nWait 5 seconds and check the terminal where the server is running!');
    console.log('You should see: "rcs sent | callback_data: ... | timestamp: ..."');
  });
});

req.on('error', (e) => console.error(`Problem with request: ${e.message}`));
req.write(payload);
req.end();
