const express = require('express');
const router = express.Router();
const { processAgentMessage, resetTask, getOrCreateTask, taskStore } = require('../services/auraAgent');

/**
 * POST /api/agent/message
 * Body: { task_id?: string, message: string }
 * Processes the message through the autonomous agent workflow
 */
router.post('/message', (req, res) => {
  try {
    const { task_id, message } = req.body || {};

    if (message === undefined || message === null) {
      return res.status(400).json({
        error: 'Invalid request: "message" field is required.'
      });
    }

    const response = processAgentMessage(task_id, message);
    return res.json(response);
  } catch (error) {
    console.error('Error processing agent message:', error);
    return res.status(500).json({
      error: 'An internal server error occurred while processing the agent message.'
    });
  }
});

/**
 * POST /api/agent/reset
 * Body: { task_id: string }
 * Resets an active booking session
 */
router.post('/reset', (req, res) => {
  try {
    const { task_id } = req.body || {};
    if (!task_id) {
      return res.status(400).json({ error: 'task_id is required for reset.' });
    }

    const success = resetTask(task_id);
    return res.json({
      task_id,
      reset: success,
      message: 'Booking session has been reset.'
    });
  } catch (error) {
    console.error('Error resetting agent task:', error);
    return res.status(500).json({ error: 'Internal server error while resetting session.' });
  }
});

/**
 * POST /api/agent/book
 * Body: { task_id: string }
 * Executes mock booking through the active Railway Provider
 */
router.post('/book', async (req, res) => {
  try {
    const { task_id } = req.body || {};

    if (!task_id) {
      return res.status(400).json({
        success: false,
        error: '"task_id" is required to complete booking.'
      });
    }

    if (!taskStore.has(task_id)) {
      return res.status(404).json({
        success: false,
        error: `Booking task "${task_id}" not found.`
      });
    }

    const task = getOrCreateTask(task_id);

    // Duplicate booking protection
    if (task.status === 'booking_confirmed' && task.booking_result) {
      return res.status(400).json({
        success: false,
        error: 'Booking has already been completed for this task.',
        booking_result: task.booking_result
      });
    }

    // Verify required journey parameters
    const b = task.booking;
    if (!b.source || !b.destination || !b.date) {
      return res.status(400).json({
        success: false,
        error: 'Incomplete booking parameters. Journey source, destination, and date are required.'
      });
    }

    // Verify selected train
    if (!task.selected_train) {
      return res.status(400).json({
        success: false,
        error: 'No train selected. Please select a train before booking.'
      });
    }

    task.status = 'booking_in_progress';
    task.logActivity('mock_booking_submitted', `Submitting mock booking for train ${task.selected_train.train_number}`);

    const { getProvider } = require('../services/mockRailwayProvider');
    const provider = getProvider();

    const bookingResult = await provider.book(task);

    task.setBookingResult(bookingResult);
    task.logActivity('mock_booking_confirmed', `Simulated booking confirmed. Reference: ${bookingResult.booking_reference}`);

    const confirmMsg = `MOCK BOOKING COMPLETED.\nReference: ${bookingResult.booking_reference}\nStatus: CONFIRMED\nTrain: ${bookingResult.train_number} - ${bookingResult.train_name}\nPassengers: ${bookingResult.passengers}\nTotal Fare: ₹${bookingResult.total_fare}\n\n⚠️ This is a simulated booking through the MOCK RAILWAY PROVIDER and is NOT a real railway ticket.`;
    task.recordMessage('agent', confirmMsg);

    return res.json({
      success: true,
      provider: 'mock',
      mock: true,
      task_id: task.task_id,
      status: task.status,
      booking_result: bookingResult,
      message: confirmMsg,
      booking: task.booking,
      activity: task.activity,
      disclaimer: 'MOCK RAILWAY PROVIDER — Simulation only, no real railway ticket is booked.'
    });
  } catch (error) {
    console.error('Error executing booking:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'An internal error occurred while processing the booking.'
    });
  }
});

module.exports = router;
