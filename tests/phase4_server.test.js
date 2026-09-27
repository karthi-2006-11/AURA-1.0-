const http = require('http');
const assert = require('assert');
const { app } = require('../backend/server');

// Run on an isolated port to avoid port conflicts with running dev server
const PORT = 3003;
const server = app.listen(PORT, async () => {
  console.log(`Phase 4 Integration Test server running on port ${PORT}`);

  try {
    // 1. Test POST /api/trains/search
    const searchRes = await makeRequest('/api/trains/search', 'POST', {
      source: 'Chennai',
      destination: 'Coimbatore',
      date: 'tomorrow',
      class: '3A',
      passengers: 2
    });

    assert.strictEqual(searchRes.status, 200);
    assert.strictEqual(searchRes.body.success, true);
    assert.strictEqual(searchRes.body.mock, true);
    assert.strictEqual(searchRes.body.provider, 'mock');
    assert.ok(searchRes.body.trains.length >= 2);
    assert.ok(searchRes.body.disclaimer.includes('MOCK RAILWAY PROVIDER'));
    console.log('[PASS] HTTP Test 1: POST /api/trains/search');

    // 2. Start an agent session: POST /api/agent/message
    const initRes = await makeRequest('/api/agent/message', 'POST', {
      message: 'Book a train from Chennai to Coimbatore tomorrow for 2 people in 3AC'
    });
    assert.strictEqual(initRes.status, 200);
    assert.strictEqual(initRes.body.status, 'ready_for_confirmation');
    const taskId = initRes.body.task_id;
    console.log('[PASS] HTTP Test 2: POST /api/agent/message (init journey)');

    // 3. User confirms journey: POST /api/agent/message
    const confirmJourneyRes = await makeRequest('/api/agent/message', 'POST', {
      task_id: taskId,
      message: 'yes'
    });
    assert.strictEqual(confirmJourneyRes.status, 200);
    assert.strictEqual(confirmJourneyRes.body.status, 'confirmed');
    assert.strictEqual(confirmJourneyRes.body.next_action, 'booking_ready');
    assert.ok(confirmJourneyRes.body.available_trains.length >= 2);
    console.log('[PASS] HTTP Test 3: POST /api/agent/message (confirm & auto-search trains)');

    // 4. Select train via dedicated endpoint: POST /api/trains/select
    const selectRes = await makeRequest('/api/trains/select', 'POST', {
      task_id: taskId,
      train_number: '12673'
    });
    assert.strictEqual(selectRes.status, 200);
    assert.strictEqual(selectRes.body.success, true);
    assert.strictEqual(selectRes.body.status, 'booking_ready');
    assert.strictEqual(selectRes.body.selected_train.train_number, '12673');
    assert.strictEqual(selectRes.body.selected_train.train_name, 'Cheran Express');
    assert.ok(selectRes.body.availability.seats > 0);
    console.log('[PASS] HTTP Test 4: POST /api/trains/select');

    // 5. Check seat availability: POST /api/trains/availability
    const availRes = await makeRequest('/api/trains/availability', 'POST', {
      train_number: '12673',
      class: '3A'
    });
    assert.strictEqual(availRes.status, 200);
    assert.strictEqual(availRes.body.success, true);
    assert.strictEqual(availRes.body.train_number, '12673');
    assert.strictEqual(availRes.body.status, 'AVAILABLE');
    console.log('[PASS] HTTP Test 5: POST /api/trains/availability');

    // 6. Complete booking via POST /api/agent/book
    const bookRes = await makeRequest('/api/agent/book', 'POST', {
      task_id: taskId
    });
    assert.strictEqual(bookRes.status, 200);
    assert.strictEqual(bookRes.body.success, true);
    assert.strictEqual(bookRes.body.mock, true);
    assert.strictEqual(bookRes.body.status, 'booking_confirmed');
    assert.ok(bookRes.body.booking_result.booking_reference.startsWith('AURA-MOCK-'));
    assert.strictEqual(bookRes.body.booking_result.total_fare, 1700);
    assert.ok(bookRes.body.disclaimer.includes('MOCK RAILWAY PROVIDER'));
    console.log('[PASS] HTTP Test 6: POST /api/agent/book');

    // 7. Duplicate booking prevention on /api/agent/book
    const dupRes = await makeRequest('/api/agent/book', 'POST', {
      task_id: taskId
    });
    assert.strictEqual(dupRes.status, 400);
    assert.strictEqual(dupRes.body.success, false);
    assert.ok(dupRes.body.error.includes('already been completed'));
    console.log('[PASS] HTTP Test 7: Duplicate booking prevention on POST /api/agent/book');

    console.log('--- ALL PHASE 4 HTTP INTEGRATION TESTS PASSED! ---');
    server.close(() => process.exit(0));
  } catch (error) {
    console.error('Integration test failed:', error);
    server.close(() => process.exit(1));
  }
});

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: body ? JSON.parse(body) : null });
        } catch (e) {
          resolve({ status: res.statusCode, rawBody: body });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}
