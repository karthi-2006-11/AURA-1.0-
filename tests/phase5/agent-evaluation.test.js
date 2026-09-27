/**
 * AURA — Phase 5: Agent Decision Engine & Workflow Evaluation
 * Evaluates missing-field detection, follow-up prompting, contextual answer interpretation,
 * multi-turn state persistence, confirmation, cancellation, and task continuity.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { processAgentMessage, resetTask, getOrCreateTask } = require('../../backend/services/auraAgent');

function runAgentEvaluation() {
  const datasetPath = path.join(__dirname, '..', 'evaluation', 'test-cases.json');
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  const results = {
    total_workflows: 0,
    successful_workflows: 0,
    success_rate: 0,
    categories: {
      missing_field_detection: { total: 0, passed: 0 },
      contextual_resolution: { total: 0, passed: 0 },
      multi_turn_progression: { total: 0, passed: 0 },
      confirmation_handling: { total: 0, passed: 0 },
      cancellation_handling: { total: 0, passed: 0 },
      state_persistence: { total: 0, passed: 0 }
    },
    failures: []
  };

  function testWorkflow(name, category, testFn) {
    results.total_workflows++;
    results.categories[category].total++;
    try {
      testFn();
      results.successful_workflows++;
      results.categories[category].passed++;
    } catch (err) {
      results.failures.push({
        workflow: name,
        category,
        error: err.message
      });
    }
  }

  // --- SUITE 1: Missing Field Detection & Follow-up Prompts (Category B) ---
  const catBCases = dataset.cases.filter(c => c.category === 'incomplete_request');
  catBCases.forEach(tc => {
    testWorkflow(`Missing Field: ${tc.id}`, 'missing_field_detection', () => {
      const res = processAgentMessage(null, tc.input);
      assert.strictEqual(res.status, 'collecting_information', `Expected status collecting_information for ${tc.id}`);
      assert.ok(res.missing_fields.length > 0, `Expected missing fields for ${tc.id}`);
      // Check that the prompt asks for one of the missing fields
      assert.ok(
        ['request_source', 'request_destination', 'request_date', 'request_passengers', 'request_class'].includes(res.next_action),
        `Unexpected next_action ${res.next_action}`
      );
    });
  });

  // --- SUITE 2: Contextual Short Response Resolution (Category C) ---
  const catCCases = dataset.cases.filter(c => c.category === 'contextual_short_response');
  catCCases.forEach(tc => {
    testWorkflow(`Contextual Resolution: ${tc.id} (${tc.context_question})`, 'contextual_resolution', () => {
      // 1. Create a task in state expecting this field and record the preceding agent prompt
      const taskId = `eval_ctx_${tc.id}_${Date.now()}`;
      const task = getOrCreateTask(taskId);
      task.next_action = tc.context_question;
      task.recordMessage('agent', `Please provide ${tc.context_question}`);

      // 2. Send short response
      const res = processAgentMessage(taskId, tc.input);
      const field = tc.expected.field;
      const expectedVal = tc.expected.value;

      assert.strictEqual(
        res.booking[field],
        expectedVal,
        `Expected ${field} to be "${expectedVal}", but got "${res.booking[field]}"`
      );
    });
  });

  // --- SUITE 3: Multi-turn Progressive Workflow ---
  testWorkflow('Multi-turn: 3-step Journey Completion', 'multi_turn_progression', () => {
    const taskId = `eval_multiturn_${Date.now()}`;

    // Turn 1: Partial request
    const turn1 = processAgentMessage(taskId, 'I want to travel from Chennai to Coimbatore tomorrow');
    assert.strictEqual(turn1.status, 'collecting_information');
    assert.strictEqual(turn1.booking.source, 'Chennai');
    assert.strictEqual(turn1.booking.destination, 'Coimbatore');
    assert.strictEqual(turn1.next_action, 'request_passengers');

    // Turn 2: Provide passenger count
    const turn2 = processAgentMessage(taskId, '2');
    assert.strictEqual(turn2.booking.passengers, 2);
    assert.strictEqual(turn2.next_action, 'request_class');

    // Turn 3: Provide class
    const turn3 = processAgentMessage(taskId, '3AC');
    assert.strictEqual(turn3.booking.class, '3A');
    assert.strictEqual(turn3.status, 'ready_for_confirmation');
    assert.strictEqual(turn3.next_action, 'request_confirmation');
  });

  // --- SUITE 4: Confirmation Handling ---
  testWorkflow('Confirmation Handling: Journey Approval', 'confirmation_handling', () => {
    const taskId = `eval_confirm_${Date.now()}`;
    const turn1 = processAgentMessage(taskId, 'Book a train from Chennai to Coimbatore tomorrow for 2 people in 3AC');
    assert.strictEqual(turn1.status, 'ready_for_confirmation');

    const turn2 = processAgentMessage(taskId, 'confirm');
    assert.strictEqual(turn2.status, 'confirmed');
    assert.strictEqual(turn2.next_action, 'booking_ready');
    assert.ok(turn2.available_trains && turn2.available_trains.length > 0);
  });

  // --- SUITE 5: Cancellation Handling ---
  testWorkflow('Cancellation Handling: Abort at Review', 'cancellation_handling', () => {
    const taskId = `eval_cancel_${Date.now()}`;
    processAgentMessage(taskId, 'Book Chennai to Coimbatore tomorrow for 2 in 3AC');
    const cancelRes = processAgentMessage(taskId, 'cancel');
    assert.strictEqual(cancelRes.status, 'cancelled');
    assert.strictEqual(cancelRes.next_action, 'none');
  });

  testWorkflow('Cancellation Handling: Abort at Train Selection', 'cancellation_handling', () => {
    const taskId = `eval_cancel_sel_${Date.now()}`;
    processAgentMessage(taskId, 'Book Chennai to Coimbatore tomorrow for 2 in 3AC');
    processAgentMessage(taskId, 'yes'); // Reaches train selection
    const cancelRes = processAgentMessage(taskId, 'no, cancel this');
    assert.strictEqual(cancelRes.status, 'cancelled');
    assert.strictEqual(cancelRes.next_action, 'none');
  });

  // --- SUITE 6: State Persistence across Turns ---
  testWorkflow('State Persistence: All Details Preserved', 'state_persistence', () => {
    const taskId = `eval_persist_${Date.now()}`;
    processAgentMessage(taskId, 'Train from Chennai to Bangalore');
    processAgentMessage(taskId, 'tomorrow');
    processAgentMessage(taskId, 'for 3 people');
    const finalTurn = processAgentMessage(taskId, 'sleeper');

    assert.strictEqual(finalTurn.booking.source, 'Chennai');
    assert.strictEqual(finalTurn.booking.destination, 'Bangalore');
    assert.strictEqual(finalTurn.booking.date, 'tomorrow');
    assert.strictEqual(finalTurn.booking.passengers, 3);
    assert.strictEqual(finalTurn.booking.class, 'SL');
    assert.strictEqual(finalTurn.status, 'ready_for_confirmation');
  });

  // Calculate percentage
  results.success_rate = parseFloat(((results.successful_workflows / results.total_workflows) * 100).toFixed(2));

  return results;
}

if (require.main === module) {
  console.log('=== RUNNING AURA PHASE 5 AGENT EVALUATION ===');
  const res = runAgentEvaluation();

  console.log('------------------------------------------------------------');
  console.log(`Total Workflows Evaluated: ${res.total_workflows}`);
  console.log(`Successful Workflows:      ${res.successful_workflows}`);
  console.log(`Success Rate:              ${res.success_rate}%`);
  console.log('------------------------------------------------------------');
  console.log('Category Breakdown:');
  for (const [cat, data] of Object.entries(res.categories)) {
    const pct = data.total > 0 ? ((data.passed / data.total) * 100).toFixed(1) : '100.0';
    console.log(`- ${cat.padEnd(28)}: ${data.passed}/${data.total} (${pct}%)`);
  }

  if (res.failures.length > 0) {
    console.log('\nFailures:');
    res.failures.forEach(f => console.log(`- [${f.category}] ${f.workflow}: ${f.error}`));
  } else {
    console.log('\nAll Agent Workflows evaluated successfully!');
  }
}

module.exports = { runAgentEvaluation };
