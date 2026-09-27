/**
 * AURA - Autonomous User Request Agent
 * Phase 4: Railway Trains API Router
 *
 * Implements endpoints for searching trains, selecting train options,
 * and checking seat availability through the Railway Provider abstraction.
 */

const express = require('express');
const router = express.Router();
const { getProvider } = require('../services/mockRailwayProvider');
const { getOrCreateTask, taskStore } = require('../services/auraAgent');

const provider = getProvider();

/**
 * POST /api/trains/search
 * Body: { source, destination, date, class, passengers }
 * Searches available trains via the active provider
 */
router.post('/search', async (req, res) => {
  try {
    const { source, destination, date, class: travelClass, passengers } = req.body || {};

    if (!source || !destination || !date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required search parameters: "source", "destination", and "date" are required.'
      });
    }

    const trains = await provider.searchTrains({
      source,
      destination,
      date,
      class: travelClass,
      passengers: passengers || 1
    });

    return res.json({
      success: true,
      provider: 'mock',
      mock: true,
      count: trains.length,
      trains,
      disclaimer: 'MOCK RAILWAY PROVIDER — Simulation only, no real railway ticket is booked.'
    });
  } catch (error) {
    console.error('Error during train search:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'An internal error occurred during train search.'
    });
  }
});

/**
 * POST /api/trains/select
 * Body: { task_id, train_number }
 * Selects a train for an active booking task
 */
router.post('/select', async (req, res) => {
  try {
    const { task_id, train_number } = req.body || {};

    if (!task_id) {
      return res.status(400).json({
        success: false,
        error: '"task_id" is required to select a train.'
      });
    }

    if (!train_number) {
      return res.status(400).json({
        success: false,
        error: '"train_number" is required.'
      });
    }

    if (!taskStore.has(task_id)) {
      return res.status(404).json({
        success: false,
        error: `Booking task with ID "${task_id}" was not found.`
      });
    }

    const task = getOrCreateTask(task_id);

    // If available_trains is empty, populate by searching
    if (task.available_trains.length === 0 && task.booking.source && task.booking.destination) {
      const searchRes = await provider.searchTrains({
        source: task.booking.source,
        destination: task.booking.destination,
        date: task.booking.date || 'tomorrow',
        class: task.booking.class,
        passengers: task.booking.passengers
      });
      task.setAvailableTrains(searchRes);
    }

    // Select train (throws if not found)
    let selectedTrain;
    try {
      selectedTrain = task.selectTrain(train_number);
    } catch (selErr) {
      return res.status(400).json({
        success: false,
        error: selErr.message
      });
    }

    // Check availability
    const avail = await provider.checkAvailability({
      train_number: selectedTrain.train_number,
      class: selectedTrain.class
    });
    task.setAvailability(avail);

    task.status = 'booking_ready';
    task.next_action = 'request_final_confirmation';

    task.logActivity('train_selected', `Selected train: ${selectedTrain.train_number} (${selectedTrain.train_name})`);
    task.logActivity('availability_confirmed', `Availability confirmed: ${avail.seats} seats (${avail.availability})`);

    const summaryMsg = `Train ${selectedTrain.train_number} (${selectedTrain.train_name}) selected with ${avail.seats} seats available in ${selectedTrain.class}.\n\nWould you like to confirm final booking?`;
    task.recordMessage('agent', summaryMsg);

    return res.json({
      success: true,
      provider: 'mock',
      mock: true,
      task_id: task.task_id,
      status: task.status,
      next_action: task.next_action,
      selected_train: task.selected_train,
      availability: task.availability,
      message: summaryMsg,
      booking: task.booking,
      activity: task.activity
    });
  } catch (error) {
    console.error('Error selecting train:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'An internal error occurred during train selection.'
    });
  }
});

/**
 * POST /api/trains/availability
 * Body: { task_id }
 * Verifies seat availability for the currently selected train
 */
router.post('/availability', async (req, res) => {
  try {
    const { task_id, train_number, class: travelClass } = req.body || {};

    if (task_id) {
      if (!taskStore.has(task_id)) {
        return res.status(404).json({
          success: false,
          error: `Booking task "${task_id}" not found.`
        });
      }

      const task = getOrCreateTask(task_id);

      if (!task.selected_train) {
        return res.status(400).json({
          success: false,
          error: 'No train has been selected for this task yet.'
        });
      }

      const avail = await provider.checkAvailability({
        train_number: task.selected_train.train_number,
        class: task.selected_train.class
      });

      task.setAvailability(avail);

      return res.json({
        success: true,
        provider: 'mock',
        mock: true,
        availability: avail,
        status: avail.availability,
        seats: avail.seats,
        train_number: task.selected_train.train_number,
        class: task.selected_train.class,
        disclaimer: 'MOCK RAILWAY PROVIDER — Simulation only, no real railway ticket is booked.'
      });
    }

    if (train_number) {
      const avail = await provider.checkAvailability({
        train_number,
        class: travelClass || '3A'
      });

      return res.json({
        success: true,
        provider: 'mock',
        mock: true,
        availability: avail,
        status: avail.availability,
        seats: avail.seats,
        train_number,
        class: travelClass || '3A',
        disclaimer: 'MOCK RAILWAY PROVIDER — Simulation only, no real railway ticket is booked.'
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Either "task_id" or "train_number" is required.'
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error checking seat availability.'
    });
  }
});

module.exports = router;
