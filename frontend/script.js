/**
 * AURA - Autonomous User Request Agent (Phase 1)
 * Frontend Client Script (Vanilla JavaScript)
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const requestInput = document.getElementById('request-input');
  const analyzeBtn = document.getElementById('analyze-btn');
  const clearBtn = document.getElementById('clear-btn');
  const errorMessage = document.getElementById('error-message');
  const resultCard = document.getElementById('result-card');
  const statusBadge = document.getElementById('status-badge');
  const statusIntent = document.getElementById('status-intent');
  const humanReadableText = document.getElementById('human-readable-text');
  const missingFieldsBox = document.getElementById('missing-fields-box');
  const missingFieldsList = document.getElementById('missing-fields-list');
  const jsonOutput = document.getElementById('json-output');

  // Entity elements in grid
  const entityIntent = document.getElementById('entity-intent');
  const entitySource = document.getElementById('entity-source');
  const entityDestination = document.getElementById('entity-destination');
  const entityDate = document.getElementById('entity-date');
  const entityTime = document.getElementById('entity-time');
  const entityPassengers = document.getElementById('entity-passengers');
  const entityClass = document.getElementById('entity-class');
  const entityValid = document.getElementById('entity-valid');

  // Quick example chips
  const chips = document.querySelectorAll('.chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      requestInput.value = chip.getAttribute('data-text');
      analyzeCurrentRequest();
    });
  });

  // Analyze Button click listener
  analyzeBtn.addEventListener('click', analyzeCurrentRequest);

  // Clear Button click listener
  clearBtn.addEventListener('click', () => {
    requestInput.value = '';
    hideError();
    resultCard.style.display = 'none';
    requestInput.focus();
  });

  // Submit on Ctrl+Enter or Cmd+Enter
  requestInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      analyzeCurrentRequest();
    }
  });

  /**
   * Sends the user's natural language input to the backend parser
   */
  async function analyzeCurrentRequest() {
    const message = requestInput.value.trim();

    hideError();

    if (!message) {
      showError('Please enter a request to analyze.');
      return;
    }

    // Set UI to loading state
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${response.status}`);
      }

      const data = await response.json();
      displayResult(data);
    } catch (err) {
      showError(`Error: ${err.message}`);
    } finally {
      // Restore button state
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = 'Analyze Request';
    }
  }

  /**
   * Renders the structured data and human-readable interpretation in the UI
   */
  function displayResult(data) {
    resultCard.style.display = 'block';

    // 1. Status Badge & Intent
    statusBadge.className = 'badge';
    if (data.intent === 'unknown') {
      statusBadge.textContent = 'Unknown Intent';
      statusBadge.classList.add('badge-unknown');
    } else if (data.valid) {
      statusBadge.textContent = 'Valid Request';
      statusBadge.classList.add('badge-valid');
    } else {
      statusBadge.textContent = 'Incomplete Request';
      statusBadge.classList.add('badge-incomplete');
    }

    statusIntent.textContent = `Intent: ${data.intent}`;

    // 2. Human-Readable Interpretation
    humanReadableText.textContent = data.human_readable || 'No interpretation available.';

    // 3. Missing Fields Alert
    if (data.intent === 'train_booking' && data.missing_fields && data.missing_fields.length > 0) {
      missingFieldsBox.style.display = 'block';
      missingFieldsList.innerHTML = '';
      data.missing_fields.forEach(field => {
        const li = document.createElement('li');
        let label = field;
        if (field === 'source') label = 'Departure Station (Source)';
        if (field === 'destination') label = 'Arrival Station (Destination)';
        if (field === 'date') label = 'Travel Date';
        li.textContent = label;
        missingFieldsList.appendChild(li);
      });
    } else {
      missingFieldsBox.style.display = 'none';
    }

    // 4. Structured Entity Values
    setEntityValue(entityIntent, data.intent);
    setEntityValue(entitySource, data.source);
    setEntityValue(entityDestination, data.destination);
    setEntityValue(entityDate, data.date);
    setEntityValue(entityTime, data.time_preference);
    setEntityValue(entityPassengers, data.passengers);
    setEntityValue(entityClass, data.class);
    setEntityValue(entityValid, data.valid ? 'True (Complete)' : 'False (Incomplete)');

    // 5. Raw JSON Output
    jsonOutput.textContent = JSON.stringify(data, null, 2);

    // Smooth scroll into view
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /**
   * Helper to format entity display (shows 'null' with italic style if empty)
   */
  function setEntityValue(element, value) {
    if (value === null || value === undefined) {
      element.textContent = 'null';
      element.classList.add('null-value');
    } else {
      element.textContent = String(value);
      element.classList.remove('null-value');
    }
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.style.display = 'block';
  }

  function hideError() {
    errorMessage.style.display = 'none';
    errorMessage.textContent = '';
  }
});
