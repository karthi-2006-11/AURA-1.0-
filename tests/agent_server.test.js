const http = require('http');
const { app } = require('../backend/server');

const testPort = 3002;
const server = app.listen(testPort, async () => {
  console.log(`Agent test server running on port ${testPort}`);

  function makePost(path, body) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(body);
      const req = http.request({
        hostname: 'localhost',
        port: testPort,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  try {
    // 1. Initial message missing passengers & class
    const r1 = await makePost('/api/agent/message', {
      message: 'Book me a train from Chennai to Coimbatore tomorrow.'
    });
    console.log('Turn 1 Status:', r1.body.status, '| Next Action:', r1.body.next_action);
    const taskId = r1.body.task_id;

    // 2. Answer passengers
    const r2 = await makePost('/api/agent/message', {
      task_id: taskId,
      message: '2'
    });
    console.log('Turn 2 Passengers:', r2.body.booking.passengers, '| Next Action:', r2.body.next_action);

    // 3. Answer class
    const r3 = await makePost('/api/agent/message', {
      task_id: taskId,
      message: '3AC'
    });
    console.log('Turn 3 Status:', r3.body.status, '| Next Action:', r3.body.next_action);

    // 4. Confirm
    const r4 = await makePost('/api/agent/message', {
      task_id: taskId,
      message: 'yes'
    });
    console.log('Turn 4 Final Status:', r4.body.status, '| Next Action:', r4.body.next_action);

    if (r4.body.status === 'confirmed' && r4.body.next_action === 'booking_ready') {
      console.log('--- AGENT HTTP WORKFLOW TEST PASSED! ---');
      server.close(() => process.exit(0));
    } else {
      console.error('--- TEST FAILED ---');
      server.close(() => process.exit(1));
    }
  } catch (err) {
    console.error('Error during agent server test:', err);
    server.close(() => process.exit(1));
  }
});
