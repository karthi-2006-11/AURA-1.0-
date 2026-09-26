const express = require('express');
const path = require('path');
const analyzeRoute = require('./routes/analyze');
const agentRoute = require('./routes/agent');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse incoming JSON bodies
app.use(express.json());

// Serve static frontend files from the frontend directory
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Mount API routes (Phase 1 & Phase 2)
app.use('/api', analyzeRoute);
app.use('/api/agent', agentRoute);

// Fallback route to serve index.html for any root requests
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Start the server only if run directly from CLI
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(` AURA (Autonomous User Request Agent)`);
    console.log(` Phase 1 (NLU) & Phase 2 (Agent Workflow)`);
    console.log(` Server is running on: http://localhost:${PORT}`);
    console.log(`===============================================`);
  });
}

module.exports = { app };
