/**
 * AURA - Autonomous User Request Agent
 * Phase 2: Booking Task Model
 *
 * Represents the state and lifecycle of a railway booking task workflow.
 */

const crypto = require('crypto');

/**
 * Task Statuses:
 * - 'collecting_information': Actively gathering required journey details.
 * - 'ready_for_confirmation': All required details collected; awaiting user approval.
 * - 'confirmed': User approved request; ready for future execution (simulated).
 * - 'cancelled': User aborted or cancelled the request.
 */
class BookingTask {
  constructor(taskId = null) {
    this.task_id = taskId || 'task_' + crypto.randomBytes(4).toString('hex');
    this.intent = 'train_booking';
    this.status = 'collecting_information';

    // Journey details
    this.booking = {
      source: null,
      destination: null,
      date: null,
      time_preference: null,
      passengers: null,
      class: null
    };

    // Priority ordered missing required fields
    this.missing_fields = ['source', 'destination', 'date', 'passengers', 'class'];
    this.next_action = 'request_source';

    // Safe workflow activities (no hidden reasoning)
    this.activity = [
      {
        step: 1,
        action: 'task_initialized',
        description: 'Initialized booking task session',
        status: 'completed',
        timestamp: new Date().toISOString()
      }
    ];

    // Conversation history for context
    this.conversation = [];
  }

  /**
   * Appends a safe workflow activity entry
   */
  logActivity(action, description, status = 'completed') {
    this.activity.push({
      step: this.activity.length + 1,
      action,
      description,
      status,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Records a conversational message in task history
   */
  recordMessage(role, text) {
    this.conversation.push({
      role,
      message: text,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Updates booking details with newly discovered entity values
   */
  updateBooking(extractedData) {
    if (!extractedData) return;

    if (extractedData.source) this.booking.source = extractedData.source;
    if (extractedData.destination) this.booking.destination = extractedData.destination;
    if (extractedData.date) this.booking.date = extractedData.date;
    if (extractedData.time_preference) this.booking.time_preference = extractedData.time_preference;
    if (extractedData.passengers !== null && extractedData.passengers !== undefined) {
      this.booking.passengers = extractedData.passengers;
    }
    if (extractedData.class) this.booking.class = extractedData.class;

    this.recalculateMissingFields();
  }

  /**
   * Re-evaluates missing fields according to Phase 2 priority order:
   * 1. source
   * 2. destination
   * 3. date
   * 4. passengers
   * 5. class
   */
  recalculateMissingFields() {
    // If task was already cancelled or confirmed, keep its terminal state
    if (this.status === 'cancelled' || this.status === 'confirmed') {
      return;
    }

    const missing = [];
    if (!this.booking.source) missing.push('source');
    if (!this.booking.destination) missing.push('destination');
    if (!this.booking.date) missing.push('date');
    if (this.booking.passengers === null || this.booking.passengers === undefined) {
      missing.push('passengers');
    }
    if (!this.booking.class) missing.push('class');

    this.missing_fields = missing;

    if (missing.length === 0) {
      this.status = 'ready_for_confirmation';
      this.next_action = 'request_confirmation';
    } else {
      this.status = 'collecting_information';
      // Next action is directly mapped to the highest priority missing field
      this.next_action = `request_${missing[0]}`;
    }
  }

  /**
   * Converts instance to a clean JSON-serializable representation
   */
  toJSON() {
    return {
      task_id: this.task_id,
      intent: this.intent,
      status: this.status,
      booking: { ...this.booking },
      missing_fields: [...this.missing_fields],
      next_action: this.next_action,
      activity: [...this.activity]
    };
  }
}

module.exports = BookingTask;
