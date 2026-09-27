/**
 * AURA - Autonomous User Request Agent
 * Phase 4: Extended Booking Task Model
 *
 * Represents the state and lifecycle of a railway booking task workflow,
 * including train search, selection, availability check, and simulated booking.
 */

const crypto = require('crypto');

/**
 * Task Statuses:
 * - 'collecting_information': Actively gathering required journey details.
 * - 'ready_for_confirmation': All required journey details collected; awaiting initial user approval.
 * - 'confirmed': User approved initial journey parameters.
 * - 'searching_trains': In the process of searching available trains.
 * - 'train_selected': User selected a specific train option.
 * - 'checking_availability': Verifying seat availability for the selected train.
 * - 'booking_ready': Ready for final booking confirmation.
 * - 'booking_in_progress': Processing booking with the railway provider.
 * - 'booking_confirmed': Simulated booking completed successfully.
 * - 'booking_failed': Booking could not be completed.
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

    // Phase 4: Provider & Train booking state
    this.available_trains = [];
    this.selected_train = null;
    this.availability = null;
    this.booking_result = null;
    this.error_reason = null;

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
   * Re-evaluates missing fields according to priority order:
   * 1. source -> 2. destination -> 3. date -> 4. passengers -> 5. class
   */
  recalculateMissingFields() {
    // Only alter status during early collection phases
    const terminalOrAdvanced = [
      'cancelled',
      'confirmed',
      'searching_trains',
      'train_selected',
      'checking_availability',
      'booking_ready',
      'booking_in_progress',
      'booking_confirmed',
      'booking_failed'
    ];

    if (terminalOrAdvanced.includes(this.status)) {
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
      this.next_action = `request_${missing[0]}`;
    }
  }

  /**
   * Sets available trains discovered from search
   */
  setAvailableTrains(trains) {
    this.available_trains = Array.isArray(trains) ? trains : [];
  }

  /**
   * Selects a specific train by train number
   */
  selectTrain(trainNumber) {
    const num = String(trainNumber).trim();
    const found = this.available_trains.find(t => String(t.train_number) === num);

    if (!found) {
      throw new Error(`Train number ${num} was not found in available search results.`);
    }

    this.selected_train = { ...found };
    this.status = 'train_selected';
    this.next_action = 'request_final_confirmation';
    return this.selected_train;
  }

  /**
   * Sets seat availability verification result
   */
  setAvailability(availData) {
    this.availability = availData;
    if (this.selected_train && availData) {
      this.selected_train.availability = availData.availability;
      this.selected_train.seats = availData.seats;
    }
  }

  /**
   * Completes the booking with mock confirmation payload
   */
  setBookingResult(result) {
    this.booking_result = result;
    this.status = 'booking_confirmed';
    this.next_action = 'none';
  }

  /**
   * Marks booking as failed with explanation
   */
  failBooking(reason) {
    this.error_reason = reason;
    this.status = 'booking_failed';
    this.next_action = 'none';
  }

  /**
   * Converts instance to clean JSON-serializable representation
   */
  toJSON() {
    return {
      task_id: this.task_id,
      intent: this.intent,
      status: this.status,
      booking: { ...this.booking },
      missing_fields: [...this.missing_fields],
      next_action: this.next_action,
      available_trains: [...this.available_trains],
      selected_train: this.selected_train ? { ...this.selected_train } : null,
      availability: this.availability ? { ...this.availability } : null,
      booking_result: this.booking_result ? { ...this.booking_result } : null,
      activity: [...this.activity]
    };
  }
}

module.exports = BookingTask;
