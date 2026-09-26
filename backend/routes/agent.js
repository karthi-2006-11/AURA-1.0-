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
 * GET /api/agent/task/:id
 * Retrieves current task state by ID
 */
router.get('/task/:id', (req, res) => {
  try {
    const taskId = req.params.id;
    if (!taskStore.has(taskId)) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const task = getOrCreateTask(taskId);
    return res.json(task.toJSON());
  } catch (error) {
    console.error('Error retrieving agent task:', error);
    return res.status(500).json({ error: 'Internal server error while fetching task.' });
  }
});

module.exports = router;
