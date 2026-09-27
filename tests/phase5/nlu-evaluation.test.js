/**
 * AURA — Phase 5: Natural Language Understanding Evaluation Test
 * Evaluates intent detection, entity extraction, normalization, and overall accuracy
 * against the fixed deterministic test cases.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { analyzeRequest } = require('../../backend/services/auraParser');

function runNluEvaluation() {
  const datasetPath = path.join(__dirname, '..', 'evaluation', 'test-cases.json');
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  const results = {
    total_cases: 0,
    intent: { correct: 0, total: 0, accuracy: 0 },
    source: { correct: 0, total: 0, accuracy: 0 },
    destination: { correct: 0, total: 0, accuracy: 0 },
    date: { correct: 0, total: 0, accuracy: 0 },
    passengers: { correct: 0, total: 0, accuracy: 0 },
    class: { correct: 0, total: 0, accuracy: 0 },
    time_preference: { correct: 0, total: 0, accuracy: 0 },
    overall_complete: { correct: 0, total: 0, accuracy: 0 },
    failures: []
  };

  // We evaluate Category A (complete), Category B (incomplete), and Category D (invalid)
  const applicableCases = dataset.cases.filter(c =>
    c.category === 'complete_request' ||
    c.category === 'incomplete_request' ||
    c.category === 'invalid_input'
  );

  results.total_cases = applicableCases.length;

  for (const testCase of applicableCases) {
    const parsed = analyzeRequest(testCase.input);
    const exp = testCase.expected;

    // 1. Intent accuracy (evaluated for all cases)
    results.intent.total++;
    const intentMatch = parsed.intent === exp.intent;
    if (intentMatch) {
      results.intent.correct++;
    } else {
      results.failures.push({
        id: testCase.id,
        field: 'intent',
        input: testCase.input,
        expected: exp.intent,
        actual: parsed.intent
      });
    }

    // Only evaluate entity fields if intent was train_booking or expected specifies them
    if (exp.intent === 'train_booking') {
      // 2. Source extraction
      if (exp.source !== undefined) {
        results.source.total++;
        if (parsed.source === exp.source) {
          results.source.correct++;
        } else {
          results.failures.push({
            id: testCase.id,
            field: 'source',
            input: testCase.input,
            expected: exp.source,
            actual: parsed.source
          });
        }
      }

      // 3. Destination extraction
      if (exp.destination !== undefined) {
        results.destination.total++;
        if (parsed.destination === exp.destination) {
          results.destination.correct++;
        } else {
          results.failures.push({
            id: testCase.id,
            field: 'destination',
            input: testCase.input,
            expected: exp.destination,
            actual: parsed.destination
          });
        }
      }

      // 4. Date extraction
      if (exp.date !== undefined) {
        results.date.total++;
        if (parsed.date === exp.date) {
          results.date.correct++;
        } else {
          results.failures.push({
            id: testCase.id,
            field: 'date',
            input: testCase.input,
            expected: exp.date,
            actual: parsed.date
          });
        }
      }

      // 5. Passengers extraction
      if (exp.passengers !== undefined) {
        results.passengers.total++;
        if (parsed.passengers === exp.passengers) {
          results.passengers.correct++;
        } else {
          results.failures.push({
            id: testCase.id,
            field: 'passengers',
            input: testCase.input,
            expected: exp.passengers,
            actual: parsed.passengers
          });
        }
      }

      // 6. Class extraction
      if (exp.class !== undefined) {
        results.class.total++;
        if (parsed.class === exp.class) {
          results.class.correct++;
        } else {
          results.failures.push({
            id: testCase.id,
            field: 'class',
            input: testCase.input,
            expected: exp.class,
            actual: parsed.class
          });
        }
      }

      // 7. Time preference extraction
      if (exp.time_preference !== undefined) {
        results.time_preference.total++;
        if (parsed.time_preference === exp.time_preference) {
          results.time_preference.correct++;
        } else {
          results.failures.push({
            id: testCase.id,
            field: 'time_preference',
            input: testCase.input,
            expected: exp.time_preference,
            actual: parsed.time_preference
          });
        }
      }

      // 8. Complete-case overall accuracy (Category A)
      if (testCase.category === 'complete_request') {
        results.overall_complete.total++;
        const allMatch =
          parsed.intent === exp.intent &&
          parsed.source === exp.source &&
          parsed.destination === exp.destination &&
          parsed.date === exp.date &&
          parsed.passengers === exp.passengers &&
          parsed.class === exp.class &&
          parsed.time_preference === exp.time_preference;

        if (allMatch) {
          results.overall_complete.correct++;
        }
      }
    }
  }

  // Calculate percentages
  const calcPct = (c, t) => (t > 0 ? parseFloat(((c / t) * 100).toFixed(2)) : 0);
  results.intent.accuracy = calcPct(results.intent.correct, results.intent.total);
  results.source.accuracy = calcPct(results.source.correct, results.source.total);
  results.destination.accuracy = calcPct(results.destination.correct, results.destination.total);
  results.date.accuracy = calcPct(results.date.correct, results.date.total);
  results.passengers.accuracy = calcPct(results.passengers.correct, results.passengers.total);
  results.class.accuracy = calcPct(results.class.correct, results.class.total);
  results.time_preference.accuracy = calcPct(results.time_preference.correct, results.time_preference.total);
  results.overall_complete.accuracy = calcPct(results.overall_complete.correct, results.overall_complete.total);

  return results;
}

if (require.main === module) {
  console.log('=== RUNNING AURA PHASE 5 NLU EVALUATION ===');
  const res = runNluEvaluation();

  console.log('------------------------------------------------------------');
  console.log('| Metric                   | Correct | Total | Accuracy    |');
  console.log('------------------------------------------------------------');
  console.log(`| Intent Detection         | ${String(res.intent.correct).padStart(7)} | ${String(res.intent.total).padStart(5)} | ${String(res.intent.accuracy + '%').padStart(11)} |`);
  console.log(`| Source Extraction        | ${String(res.source.correct).padStart(7)} | ${String(res.source.total).padStart(5)} | ${String(res.source.accuracy + '%').padStart(11)} |`);
  console.log(`| Destination Extraction   | ${String(res.destination.correct).padStart(7)} | ${String(res.destination.total).padStart(5)} | ${String(res.destination.accuracy + '%').padStart(11)} |`);
  console.log(`| Date Extraction          | ${String(res.date.correct).padStart(7)} | ${String(res.date.total).padStart(5)} | ${String(res.date.accuracy + '%').padStart(11)} |`);
  console.log(`| Passenger Extraction     | ${String(res.passengers.correct).padStart(7)} | ${String(res.passengers.total).padStart(5)} | ${String(res.passengers.accuracy + '%').padStart(11)} |`);
  console.log(`| Class Normalization      | ${String(res.class.correct).padStart(7)} | ${String(res.class.total).padStart(5)} | ${String(res.class.accuracy + '%').padStart(11)} |`);
  console.log(`| Time Preference          | ${String(res.time_preference.correct).padStart(7)} | ${String(res.time_preference.total).padStart(5)} | ${String(res.time_preference.accuracy + '%').padStart(11)} |`);
  console.log(`| Overall Complete Cases   | ${String(res.overall_complete.correct).padStart(7)} | ${String(res.overall_complete.total).padStart(5)} | ${String(res.overall_complete.accuracy + '%').padStart(11)} |`);
  console.log('------------------------------------------------------------');

  if (res.failures.length > 0) {
    console.log(`\nObserved Failures (${res.failures.length}):`);
    res.failures.forEach(f => {
      console.log(`- [${f.id}] Field: ${f.field} | Expected: "${f.expected}" | Actual: "${f.actual}" | Input: "${f.input}"`);
    });
  } else {
    console.log('\nAll evaluated NLU fields passed with 100% accuracy!');
  }
}

module.exports = { runNluEvaluation };
