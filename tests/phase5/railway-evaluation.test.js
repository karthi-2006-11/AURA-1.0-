/**
 * AURA — Phase 5: Railway Workflow Evaluation Test
 * Evaluates train search, matching, selection, availability check, fare calculation,
 * booking preparation, mock booking, reference format, duplicate prevention, and disclaimer compliance.
 */

const assert = require('assert');
const { getProvider } = require('../../backend/services/mockRailwayProvider');
const BookingTask = require('../../backend/models/bookingTask');
const { getOrCreateTask } = require('../../backend/services/auraAgent');

function runRailwayEvaluation() {
  const provider = getProvider();

  const results = {
    total_tests: 0,
    successful_tests: 0,
    success_rate: 0,
    tests: [],
    failures: []
  };

  function testCase(name, testFn) {
    results.total_tests++;
    try {
      testFn();
      results.successful_tests++;
      results.tests.push({ name, status: 'PASS' });
    } catch (err) {
      results.failures.push({ name, error: err.message });
      results.tests.push({ name, status: 'FAIL', error: err.message });
    }
  }

  // 1. Train Search: Route Query
  testCase('1. Train Search: Valid Route Query', () => {
    const trains = provider.searchTrainsSync({
      source: 'Chennai',
      destination: 'Coimbatore',
      date: 'tomorrow',
      class: '3A',
      passengers: 2
    });
    assert.ok(Array.isArray(trains), 'Expected trains array');
    assert.ok(trains.length >= 2, 'Expected at least 2 trains for Chennai -> Coimbatore');
    trains.forEach(t => {
      assert.strictEqual(t.mock, true);
      assert.strictEqual(t.provider, 'mock');
      assert.ok(t.train_number);
      assert.ok(t.train_name);
      assert.ok(t.departure || t.departure_time);
      assert.ok(t.arrival || t.arrival_time);
      assert.ok(t.fare > 0);
    });
  });

  // 2. Train Matching: Seeded Database Route
  testCase('2. Train Matching: Seeded Express Route', () => {
    const trains = provider.searchTrainsSync({
      source: 'Madurai',
      destination: 'Chennai',
      date: 'tomorrow',
      class: 'SL',
      passengers: 1
    });
    const pandian = trains.find(t => t.train_number === '12638');
    assert.ok(pandian, 'Expected to find Pandian SF Express 12638');
    assert.strictEqual(pandian.train_name, 'Pandian SF Express');
  });

  // 3. Fallback Search: Dynamic Route Generation
  testCase('3. Train Search: Algorithmic Dynamic Fallback', () => {
    const trains = provider.searchTrainsSync({
      source: 'Trichy',
      destination: 'Tirupati',
      date: 'tomorrow',
      class: '3A',
      passengers: 1
    });
    assert.ok(trains.length >= 2, 'Expected fallback trains generated for unseeded route');
    assert.strictEqual(trains[0].source, 'Trichy');
    assert.strictEqual(trains[0].destination, 'Tirupati');
  });

  // 4. Train Selection: Valid Selection
  testCase('4. Train Selection: Valid Train Number', () => {
    const task = new BookingTask(`eval_sel_${Date.now()}`);
    task.booking = { source: 'Chennai', destination: 'Coimbatore', date: 'tomorrow', passengers: 2, class: '3A' };
    const trains = provider.searchTrainsSync(task.booking);
    task.setAvailableTrains(trains);

    task.selectTrain('12673');
    assert.strictEqual(task.status, 'train_selected');
    assert.ok(task.selected_train);
    assert.strictEqual(task.selected_train.train_number, '12673');
    assert.strictEqual(task.selected_train.train_name, 'Cheran Express');
  });

  // 5. Invalid Train Selection
  testCase('5. Train Selection: Invalid Train Rejection', () => {
    const task = new BookingTask(`eval_inv_sel_${Date.now()}`);
    task.booking = { source: 'Chennai', destination: 'Coimbatore', date: 'tomorrow', passengers: 2, class: '3A' };
    const trains = provider.searchTrainsSync(task.booking);
    task.setAvailableTrains(trains);

    assert.throws(() => {
      task.selectTrain('99999');
    }, /was not found in available/);
  });

  // 6. Availability Check: Seat Quota
  testCase('6. Availability Verification: Seat Quotas', () => {
    const avail = provider.checkAvailabilitySync({
      train_number: '12673',
      class: '3A'
    });
    assert.strictEqual(avail.success, true);
    assert.strictEqual(avail.availability, 'AVAILABLE');
    assert.ok(avail.seats > 0);
    assert.strictEqual(avail.mock, true);
  });

  // 7. Fare Calculation
  testCase('7. Fare Calculation: Passenger Multiplier', () => {
    const task = new BookingTask(`eval_fare_${Date.now()}`);
    task.booking = { source: 'Chennai', destination: 'Coimbatore', date: 'tomorrow', passengers: 3, class: '3A' };
    task.selected_train = { train_number: '12673', train_name: 'Cheran Express', class: '3A', fare: 850 };

    const prep = provider.prepareBookingSync(task);
    assert.strictEqual(prep.passengers, 3);
    assert.strictEqual(prep.total_fare, 2550); // 850 * 3
  });

  // 8. Booking Preparation Validation
  testCase('8. Booking Preparation: Missing Data Validation', () => {
    const task = new BookingTask(`eval_prep_${Date.now()}`);
    task.booking = { source: 'Chennai' }; // Missing destination, date, selected_train
    assert.throws(() => {
      provider.prepareBookingSync(task);
    }, /source, destination, and date are required/);
  });

  // 9. Mock Booking Execution
  testCase('9. Mock Booking: Execution and Status', () => {
    const task = new BookingTask(`eval_book_${Date.now()}`);
    task.booking = { source: 'Chennai', destination: 'Coimbatore', date: 'tomorrow', passengers: 2, class: '3A' };
    task.selected_train = { train_number: '12673', train_name: 'Cheran Express', class: '3A', fare: 850 };

    const result = provider.bookSync(task);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.status, 'CONFIRMED');
    assert.strictEqual(result.mock, true);
    assert.strictEqual(result.provider, 'mock');
    task.setBookingResult(result);
    assert.strictEqual(task.status, 'booking_confirmed');
    assert.strictEqual(task.next_action, 'none');
  });

  // 10. Reference Format Verification
  testCase('10. Booking Reference Format: AURA-MOCK-XXXXXX', () => {
    const task = new BookingTask(`eval_ref_${Date.now()}`);
    task.booking = { source: 'Chennai', destination: 'Coimbatore', date: 'tomorrow', passengers: 1, class: '3A' };
    task.selected_train = { train_number: '12673', train_name: 'Cheran Express', class: '3A', fare: 850 };

    const result = provider.bookSync(task);
    const refRegex = /^AURA-MOCK-[A-Z0-9]{6}$/;
    assert.ok(refRegex.test(result.booking_reference), `Reference "${result.booking_reference}" must match AURA-MOCK-XXXXXX`);
  });

  // 11. Duplicate Booking Prevention
  testCase('11. Duplicate Booking Prevention: Re-booking Blocked', () => {
    const taskId = `eval_dup_${Date.now()}`;
    const task = getOrCreateTask(taskId);
    task.booking = { source: 'Chennai', destination: 'Coimbatore', date: 'tomorrow', passengers: 1, class: '3A' };
    task.selected_train = { train_number: '12673', train_name: 'Cheran Express', class: '3A', fare: 850 };

    const result = provider.bookSync(task);
    task.setBookingResult(result);
    assert.strictEqual(task.status, 'booking_confirmed');

    // Attempting to send message or book again on confirmed task
    const { processAgentMessage } = require('../../backend/services/auraAgent');
    const msgRes = processAgentMessage(taskId, 'book again');
    assert.strictEqual(msgRes.status, 'booking_confirmed');
    assert.strictEqual(msgRes.next_action, 'none');
    assert.ok(msgRes.message.includes('Booking has already been completed'));
  });

  // 12. Simulation Notice Compliance
  testCase('12. Simulation Notice: Prominent Disclaimer Verification', () => {
    const task = new BookingTask(`eval_disc_${Date.now()}`);
    task.booking = { source: 'Chennai', destination: 'Coimbatore', date: 'tomorrow', passengers: 1, class: '3A' };
    task.selected_train = { train_number: '12673', train_name: 'Cheran Express', class: '3A', fare: 850 };

    const result = provider.bookSync(task);
    assert.ok(result.disclaimer.includes('MOCK RAILWAY PROVIDER'), 'Expected disclaimer to identify MOCK RAILWAY PROVIDER');
    assert.ok(result.disclaimer.includes('Simulation only'), 'Expected disclaimer to state simulation only');
  });

  results.success_rate = parseFloat(((results.successful_tests / results.total_tests) * 100).toFixed(2));
  return results;
}

if (require.main === module) {
  console.log('=== RUNNING AURA PHASE 5 RAILWAY WORKFLOW EVALUATION ===');
  const res = runRailwayEvaluation();

  console.log('------------------------------------------------------------');
  console.log(`Total Railway Tests: ${res.total_tests}`);
  console.log(`Successful Tests:    ${res.successful_tests}`);
  console.log(`Success Rate:        ${res.success_rate}%`);
  console.log('------------------------------------------------------------');
  res.tests.forEach(t => {
    console.log(`[${t.status}] ${t.name}`);
  });

  if (res.failures.length > 0) {
    console.log('\nFailures:');
    res.failures.forEach(f => console.log(`- ${f.name}: ${f.error}`));
  } else {
    console.log('\nAll Railway Workflow evaluations passed with 100% success rate!');
  }
}

module.exports = { runRailwayEvaluation };
