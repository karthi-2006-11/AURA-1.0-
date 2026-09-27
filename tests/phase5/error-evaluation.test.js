/**
 * AURA — Phase 5: Error Handling & Robustness Evaluation Test
 * Evaluates missing tasks, malformed requests, missing fields, invalid trains,
 * invalid workflow states, duplicate bookings, cancellation, and verifies no stack trace leakage.
 */

const http = require('http');
const assert = require('assert');
const { app } = require('../../backend/server');
const BookingTask = require('../../backend/models/bookingTask');
const { getOrCreateTask } = require('../../backend/services/auraAgent');
const { getProvider } = require('../../backend/services/mockRailwayProvider');

const PORT = 3004;

function runErrorEvaluation() {
  return new Promise((resolve) => {
    const server = app.listen(PORT, async () => {
      const results = {
        total: 0,
        passed: 0,
        success_rate: 0,
        cases: [],
        failures: []
      };

      async function testErrorCase(name, testFn) {
        results.total++;
        try {
          await testFn();
          results.passed++;
          results.cases.push({ name, status: 'PASS' });
        } catch (err) {
          results.failures.push({ name, error: err.message });
          results.cases.push({ name, status: 'FAIL', error: err.message });
        }
      }

      try {
        // 1. Missing Task ID on /api/trains/select
        await testErrorCase('1. Missing Task ID on /api/trains/select', async () => {
          const res = await makeRequest('/api/trains/select', 'POST', { train_number: '12673' });
          assert.strictEqual(res.status, 400);
          assert.strictEqual(res.body.success, false);
          assert.ok(res.body.error.includes('task_id'));
          assertNoStackTrace(res);
        });

        // 2. Non-existent Task ID on /api/trains/select
        await testErrorCase('2. Non-existent Task ID on /api/trains/select', async () => {
          const res = await makeRequest('/api/trains/select', 'POST', { task_id: 'invalid_task_99999', train_number: '12673' });
          assert.strictEqual(res.status, 404);
          assert.strictEqual(res.body.success, false);
          assert.ok(res.body.error.includes('not found'));
          assertNoStackTrace(res);
        });

        // 3. Missing Train Number on /api/trains/select
        await testErrorCase('3. Missing Train Number on /api/trains/select', async () => {
          const taskId = `err_task_${Date.now()}`;
          getOrCreateTask(taskId);
          const res = await makeRequest('/api/trains/select', 'POST', { task_id: taskId });
          assert.strictEqual(res.status, 400);
          assert.strictEqual(res.body.success, false);
          assert.ok(res.body.error.includes('train_number'));
          assertNoStackTrace(res);
        });

        // 4. Missing Source on /api/trains/search
        await testErrorCase('4. Missing Source on /api/trains/search', async () => {
          const res = await makeRequest('/api/trains/search', 'POST', { destination: 'Coimbatore', date: 'tomorrow' });
          assert.strictEqual(res.status, 400);
          assert.strictEqual(res.body.success, false);
          assert.ok(res.body.error.includes('source'));
          assertNoStackTrace(res);
        });

        // 5. Missing Destination on /api/trains/search
        await testErrorCase('5. Missing Destination on /api/trains/search', async () => {
          const res = await makeRequest('/api/trains/search', 'POST', { source: 'Chennai', date: 'tomorrow' });
          assert.strictEqual(res.status, 400);
          assert.strictEqual(res.body.success, false);
          assert.ok(res.body.error.includes('destination'));
          assertNoStackTrace(res);
        });

        // 6. Missing Date on /api/trains/search
        await testErrorCase('6. Missing Date on /api/trains/search', async () => {
          const res = await makeRequest('/api/trains/search', 'POST', { source: 'Chennai', destination: 'Coimbatore' });
          assert.strictEqual(res.status, 400);
          assert.strictEqual(res.body.success, false);
          assert.ok(res.body.error.includes('date'));
          assertNoStackTrace(res);
        });

        // 7. Non-existent Train on /api/trains/select
        await testErrorCase('7. Non-existent Train Selection on /api/trains/select', async () => {
          const taskId = `err_inv_train_${Date.now()}`;
          const task = getOrCreateTask(taskId);
          task.booking = { source: 'Chennai', destination: 'Coimbatore', date: 'tomorrow', passengers: 1, class: '3A' };
          const res = await makeRequest('/api/trains/select', 'POST', { task_id: taskId, train_number: '99999' });
          assert.strictEqual(res.status, 400);
          assert.strictEqual(res.body.success, false);
          assert.ok(res.body.error.includes('not found in available'));
          assertNoStackTrace(res);
        });

        // 8. Missing Task ID on /api/agent/book
        await testErrorCase('8. Missing Task ID on /api/agent/book', async () => {
          const res = await makeRequest('/api/agent/book', 'POST', {});
          assert.strictEqual(res.status, 400);
          assert.strictEqual(res.body.success, false);
          assert.ok(res.body.error.includes('task_id'));
          assertNoStackTrace(res);
        });

        // 9. Non-existent Task ID on /api/agent/book
        await testErrorCase('9. Non-existent Task ID on /api/agent/book', async () => {
          const res = await makeRequest('/api/agent/book', 'POST', { task_id: 'fake_task_xyz' });
          assert.strictEqual(res.status, 404);
          assert.strictEqual(res.body.success, false);
          assert.ok(res.body.error.includes('not found'));
          assertNoStackTrace(res);
        });

        // 10. Booking before Selecting Train on /api/agent/book
        await testErrorCase('10. Booking before Selecting Train on /api/agent/book', async () => {
          const taskId = `err_unprep_${Date.now()}`;
          const task = getOrCreateTask(taskId);
          task.booking = { source: 'Chennai', destination: 'Coimbatore', date: 'tomorrow' };
          // No selected_train set
          const res = await makeRequest('/api/agent/book', 'POST', { task_id: taskId });
          assert.strictEqual(res.status, 400);
          assert.strictEqual(res.body.success, false);
          assert.ok(res.body.error.includes('selected') || res.body.error.includes('ready'));
          assertNoStackTrace(res);
        });

        // 11. Duplicate Booking Blocked on /api/agent/book
        await testErrorCase('11. Duplicate Booking Blocked on /api/agent/book', async () => {
          const taskId = `err_dup_${Date.now()}`;
          const task = getOrCreateTask(taskId);
          task.booking = { source: 'Chennai', destination: 'Coimbatore', date: 'tomorrow', passengers: 1, class: '3A' };
          task.selected_train = { train_number: '12673', train_name: 'Cheran Express', class: '3A', fare: 850 };
          const provider = getProvider();
          task.setBookingResult(provider.bookSync(task));

          const res = await makeRequest('/api/agent/book', 'POST', { task_id: taskId });
          assert.strictEqual(res.status, 400);
          assert.strictEqual(res.body.success, false);
          assert.ok(res.body.error.includes('already been completed'));
          assertNoStackTrace(res);
        });

        // 12. Malformed Empty Message on /api/agent/message
        await testErrorCase('12. Malformed Empty Message Handling on /api/agent/message', async () => {
          const res = await makeRequest('/api/agent/message', 'POST', { message: '   ' });
          assert.strictEqual(res.status, 200);
          assert.ok(res.body.message.includes('Please type'));
          assertNoStackTrace(res);
        });

        // 13. Cancellation in Agent Message
        await testErrorCase('13. Explicit Cancellation Handling', async () => {
          const taskId = `err_cancel_${Date.now()}`;
          await makeRequest('/api/agent/message', 'POST', { task_id: taskId, message: 'Book a train to Coimbatore' });
          const res = await makeRequest('/api/agent/message', 'POST', { task_id: taskId, message: 'cancel' });
          assert.strictEqual(res.status, 200);
          assert.strictEqual(res.body.status, 'cancelled');
          assert.strictEqual(res.body.next_action, 'none');
          assertNoStackTrace(res);
        });

        results.success_rate = parseFloat(((results.passed / results.total) * 100).toFixed(2));
      } finally {
        server.close(() => resolve(results));
      }
    });
  });
}

function assertNoStackTrace(res) {
  assert.strictEqual(res.body.stack, undefined, 'Stack trace must not be exposed in response body');
  if (res.rawBody) {
    assert.ok(!res.rawBody.includes('at Object.'), 'Stack trace frames must not appear in raw body');
    assert.ok(!res.rawBody.includes('node:internal'), 'Internal node frames must not appear in raw body');
  }
}

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
          resolve({ status: res.statusCode, body: body ? JSON.parse(body) : null, rawBody: body });
        } catch (e) {
          resolve({ status: res.statusCode, rawBody: body, body: null });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

if (require.main === module) {
  console.log('=== RUNNING AURA PHASE 5 ERROR EVALUATION ===');
  runErrorEvaluation().then(res => {
    console.log('------------------------------------------------------------');
    console.log(`Total Error Tests: ${res.total}`);
    console.log(`Passed Tests:      ${res.passed}`);
    console.log(`Success Rate:      ${res.success_rate}%`);
    console.log('------------------------------------------------------------');
    res.cases.forEach(c => console.log(`[${c.status}] ${c.name}`));

    if (res.failures.length > 0) {
      console.log('\nFailures:');
      res.failures.forEach(f => console.log(`- ${f.name}: ${f.error}`));
      process.exit(1);
    } else {
      console.log('\nAll Error Handling evaluations passed with 100% success rate!');
      process.exit(0);
    }
  });
}

module.exports = { runErrorEvaluation };
