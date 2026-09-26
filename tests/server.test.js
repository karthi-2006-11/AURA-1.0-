const http = require('http');
const { app } = require('../backend/server');

const testPort = 3001;
const server = app.listen(testPort, async () => {
  console.log(`Test server running on port ${testPort}`);

  const postData = JSON.stringify({
    message: "Book me a train from Chennai to Coimbatore tomorrow evening for 2 people in 3AC."
  });

  const options = {
    hostname: 'localhost',
    port: testPort,
    path: '/api/analyze',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('HTTP Status:', res.statusCode);
      console.log('Response body:', data);
      const parsed = JSON.parse(data);
      if (parsed.valid === true && parsed.source === 'Chennai' && parsed.destination === 'Coimbatore') {
        console.log('--- API INTEGRATION TEST PASSED! ---');
        server.close(() => process.exit(0));
      } else {
        console.error('--- API TEST FAILED! ---');
        server.close(() => process.exit(1));
      }
    });
  });

  req.on('error', (e) => {
    console.error(`Request error: ${e.message}`);
    server.close(() => process.exit(1));
  });

  req.write(postData);
  req.end();
});
