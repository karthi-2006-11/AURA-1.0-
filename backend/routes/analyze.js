const express = require('express');
const router = express.Router();
const { analyzeRequest } = require('../services/auraParser');

/**
 * POST /api/analyze
 * Accepts: { "message": "user natural language request" }
 * Returns: Structured AURA analysis result
 */
router.post('/analyze', (req, res) => {
  try {
    const { message } = req.body || {};

    if (message === undefined || message === null) {
      return res.status(400).json({
        error: 'Invalid request: "message" field is required in request body.'
      });
    }

    const result = analyzeRequest(message);
    return res.json(result);
  } catch (error) {
    console.error('Error analyzing request:', error);
    return res.status(500).json({
      error: 'An internal server error occurred while analyzing the request.'
    });
  }
});

module.exports = router;
