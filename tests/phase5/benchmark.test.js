/**
 * AURA — Phase 5: Performance Benchmark Test
 * Measures response time / latency for NLU, agent message processing,
 * train search, train selection, availability verification, and mock booking.
 *
 * NOTE: These measurements represent LOCAL PROTOTYPE PERFORMANCE in-memory on Node.js,
 * not production external railway API latency.
 */

const { performance } = require('perf_hooks');
const { analyzeRequest } = require('../../backend/services/auraParser');
const { processAgentMessage, getOrCreateTask } = require('../../backend/services/auraAgent');
const { getProvider } = require('../../backend/services/mockRailwayProvider');
const BookingTask = require('../../backend/models/bookingTask');

function runBenchmark(iterations = 100) {
  const provider = getProvider();

  const results = {
    benchmark_type: 'LOCAL PROTOTYPE PERFORMANCE',
    iterations,
    operations: {}
  };

  function benchmarkOperation(name, fn) {
    const times = [];

    // Warm-up run (3 iterations)
    for (let i = 0; i < 3; i++) {
      fn(i);
    }

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      fn(i);
      const end = performance.now();
      times.push(end - start);
    }

    times.sort((a, b) => a - b);
    const sum = times.reduce((acc, t) => acc + t, 0);
    const avg = sum / times.length;
    const median = times[Math.floor(times.length / 2)];
    const min = times[0];
    const max = times[times.length - 1];

    results.operations[name] = {
      iterations,
      average_ms: parseFloat(avg.toFixed(4)),
      median_ms: parseFloat(median.toFixed(4)),
      min_ms: parseFloat(min.toFixed(4)),
      max_ms: parseFloat(max.toFixed(4))
    };
  }

  // 1. NLU Parsing
  benchmarkOperation('nlu_parsing', () => {
    analyzeRequest('Book me a train from Chennai to Coimbatore tomorrow evening for 2 people in 3AC.');
  });

  // 2. Agent Message Processing
  benchmarkOperation('agent_message_processing', (i) => {
    const taskId = `bench_msg_${i}_${Date.now()}`;
    processAgentMessage(taskId, 'Book a train from Chennai to Coimbatore tomorrow for 2 people in 3AC.');
  });

  // 3. Train Search
  benchmarkOperation('train_search', () => {
    provider.searchTrainsSync({
      source: 'Chennai',
      destination: 'Coimbatore',
      date: 'tomorrow',
      class: '3A',
      passengers: 2
    });
  });

  // 4. Train Selection
  const dummyTrains = provider.searchTrainsSync({ source: 'Chennai', destination: 'Coimbatore', date: 'tomorrow' });
  benchmarkOperation('train_selection', (i) => {
    const task = new BookingTask(`bench_sel_${i}`);
    task.setAvailableTrains(dummyTrains);
    task.selectTrain('12673');
  });

  // 5. Availability Check
  benchmarkOperation('availability_check', () => {
    provider.checkAvailabilitySync({
      train_number: '12673',
      class: '3A'
    });
  });

  // 6. Mock Booking Execution
  const bookingPrepTask = new BookingTask('bench_book_task');
  bookingPrepTask.booking = { source: 'Chennai', destination: 'Coimbatore', date: 'tomorrow', passengers: 2, class: '3A' };
  bookingPrepTask.selected_train = { train_number: '12673', train_name: 'Cheran Express', class: '3A', fare: 850 };
  benchmarkOperation('mock_booking', () => {
    provider.bookSync(bookingPrepTask);
  });

  return results;
}

if (require.main === module) {
  console.log('=== RUNNING AURA PHASE 5 BENCHMARK EVALUATION ===');
  console.log('NOTICE: Measurements represent LOCAL PROTOTYPE PERFORMANCE (not remote production APIs).\n');

  const res = runBenchmark(100);

  console.log('-----------------------------------------------------------------------------');
  console.log('| Operation                 | Iterations | Avg (ms) | Median | Min   | Max   |');
  console.log('-----------------------------------------------------------------------------');
  for (const [op, data] of Object.entries(res.operations)) {
    console.log(
      `| ${op.padEnd(25)} | ${String(data.iterations).padStart(10)} | ${String(data.average_ms).padStart(8)} | ${String(data.median_ms).padStart(6)} | ${String(data.min_ms).padStart(5)} | ${String(data.max_ms).padStart(5)} |`
    );
  }
  console.log('-----------------------------------------------------------------------------');
}

module.exports = { runBenchmark };
