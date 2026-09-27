/**
 * AURA — Phase 5: End-to-End Workflow Evaluation Test
 * Evaluates the 5 required end-to-end user journeys:
 * 1. Standard complete journey from query to mock ticket
 * 2. Multi-turn incomplete request resolution to mock ticket
 * 3. Cancellation workflow
 * 4. Invalid train selection recovery workflow
 * 5. Duplicate booking prevention on confirmed task
 */

const assert = require('assert');
const { processAgentMessage, getOrCreateTask, resetTask } = require('../../backend/services/auraAgent');

function runEndToEndEvaluation() {
  const results = {
    total_scenarios: 5,
    successful_scenarios: 0,
    success_rate: 0,
    scenarios: [],
    failures: []
  };

  function testScenario(name, scenarioFn) {
    try {
      scenarioFn();
      results.successful_scenarios++;
      results.scenarios.push({ name, status: 'PASS' });
    } catch (err) {
      results.failures.push({ name, error: err.message });
      results.scenarios.push({ name, status: 'FAIL', error: err.message });
    }
  }

  // --- SCENARIO 1: Standard Complete Journey ---
  testScenario('Scenario 1: Complete Journey (Query -> Review -> Search -> Select -> Avail -> Final Confirm -> Mock Ticket)', () => {
    const taskId = `e2e_scen1_${Date.now()}`;

    // Step 1: Initial natural-language request
    const turn1 = processAgentMessage(taskId, 'Book a train from Chennai to Coimbatore tomorrow for 2 people in 3AC.');
    assert.strictEqual(turn1.status, 'ready_for_confirmation');
    assert.strictEqual(turn1.next_action, 'request_confirmation');
    assert.strictEqual(turn1.booking.source, 'Chennai');
    assert.strictEqual(turn1.booking.destination, 'Coimbatore');
    assert.strictEqual(turn1.booking.passengers, 2);
    assert.strictEqual(turn1.booking.class, '3A');

    // Step 2: User confirms journey parameters
    const turn2 = processAgentMessage(taskId, 'yes');
    assert.strictEqual(turn2.status, 'confirmed');
    assert.strictEqual(turn2.next_action, 'booking_ready');
    assert.ok(turn2.available_trains && turn2.available_trains.length >= 2, 'Expected available mock trains');

    // Step 3: User selects a train by number
    const turn3 = processAgentMessage(taskId, '12673');
    assert.strictEqual(turn3.status, 'booking_ready');
    assert.strictEqual(turn3.next_action, 'request_final_confirmation');
    assert.strictEqual(turn3.selected_train.train_number, '12673');
    assert.strictEqual(turn3.selected_train.train_name, 'Cheran Express');

    // Step 4: User confirms final booking
    const turn4 = processAgentMessage(taskId, 'confirm');
    assert.strictEqual(turn4.status, 'booking_confirmed');
    assert.strictEqual(turn4.next_action, 'none');
    assert.ok(turn4.booking_result, 'Expected booking result');
    assert.ok(turn4.booking_result.booking_reference.startsWith('AURA-MOCK-'));
    assert.strictEqual(turn4.booking_result.status, 'CONFIRMED');
    assert.strictEqual(turn4.booking_result.mock, true);
    assert.strictEqual(turn4.booking_result.total_fare, 1700); // 850 * 2
    assert.ok(turn4.message.includes('MOCK BOOKING COMPLETED'));
  });

  // --- SCENARIO 2: Incomplete Request Multi-Turn Resolution ---
  testScenario('Scenario 2: Incomplete Request Resolution (Clarifications -> Complete Flow)', () => {
    const taskId = `e2e_scen2_${Date.now()}`;

    // Turn 1: Partial request (missing date, passengers, class)
    const turn1 = processAgentMessage(taskId, 'Book a train from Chennai to Bangalore');
    assert.strictEqual(turn1.status, 'collecting_information');
    assert.strictEqual(turn1.next_action, 'request_date');

    // Turn 2: User answers date
    const turn2 = processAgentMessage(taskId, 'tomorrow');
    assert.strictEqual(turn2.booking.date, 'tomorrow');
    assert.strictEqual(turn2.next_action, 'request_passengers');

    // Turn 3: User answers passengers
    const turn3 = processAgentMessage(taskId, '2 passengers');
    assert.strictEqual(turn3.booking.passengers, 2);
    assert.strictEqual(turn3.next_action, 'request_class');

    // Turn 4: User answers class
    const turn4 = processAgentMessage(taskId, '3AC');
    assert.strictEqual(turn4.booking.class, '3A');
    assert.strictEqual(turn4.status, 'ready_for_confirmation');
    assert.strictEqual(turn4.next_action, 'request_confirmation');

    // Turn 5: User confirms journey parameters
    const turn5 = processAgentMessage(taskId, 'proceed');
    assert.strictEqual(turn5.status, 'confirmed');
    assert.ok(turn5.available_trains && turn5.available_trains.length > 0);

    // Turn 6: User selects train
    const trainNum = turn5.available_trains[0].train_number;
    const turn6 = processAgentMessage(taskId, trainNum);
    assert.strictEqual(turn6.status, 'booking_ready');
    assert.strictEqual(turn6.next_action, 'request_final_confirmation');

    // Turn 7: User confirms final booking
    const turn7 = processAgentMessage(taskId, 'confirm');
    assert.strictEqual(turn7.status, 'booking_confirmed');
    assert.ok(turn7.booking_result.booking_reference.startsWith('AURA-MOCK-'));
  });

  // --- SCENARIO 3: User Cancellation Workflow ---
  testScenario('Scenario 3: User Cancellation (Request Review -> Cancel)', () => {
    const taskId = `e2e_scen3_${Date.now()}`;

    // Step 1: Initial request
    const turn1 = processAgentMessage(taskId, 'Book a train from Madurai to Chennai tomorrow for 1 person in sleeper');
    assert.strictEqual(turn1.status, 'ready_for_confirmation');

    // Step 2: User decides to cancel
    const turn2 = processAgentMessage(taskId, 'cancel');
    assert.strictEqual(turn2.status, 'cancelled');
    assert.strictEqual(turn2.next_action, 'none');
    assert.ok(turn2.message.toLowerCase().includes('cancelled'));
  });

  // --- SCENARIO 4: Invalid Train Selection Recovery ---
  testScenario('Scenario 4: Invalid Train Selection Recovery (Invalid Train -> Reprompt -> Valid Selection -> Success)', () => {
    const taskId = `e2e_scen4_${Date.now()}`;

    // Step 1: Journey setup and initial confirmation
    processAgentMessage(taskId, 'Book a train from Chennai to Coimbatore tomorrow for 2 people in 3AC');
    const turn2 = processAgentMessage(taskId, 'confirm');
    assert.strictEqual(turn2.status, 'confirmed');
    assert.ok(turn2.available_trains.length >= 2);

    // Step 2: User provides invalid/non-existent train number
    const turn3 = processAgentMessage(taskId, '99999');
    assert.strictEqual(turn3.status, 'confirmed');
    assert.strictEqual(turn3.next_action, 'booking_ready');
    assert.strictEqual(turn3.selected_train, null);
    assert.ok(turn3.message.includes('not found') || turn3.message.includes('select a train'));

    // Step 3: User corrects with valid train number
    const turn4 = processAgentMessage(taskId, '12673');
    assert.strictEqual(turn4.status, 'booking_ready');
    assert.strictEqual(turn4.next_action, 'request_final_confirmation');
    assert.strictEqual(turn4.selected_train.train_number, '12673');

    // Step 4: Final confirmation succeeds
    const turn5 = processAgentMessage(taskId, 'confirm');
    assert.strictEqual(turn5.status, 'booking_confirmed');
    assert.ok(turn5.booking_result.booking_reference.startsWith('AURA-MOCK-'));
  });

  // --- SCENARIO 5: Duplicate Booking Attempt Prevention ---
  testScenario('Scenario 5: Duplicate Booking Attempt (Confirmed Session -> Re-booking Prevented)', () => {
    const taskId = `e2e_scen5_${Date.now()}`;

    // Run to confirmation
    processAgentMessage(taskId, 'Book a train from Chennai to Coimbatore tomorrow for 2 in 3AC');
    processAgentMessage(taskId, 'confirm');
    processAgentMessage(taskId, '12673');
    const confirmedTurn = processAgentMessage(taskId, 'confirm');
    assert.strictEqual(confirmedTurn.status, 'booking_confirmed');
    const originalRef = confirmedTurn.booking_result.booking_reference;

    // User attempts to message or book again in the same task
    const rebookTurn = processAgentMessage(taskId, 'book again please');
    assert.strictEqual(rebookTurn.status, 'booking_confirmed');
    assert.strictEqual(rebookTurn.next_action, 'none');
    assert.ok(rebookTurn.message.includes('Booking has already been completed'));
    assert.ok(rebookTurn.message.includes(originalRef));
  });

  results.success_rate = parseFloat(((results.successful_scenarios / results.total_scenarios) * 100).toFixed(2));
  return results;
}

if (require.main === module) {
  console.log('=== RUNNING AURA PHASE 5 END-TO-END EVALUATION ===');
  const res = runEndToEndEvaluation();

  console.log('------------------------------------------------------------');
  console.log(`Total Scenarios:      ${res.total_scenarios}`);
  console.log(`Successful Scenarios: ${res.successful_scenarios}`);
  console.log(`Success Rate:         ${res.success_rate}%`);
  console.log('------------------------------------------------------------');
  res.scenarios.forEach(s => console.log(`[${s.status}] ${s.name}`));

  if (res.failures.length > 0) {
    console.log('\nFailures:');
    res.failures.forEach(f => console.log(`- ${f.name}: ${f.error}`));
    process.exit(1);
  } else {
    console.log('\nAll End-to-End Scenarios evaluated successfully with 100% success rate!');
    process.exit(0);
  }
}

module.exports = { runEndToEndEvaluation };
