const assert = require('assert');
const { processAgentMessage, resetTask } = require('../backend/services/auraAgent');

console.log('--- RUNNING AURA PHASE 2 AGENT WORKFLOW TESTS ---');

let passedTests = 0;
let totalTests = 0;

function runTest(testName, testFn) {
  totalTests++;
  try {
    testFn();
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${testName}`);
    console.error(`       Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// ========================================================
// TEST 1 — Complete Request Reaches Confirmation Directly
// ========================================================
runTest('TEST 1: Complete request reaches ready_for_confirmation directly', () => {
  const res = processAgentMessage(null, 'Book a train from Chennai to Coimbatore tomorrow for 2 passengers in 3AC.');

  assert.strictEqual(res.status, 'ready_for_confirmation');
  assert.strictEqual(res.next_action, 'request_confirmation');
  assert.strictEqual(res.booking.source, 'Chennai');
  assert.strictEqual(res.booking.destination, 'Coimbatore');
  assert.strictEqual(res.booking.date, 'tomorrow');
  assert.strictEqual(res.booking.passengers, 2);
  assert.strictEqual(res.booking.class, '3A');
  assert.deepStrictEqual(res.missing_fields, []);
  assert.ok(res.message.includes('Would you like to proceed?'));
});

// ========================================================
// TEST 2 — Missing Source Station
// ========================================================
runTest('TEST 2: Missing source station triggers request_source', () => {
  const res = processAgentMessage(null, 'Book a train to Coimbatore tomorrow.');

  assert.strictEqual(res.status, 'collecting_information');
  assert.strictEqual(res.next_action, 'request_source');
  assert.strictEqual(res.booking.source, null);
  assert.strictEqual(res.booking.destination, 'Coimbatore');
  assert.strictEqual(res.booking.date, 'tomorrow');
  assert.ok(res.missing_fields.includes('source'));
  assert.ok(res.message.toLowerCase().includes('what station') || res.message.toLowerCase().includes('from'));
});

// ========================================================
// TEST 3 — Multi-turn Completion Workflow
// ========================================================
runTest('TEST 3: Multi-turn completion workflow across 3 steps', () => {
  // Step 1: Initial query with source, destination, date
  const turn1 = processAgentMessage(null, 'Book a train from Chennai to Coimbatore tomorrow.');
  assert.strictEqual(turn1.status, 'collecting_information');
  assert.strictEqual(turn1.next_action, 'request_passengers');
  assert.ok(turn1.message.toLowerCase().includes('passengers'));

  const taskId = turn1.task_id;

  // Step 2: User answers passenger count
  const turn2 = processAgentMessage(taskId, '2');
  assert.strictEqual(turn2.booking.passengers, 2);
  assert.strictEqual(turn2.status, 'collecting_information');
  assert.strictEqual(turn2.next_action, 'request_class');
  assert.ok(turn2.message.toLowerCase().includes('class'));

  // Step 3: User answers class preference
  const turn3 = processAgentMessage(taskId, '3AC');
  assert.strictEqual(turn3.booking.class, '3A');
  assert.strictEqual(turn3.status, 'ready_for_confirmation');
  assert.strictEqual(turn3.next_action, 'request_confirmation');
  assert.ok(turn3.message.includes('Would you like to proceed?'));
});

// ========================================================
// TEST 4 — Short Response Interpretation (Passengers)
// ========================================================
runTest('TEST 4: Short response interpretation for passenger count', () => {
  const turn1 = processAgentMessage(null, 'Book a train from Chennai to Madurai today.');
  const taskId = turn1.task_id;

  assert.strictEqual(turn1.next_action, 'request_passengers');

  // Short response: "3"
  const turn2 = processAgentMessage(taskId, '3');
  assert.strictEqual(turn2.booking.passengers, 3);
  assert.notStrictEqual(turn2.booking.destination, '3');
});

// ========================================================
// TEST 5 — Class Normalization
// ========================================================
runTest('TEST 5: Class normalization (3AC -> 3A, sleeper -> SL)', () => {
  const turn1 = processAgentMessage(null, 'Book a train from Chennai to Salem tomorrow for 1 passenger.');
  const taskId = turn1.task_id;

  assert.strictEqual(turn1.next_action, 'request_class');

  const turn2 = processAgentMessage(taskId, '3AC');
  assert.strictEqual(turn2.booking.class, '3A');

  // Verify another class normalization on a new session
  const turnSleeper = processAgentMessage(null, 'Book a train from Bangalore to Chennai today for 2 people in sleeper');
  assert.strictEqual(turnSleeper.booking.class, 'SL');
});

// ========================================================
// TEST 6 — User Confirmation Workflow
// ========================================================
runTest('TEST 6: Confirmation moves status to confirmed without real booking', () => {
  const complete = processAgentMessage(null, 'Book a train from Chennai to Coimbatore tomorrow for 2 people in 3AC.');
  const taskId = complete.task_id;

  assert.strictEqual(complete.status, 'ready_for_confirmation');

  // User confirms with "yes"
  const confirmRes = processAgentMessage(taskId, 'yes');
  assert.strictEqual(confirmRes.status, 'confirmed');
  assert.strictEqual(confirmRes.next_action, 'booking_ready');
  assert.ok(confirmRes.message.includes('confirmed for the next booking step'));
  assert.ok(confirmRes.message.includes('Phase 2'));
});

// ========================================================
// TEST 7 — User Cancellation Workflow
// ========================================================
runTest('TEST 7: Cancellation moves status to cancelled', () => {
  const complete = processAgentMessage(null, 'Book a train from Chennai to Coimbatore tomorrow for 2 people in 3AC.');
  const taskId = complete.task_id;

  assert.strictEqual(complete.status, 'ready_for_confirmation');

  // User cancels with "cancel"
  const cancelRes = processAgentMessage(taskId, 'cancel');
  assert.strictEqual(cancelRes.status, 'cancelled');
  assert.strictEqual(cancelRes.next_action, 'none');
  assert.ok(cancelRes.message.toLowerCase().includes('cancelled'));
});

// ========================================================
// TEST 8 — Multi-turn State Persistence Across All Turns
// ========================================================
runTest('TEST 8: Multiple turns preserve all earlier details', () => {
  // Start with only source and destination
  const t1 = processAgentMessage(null, 'Book a train from Chennai to Bangalore');
  const taskId = t1.task_id;

  assert.strictEqual(t1.booking.source, 'Chennai');
  assert.strictEqual(t1.booking.destination, 'Bangalore');
  assert.strictEqual(t1.next_action, 'request_date');

  // Provide date
  const t2 = processAgentMessage(taskId, 'tomorrow');
  assert.strictEqual(t2.booking.source, 'Chennai');
  assert.strictEqual(t2.booking.destination, 'Bangalore');
  assert.strictEqual(t2.booking.date, 'tomorrow');
  assert.strictEqual(t2.next_action, 'request_passengers');

  // Provide passengers
  const t3 = processAgentMessage(taskId, '4 adults');
  assert.strictEqual(t3.booking.source, 'Chennai');
  assert.strictEqual(t3.booking.destination, 'Bangalore');
  assert.strictEqual(t3.booking.date, 'tomorrow');
  assert.strictEqual(t3.booking.passengers, 4);
  assert.strictEqual(t3.next_action, 'request_class');

  // Provide class
  const t4 = processAgentMessage(taskId, 'second seating');
  assert.strictEqual(t4.booking.source, 'Chennai');
  assert.strictEqual(t4.booking.destination, 'Bangalore');
  assert.strictEqual(t4.booking.date, 'tomorrow');
  assert.strictEqual(t4.booking.passengers, 4);
  assert.strictEqual(t4.booking.class, '2S');
  assert.strictEqual(t4.status, 'ready_for_confirmation');
});

console.log('-----------------------------------------');
console.log(`Summary: ${passedTests}/${totalTests} tests passed.`);
console.log('-----------------------------------------');

if (passedTests === totalTests) {
  console.log('All Phase 2 Agent tests passed successfully!');
} else {
  console.error('Some tests failed!');
  process.exit(1);
}
