/**
 * AURA - Autonomous User Request Agent
 * Phase 2: Agent Workflow Engine & Session Manager
 *
 * Implements the autonomous decision-making loop, in-memory session tracking,
 * contextual short-answer resolution, and multi-turn booking progression.
 */

const BookingTask = require('../models/bookingTask');
const {
  analyzeRequest,
  extractStations,
  extractDate,
  extractTimePreference,
  extractPassengers,
  extractClass
} = require('./auraParser');

// In-memory store for active booking tasks (Map<taskId, BookingTask>)
const taskStore = new Map();

/**
 * Retrieves an existing task from memory or creates a new one
 */
function getOrCreateTask(taskId = null) {
  if (taskId && taskStore.has(taskId)) {
    return taskStore.get(taskId);
  }

  const newTask = new BookingTask(taskId);
  taskStore.set(newTask.task_id, newTask);
  return newTask;
}

/**
 * Resets or clears a task from memory
 */
function resetTask(taskId) {
  if (taskId && taskStore.has(taskId)) {
    taskStore.delete(taskId);
    return true;
  }
  return false;
}

/**
 * Capitalizes clean station names from direct user input
 */
function cleanDirectStation(text) {
  if (!text) return null;
  const trimmed = text.trim();

  // If text contains railway actions or keywords, it is not a direct station answer
  if (/\b(book|find|need|want|travel|train|ticket|seats?|berth|journey)\b/i.test(trimmed)) {
    return null;
  }

  const stripped = trimmed
    .replace(/^(from|to|station|at)\s+/i, '')
    .replace(/[.,!?]+$/, '')
    .trim();

  const words = stripped.split(/\s+/);
  if (words.length > 3 || words.length === 0 || stripped.length < 2) {
    return null;
  }

  return stripped
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Evaluates contextual short-answer inputs when the agent is waiting
 * for a specific missing field.
 */
function extractContextualAnswer(expectedAction, userMessage) {
  const trimmed = userMessage.trim();
  const result = {};

  switch (expectedAction) {
    case 'request_passengers': {
      // 1. Try parser passenger extraction
      const parsedNum = extractPassengers(trimmed);
      if (parsedNum !== null) {
        result.passengers = parsedNum;
        break;
      }
      // 2. Direct single digit or word: e.g. "2", "two", "3 adults"
      const directMatch = trimmed.match(/^(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i);
      if (directMatch) {
        const val = extractPassengers(directMatch[0] + ' people');
        if (val !== null) result.passengers = val;
      }
      break;
    }

    case 'request_class': {
      const parsedClass = extractClass(trimmed);
      if (parsedClass !== null) {
        result.class = parsedClass;
      }
      break;
    }

    case 'request_source': {
      // If user provides a single city name in response to "What station are you travelling from?"
      const direct = cleanDirectStation(trimmed);
      if (direct) {
        result.source = direct;
      } else {
        const { source } = extractStations(trimmed);
        if (source) result.source = source;
      }
      break;
    }

    case 'request_destination': {
      // If user provides a single city name in response to "What is your destination station?"
      const direct = cleanDirectStation(trimmed);
      if (direct) {
        result.destination = direct;
      } else {
        const { destination } = extractStations(trimmed);
        if (destination) result.destination = destination;
      }
      break;
    }

    case 'request_date': {
      const parsedDate = extractDate(trimmed);
      if (parsedDate) {
        result.date = parsedDate;
      }
      break;
    }

    default:
      break;
  }

  return result;
}

/**
 * Checks for user confirmation or cancellation keywords
 */
function checkConfirmationOrCancellation(userMessage) {
  const clean = userMessage.toLowerCase().trim();

  // Confirmation signals
  if (/^(yes|confirm|proceed|okay|ok|sure|yep|yeah|proceed\s+with\s+booking|looks\s+good|book\s+it)\b/i.test(clean)) {
    return 'confirm';
  }

  // Cancellation signals
  if (/^(no|cancel|stop|abort|don't|dont|nevermind|exit)\b/i.test(clean)) {
    return 'cancel';
  }

  return null;
}

/**
 * Generates the agent's friendly follow-up question based on the next required action
 */
function generateAgentPrompt(task) {
  if (task.status === 'confirmed') {
    return 'Your request has been confirmed for the next booking step. Actual railway booking is not connected in Phase 2.';
  }

  if (task.status === 'cancelled') {
    return 'Your booking request has been cancelled. You can start a new request anytime.';
  }

  if (task.status === 'ready_for_confirmation') {
    const b = task.booking;
    let details = `Here is your booking request:\n\n` +
      `From: ${b.source}\n` +
      `To: ${b.destination}\n` +
      `Date: ${b.date}\n` +
      `Passengers: ${b.passengers}\n` +
      `Class: ${b.class}`;

    if (b.time_preference) {
      details += `\nTime preference: ${b.time_preference}`;
    }

    details += `\n\nWould you like to proceed?`;
    return details;
  }

  // Status is collecting_information
  switch (task.next_action) {
    case 'request_source':
      return 'Sure. What station are you travelling from?';

    case 'request_destination':
      return 'Got it. What is your destination station?';

    case 'request_date':
      return 'Understood. What date would you like to travel? (e.g., today, tomorrow, or a specific date)';

    case 'request_passengers':
      return 'Got it. How many passengers are travelling?';

    case 'request_class':
      return 'What travel class would you prefer? (e.g., 3AC, 2AC, 1AC, Sleeper, CC, 2S)';

    default:
      return 'Could you please provide more details about your train booking?';
  }
}

/**
 * CORE AGENT PROCESSING PIPELINE
 * Accepts a message and manages the multi-turn workflow progression.
 */
function processAgentMessage(taskId, userMessage) {
  if (!userMessage || typeof userMessage !== 'string' || userMessage.trim().length === 0) {
    const task = getOrCreateTask(taskId);
    return {
      task_id: task.task_id,
      status: task.status,
      next_action: task.next_action,
      message: 'Please type a railway request or answer the question.',
      booking: task.booking,
      missing_fields: task.missing_fields,
      activity: task.activity
    };
  }

  const trimmedMessage = userMessage.trim();
  const task = getOrCreateTask(taskId);

  // Record user's incoming message
  task.recordMessage('user', trimmedMessage);
  task.logActivity('receive_message', `User message: "${trimmedMessage}"`);

  // 1. Handle confirmation / cancellation if task is ready for confirmation
  if (task.status === 'ready_for_confirmation') {
    const decision = checkConfirmationOrCancellation(trimmedMessage);

    if (decision === 'confirm') {
      task.status = 'confirmed';
      task.next_action = 'booking_ready';
      task.logActivity('confirm_booking', 'User confirmed booking parameters (Simulated)');

      const responseMessage = generateAgentPrompt(task);
      task.recordMessage('agent', responseMessage);

      return {
        task_id: task.task_id,
        status: task.status,
        next_action: task.next_action,
        message: responseMessage,
        booking: task.booking,
        missing_fields: task.missing_fields,
        activity: task.activity
      };
    }

    if (decision === 'cancel') {
      task.status = 'cancelled';
      task.next_action = 'none';
      task.logActivity('cancel_booking', 'User cancelled booking request');

      const responseMessage = generateAgentPrompt(task);
      task.recordMessage('agent', responseMessage);

      return {
        task_id: task.task_id,
        status: task.status,
        next_action: task.next_action,
        message: responseMessage,
        booking: task.booking,
        missing_fields: task.missing_fields,
        activity: task.activity
      };
    }
  }

  // 2. Contextual short-answer resolution based on what the agent previously asked
  // Only apply when the agent has already asked a question in a previous turn
  let contextualData = {};
  if (task.conversation.length > 1) {
    contextualData = extractContextualAnswer(task.next_action, trimmedMessage);
    if (Object.keys(contextualData).length > 0) {
      task.updateBooking(contextualData);
      task.logActivity('extract_contextual', `Resolved contextual answer for ${task.next_action}`);
    }
  }

  // 3. General NLU parsing to extract any additional entities mentioned in the text
  const parsedData = analyzeRequest(trimmedMessage);
  if (parsedData.intent === 'train_booking') {
    task.updateBooking({
      source: parsedData.source,
      destination: parsedData.destination,
      date: parsedData.date,
      time_preference: parsedData.time_preference,
      passengers: parsedData.passengers,
      class: parsedData.class
    });
    task.logActivity('extract_entities', 'Extracted journey details from message');
  } else if (task.conversation.length === 1 && parsedData.intent === 'unknown' && Object.keys(contextualData).length === 0) {
    // If first turn is completely non-railway and no contextual match
    task.logActivity('unknown_request', 'Received message unrelated to train booking');
    const responseMsg = "Hello! I am AURA, your railway booking agent. You can ask me to book a train (e.g. 'Book a train from Chennai to Coimbatore tomorrow').";
    task.recordMessage('agent', responseMsg);

    return {
      task_id: task.task_id,
      status: task.status,
      next_action: task.next_action,
      message: responseMsg,
      booking: task.booking,
      missing_fields: task.missing_fields,
      activity: task.activity
    };
  }

  // 4. Re-evaluate required fields and decide the next action
  task.recalculateMissingFields();
  task.logActivity('evaluate_state', `Status: ${task.status}, Missing: [${task.missing_fields.join(', ')}]`);

  // 5. Generate appropriate agent response
  const agentResponse = generateAgentPrompt(task);
  task.recordMessage('agent', agentResponse);
  task.logActivity('prompt_user', `Next action: ${task.next_action}`);

  return {
    task_id: task.task_id,
    status: task.status,
    next_action: task.next_action,
    message: agentResponse,
    booking: task.booking,
    missing_fields: task.missing_fields,
    activity: task.activity
  };
}

module.exports = {
  getOrCreateTask,
  resetTask,
  processAgentMessage,
  taskStore
};
