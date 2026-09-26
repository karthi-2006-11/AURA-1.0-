const assert = require('assert');
const { analyzeRequest } = require('../backend/services/auraParser');

console.log('--- RUNNING AURA PHASE 1 PARSER TESTS ---');

let passedTests = 0;
let totalTests = 0;

function runTest(testName, input, assertions) {
  totalTests++;
  try {
    const result = analyzeRequest(input);
    assertions(result);
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${testName}`);
    console.error(`       Input: "${input}"`);
    console.error(`       Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// ==========================================
// MANDATORY TEST CASES FROM SPECIFICATION
// ==========================================

// TEST 1: Full Train Booking Request with All Entities
runTest('Test 1: Full Train Booking Request',
  'Book a train from Chennai to Coimbatore tomorrow evening for 2 people in 3AC.',
  (res) => {
    assert.strictEqual(res.intent, 'train_booking');
    assert.strictEqual(res.source, 'Chennai');
    assert.strictEqual(res.destination, 'Coimbatore');
    assert.strictEqual(res.date, 'tomorrow');
    assert.strictEqual(res.time_preference, 'evening');
    assert.strictEqual(res.passengers, 2);
    assert.strictEqual(res.class, '3A');
    assert.deepStrictEqual(res.missing_fields, []);
    assert.strictEqual(res.valid, true);
  }
);

// TEST 2: Basic Booking with Only Mandatory Entities
runTest('Test 2: Basic Booking Request',
  'I want to travel from Chennai to Bangalore tomorrow.',
  (res) => {
    assert.strictEqual(res.intent, 'train_booking');
    assert.strictEqual(res.source, 'Chennai');
    assert.strictEqual(res.destination, 'Bangalore');
    assert.strictEqual(res.date, 'tomorrow');
    assert.strictEqual(res.time_preference, null);
    assert.strictEqual(res.passengers, null);
    assert.strictEqual(res.class, null);
    assert.deepStrictEqual(res.missing_fields, []);
    assert.strictEqual(res.valid, true);
  }
);

// TEST 3: Missing Date with Class and Passengers
runTest('Test 3: Missing Date Request',
  'Book me a sleeper train from Madurai to Chennai for 3 passengers.',
  (res) => {
    assert.strictEqual(res.intent, 'train_booking');
    assert.strictEqual(res.source, 'Madurai');
    assert.strictEqual(res.destination, 'Chennai');
    assert.strictEqual(res.passengers, 3);
    assert.strictEqual(res.class, 'SL');
    assert.strictEqual(res.date, null);
    assert.strictEqual(res.valid, false);
    assert.ok(res.missing_fields.includes('date'));
  }
);

// TEST 4: Non-railway / Unknown Intent
runTest('Test 4: Non-Railway Intent Request',
  'Hello, how are you?',
  (res) => {
    assert.strictEqual(res.intent, 'unknown');
    assert.strictEqual(res.valid, false);
  }
);

// TEST 5: Missing Source Station
runTest('Test 5: Missing Source Station Request',
  'Book a train to Coimbatore tomorrow.',
  (res) => {
    assert.strictEqual(res.intent, 'train_booking');
    assert.strictEqual(res.destination, 'Coimbatore');
    assert.strictEqual(res.date, 'tomorrow');
    assert.strictEqual(res.source, null);
    assert.strictEqual(res.valid, false);
    assert.ok(res.missing_fields.includes('source'));
  }
);

// ==========================================
// ADDITIONAL EDGE CASE TESTS
// ==========================================

// TEST 6: Empty Input Handling
runTest('Test 6: Empty Input Handling',
  '',
  (res) => {
    assert.strictEqual(res.intent, 'unknown');
    assert.strictEqual(res.valid, false);
  }
);

// TEST 7: Number Words ("two people", "second seating")
runTest('Test 7: Word Numbers and Alternative Classes',
  'Find a train from Salem to Chennai day after tomorrow for two people in second seating',
  (res) => {
    assert.strictEqual(res.intent, 'train_booking');
    assert.strictEqual(res.source, 'Salem');
    assert.strictEqual(res.destination, 'Chennai');
    assert.strictEqual(res.date, 'day after tomorrow');
    assert.strictEqual(res.passengers, 2);
    assert.strictEqual(res.class, '2S');
    assert.strictEqual(res.valid, true);
  }
);

// TEST 8: Explicit Calendar Date
runTest('Test 8: Explicit Calendar Date',
  'Need a train from Delhi to Mumbai on 25th March morning for 1 passenger',
  (res) => {
    assert.strictEqual(res.intent, 'train_booking');
    assert.strictEqual(res.source, 'Delhi');
    assert.strictEqual(res.destination, 'Mumbai');
    assert.strictEqual(res.date, '25th March');
    assert.strictEqual(res.time_preference, 'morning');
    assert.strictEqual(res.passengers, 1);
    assert.strictEqual(res.valid, true);
  }
);

console.log('-----------------------------------------');
console.log(`Summary: ${passedTests}/${totalTests} tests passed.`);
console.log('-----------------------------------------');

if (passedTests === totalTests) {
  console.log('All tests passed successfully!');
} else {
  console.error('Some tests failed!');
  process.exit(1);
}
