const assert = require('assert');
const { getProvider, MockRailwayProvider } = require('../backend/services/mockRailwayProvider');
const railwayConfig = require('../backend/config/railway');
const { processAgentMessage, resetTask, getOrCreateTask } = require('../backend/services/auraAgent');
const BookingTask = require('../backend/models/bookingTask');

console.log('--- RUNNING AURA PHASE 4 RAILWAY WORKFLOW TESTS ---');

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

// 1. Railway Provider Initialization
runTest('TEST 1: Railway provider initialization and default mock config', () => {
  assert.strictEqual(railwayConfig.provider, 'mock');
  const provider = getProvider();
  assert.ok(provider instanceof MockRailwayProvider);
  assert.strictEqual(provider.name, 'MockRailwayProvider');
});

// 2. Mock Train Search
runTest('TEST 2: Mock train search returns matching trains with mock flags', () => {
  const provider = getProvider();
  const trains = provider.searchTrainsSync({
    source: 'Chennai',
    destination: 'Coimbatore',
    date: '2026-09-28',
    class: '3A',
    passengers: 2
  });

  assert.ok(Array.isArray(trains));
  assert.ok(trains.length >= 2);
  const t1 = trains[0];
  assert.strictEqual(t1.source, 'Chennai');
  assert.strictEqual(t1.destination, 'Coimbatore');
  assert.strictEqual(t1.provider, 'mock');
  assert.strictEqual(t1.mock, true);
  assert.ok(t1.disclaimer.includes('MOCK RAILWAY PROVIDER'));
  assert.ok(t1.seats > 0);
  assert.strictEqual(t1.availability, 'AVAILABLE');
});

// 3. Empty Search Validation
runTest('TEST 3: Missing parameters throw error on train search', () => {
  const provider = getProvider();
  assert.throws(() => {
    provider.searchTrainsSync({});
  }, /source, destination, and date are required/);

  assert.throws(() => {
    provider.searchTrainsSync({ source: 'Chennai' });
  }, /source, destination, and date are required/);
});

// 4. Fallback search for unlisted city pairs
runTest('TEST 4: Deterministic fallback search for any valid route', () => {
  const provider = getProvider();
  const trains = provider.searchTrainsSync({
    source: 'Tirupati',
    destination: 'Hyderabad',
    date: '2026-09-30'
  });

  assert.ok(Array.isArray(trains));
  assert.ok(trains.length >= 1);
  assert.strictEqual(trains[0].source, 'Tirupati');
  assert.strictEqual(trains[0].destination, 'Hyderabad');
  assert.strictEqual(trains[0].mock, true);
});

// 5. Train Selection Updates Task State
runTest('TEST 5: Train selection updates selected_train and task status', () => {
  const task = new BookingTask('test_sel_task');
  task.booking = {
    source: 'Chennai',
    destination: 'Coimbatore',
    date: '2026-09-28',
    passengers: 2,
    class: '3A'
  };

  const provider = getProvider();
  const searchResults = provider.searchTrainsSync(task.booking);
  task.setAvailableTrains(searchResults);

  const selected = task.selectTrain('12673');
  assert.strictEqual(task.status, 'train_selected');
  assert.strictEqual(task.selected_train.train_number, '12673');
  assert.strictEqual(selected.train_name, 'Cheran Express');
  assert.strictEqual(task.next_action, 'request_final_confirmation');
});

// 6. Invalid Train Selection Throws Error
runTest('TEST 6: Selecting non-existent train throws meaningful error', () => {
  const task = new BookingTask('test_invalid_sel');
  task.setAvailableTrains([{ train_number: '12673', train_name: 'Cheran Express' }]);

  assert.throws(() => {
    task.selectTrain('99999');
  }, /Train number 99999 was not found/);
});

// 7. Availability Check Associated with Selected Train
runTest('TEST 7: Availability check returns seat quota and status', () => {
  const provider = getProvider();
  const avail = provider.checkAvailabilitySync({
    train_number: '12673',
    class: '3A'
  });

  assert.strictEqual(avail.success, true);
  assert.strictEqual(avail.train_number, '12673');
  assert.strictEqual(avail.class, '3A');
  assert.strictEqual(avail.availability, 'AVAILABLE');
  assert.strictEqual(avail.provider, 'mock');
  assert.strictEqual(avail.mock, true);
  assert.ok(avail.seats > 0);
});

// 8. Prepare Booking Calculation
runTest('TEST 8: Prepare booking validates parameters and calculates fare', () => {
  const provider = getProvider();
  const task = new BookingTask('test_prep_task');
  task.booking = {
    source: 'Chennai',
    destination: 'Coimbatore',
    date: '2026-09-28',
    passengers: 3,
    class: '3A'
  };
  task.selected_train = {
    train_number: '12673',
    train_name: 'Cheran Express',
    source: 'Chennai',
    destination: 'Coimbatore',
    class: '3A',
    fare: 850
  };

  const prep = provider.prepareBookingSync(task);
  assert.strictEqual(prep.valid, true);
  assert.strictEqual(prep.passengers, 3);
  assert.strictEqual(prep.total_fare, 850 * 3);
  assert.strictEqual(prep.mock, true);
});

// 9. Mock Booking Execution Format
runTest('TEST 9: Mock booking returns AURA-MOCK reference format and disclaimer', () => {
  const provider = getProvider();
  const task = new BookingTask('test_book_task');
  task.booking = {
    source: 'Chennai',
    destination: 'Coimbatore',
    date: '2026-09-28',
    passengers: 2,
    class: '3A'
  };
  task.selected_train = {
    train_number: '12673',
    train_name: 'Cheran Express',
    source: 'Chennai',
    destination: 'Coimbatore',
    class: '3A',
    fare: 850
  };

  const result = provider.bookSync(task);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.status, 'CONFIRMED');
  assert.strictEqual(result.provider, 'mock');
  assert.strictEqual(result.mock, true);
  assert.ok(result.booking_reference.startsWith('AURA-MOCK-'));
  assert.strictEqual(result.passengers, 2);
  assert.strictEqual(result.total_fare, 1700);
  assert.ok(result.disclaimer.includes('MOCK RAILWAY PROVIDER'));
});

// 10. Complete Multi-Turn Workflow from Natural Language to Mock Booking
runTest('TEST 10: Complete agent flow: NLU -> Confirm -> Search -> Select -> Mock Book', () => {
  // Step 1: User gives full request
  const turn1 = processAgentMessage(null, 'Book a train from Chennai to Coimbatore tomorrow for 2 people in 3AC.');
  assert.strictEqual(turn1.status, 'ready_for_confirmation');
  const taskId = turn1.task_id;

  // Step 2: User confirms initial journey parameters
  const turn2 = processAgentMessage(taskId, 'yes');
  assert.strictEqual(turn2.status, 'confirmed');
  assert.strictEqual(turn2.next_action, 'booking_ready');
  assert.ok(turn2.available_trains.length >= 2);

  // Step 3: User selects a train by typing its number
  const turn3 = processAgentMessage(taskId, '12673');
  assert.strictEqual(turn3.status, 'booking_ready');
  assert.strictEqual(turn3.next_action, 'request_final_confirmation');
  assert.strictEqual(turn3.selected_train.train_number, '12673');
  assert.ok(turn3.message.includes('Cheran Express'));

  // Step 4: User confirms final booking
  const turn4 = processAgentMessage(taskId, 'confirm');
  assert.strictEqual(turn4.status, 'booking_confirmed');
  assert.strictEqual(turn4.next_action, 'none');
  assert.ok(turn4.booking_result.booking_reference.startsWith('AURA-MOCK-'));
  assert.ok(turn4.message.includes('MOCK BOOKING COMPLETED'));
});

// 11. Duplicate Booking Prevention
runTest('TEST 11: Attempting to message or book after confirmation is blocked', () => {
  const task = getOrCreateTask('test_dup_task');
  task.booking = { source: 'Chennai', destination: 'Coimbatore', date: 'tomorrow', passengers: 1, class: '3A' };
  task.selected_train = { train_number: '12673', train_name: 'Cheran Express', class: '3A', fare: 850 };

  const provider = getProvider();
  task.setBookingResult(provider.bookSync(task));
  assert.strictEqual(task.status, 'booking_confirmed');

  // Messaging when already confirmed
  const res = processAgentMessage(task.task_id, 'book again');
  assert.strictEqual(res.status, 'booking_confirmed');
  assert.ok(res.message.includes('Booking has already been completed'));
});

// 12. Cancellation During Train Selection or Confirmation
runTest('TEST 12: Cancellation at train selection or confirmation marks task cancelled', () => {
  const turn1 = processAgentMessage(null, 'Book a train from Chennai to Bangalore tomorrow for 1 passenger in CC');
  const taskId = turn1.task_id;

  processAgentMessage(taskId, 'yes'); // Reaches train search
  const cancelRes = processAgentMessage(taskId, 'cancel');

  assert.strictEqual(cancelRes.status, 'cancelled');
  assert.strictEqual(cancelRes.next_action, 'none');
  assert.ok(cancelRes.message.toLowerCase().includes('cancelled'));
});

console.log('----------------------------------------------------');
console.log(`Summary: ${passedTests}/${totalTests} Phase 4 tests passed.`);
console.log('----------------------------------------------------');

if (passedTests === totalTests) {
  console.log('All Phase 4 tests passed successfully!');
} else {
  console.error('Some Phase 4 tests failed!');
  process.exit(1);
}
