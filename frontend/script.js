/**
 * AURA - Autonomous User Request Agent (Phase 2)
 * Frontend Conversational Client Script (Vanilla JavaScript)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Session tracking
  let currentTaskId = null;

  // DOM Elements
  const chatMessages = document.getElementById('chat-messages');
  const chatForm = document.getElementById('chat-form');
  const userInput = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');
  const resetBtn = document.getElementById('reset-btn');
  const chipsContainer = document.getElementById('chips-container');

  // Stepper Elements
  const stepCollecting = document.getElementById('step-collecting');
  const stepReady = document.getElementById('step-ready');
  const stepConfirmed = document.getElementById('step-confirmed');

  // State Card Elements
  const taskStatusBadge = document.getElementById('task-status-badge');
  const taskIdDisplay = document.getElementById('task-id-display');
  const stateSource = document.getElementById('state-source');
  const stateDestination = document.getElementById('state-destination');
  const stateDate = document.getElementById('state-date');
  const stateTime = document.getElementById('state-time');
  const statePassengers = document.getElementById('state-passengers');
  const stateClass = document.getElementById('state-class');
  const stateAction = document.getElementById('state-action');
  const missingBox = document.getElementById('missing-box');
  const missingTags = document.getElementById('missing-tags');
  const stateJson = document.getElementById('state-json');

  // Submit form handler
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage();
  });

  // Submit on Ctrl+Enter or Cmd+Enter
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Reset / New Request Button
  resetBtn.addEventListener('click', async () => {
    if (currentTaskId) {
      try {
        await fetch('/api/agent/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task_id: currentTaskId })
        });
      } catch (err) {
        console.warn('Could not reset session on server:', err);
      }
    }

    currentTaskId = null;
    chatMessages.innerHTML = `
      <div class="message-bubble agent-bubble">
        <div class="bubble-sender">AURA Agent</div>
        <div class="bubble-content">
          Session reset. Tell me where and when you would like to travel (e.g. <em>"Book a train from Chennai to Coimbatore tomorrow"</em>).
        </div>
      </div>
    `;

    resetStateUI();
    renderDefaultChips();
    userInput.value = '';
    userInput.focus();
  });

  // Initial chip delegation
  setupChipListeners();

  /**
   * Sends the user's message to POST /api/agent/message
   */
  async function sendMessage(textToSend = null) {
    const text = textToSend || userInput.value.trim();
    if (!text) return;

    // Append user message bubble to chat
    appendBubble('user', text);
    userInput.value = '';

    // Disable send button while awaiting response
    sendBtn.disabled = true;
    sendBtn.textContent = '...';

    try {
      const response = await fetch('/api/agent/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: currentTaskId,
          message: text
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned ${response.status}`);
      }

      const data = await response.json();
      currentTaskId = data.task_id;

      // Append agent response bubble
      appendBubble('agent', data.message);

      // Update state panel and stepper
      updateStateUI(data);

      // Render context-sensitive suggestion chips
      updateSuggestionChips(data);
    } catch (err) {
      appendBubble('agent', `Sorry, an error occurred: ${err.message}`);
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send';
      userInput.focus();
    }
  }

  /**
   * Appends a message bubble into the conversation stream
   */
  function appendBubble(role, text) {
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${role === 'user' ? 'user-bubble' : 'agent-bubble'}`;

    const sender = document.createElement('div');
    sender.className = 'bubble-sender';
    sender.textContent = role === 'user' ? 'You' : 'AURA Agent';

    const content = document.createElement('div');
    content.className = 'bubble-content';
    content.textContent = text;

    bubble.appendChild(sender);
    bubble.appendChild(content);

    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  /**
   * Updates the Live Booking Task state panel
   */
  function updateStateUI(data) {
    taskIdDisplay.textContent = data.task_id;
    stateAction.textContent = data.next_action;

    // 1. Update Status Badge
    taskStatusBadge.className = 'badge';
    if (data.status === 'ready_for_confirmation') {
      taskStatusBadge.textContent = 'Ready for Confirm';
      taskStatusBadge.classList.add('badge-ready');
    } else if (data.status === 'confirmed') {
      taskStatusBadge.textContent = 'Confirmed';
      taskStatusBadge.classList.add('badge-confirmed');
    } else if (data.status === 'cancelled') {
      taskStatusBadge.textContent = 'Cancelled';
      taskStatusBadge.classList.add('badge-cancelled');
    } else {
      taskStatusBadge.textContent = 'Collecting Info';
      taskStatusBadge.classList.add('badge-collecting');
    }

    // 2. Update Stepper Indicator
    stepCollecting.className = 'step';
    stepReady.className = 'step';
    stepConfirmed.className = 'step';

    if (data.status === 'collecting_information') {
      stepCollecting.classList.add('active');
    } else if (data.status === 'ready_for_confirmation') {
      stepCollecting.classList.add('completed');
      stepReady.classList.add('active');
    } else if (data.status === 'confirmed') {
      stepCollecting.classList.add('completed');
      stepReady.classList.add('completed');
      stepConfirmed.classList.add('completed');
    } else if (data.status === 'cancelled') {
      stepCollecting.classList.add('cancelled');
      stepReady.classList.add('cancelled');
      stepConfirmed.classList.add('cancelled');
    }

    // 3. Update Journey Parameters
    const b = data.booking || {};
    setField(stateSource, b.source);
    setField(stateDestination, b.destination);
    setField(stateDate, b.date);
    setField(stateTime, b.time_preference);
    setField(statePassengers, b.passengers);
    setField(stateClass, b.class);

    // 4. Update Missing Fields
    missingTags.innerHTML = '';
    if (data.missing_fields && data.missing_fields.length > 0 && data.status !== 'cancelled' && data.status !== 'confirmed') {
      missingBox.style.display = 'block';
      data.missing_fields.forEach(field => {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = field;
        missingTags.appendChild(tag);
      });
    } else {
      missingBox.style.display = 'none';
    }

    // 5. Update JSON View
    stateJson.textContent = JSON.stringify(data, null, 2);
  }

  function setField(element, val) {
    if (val === null || val === undefined) {
      element.textContent = 'null';
      element.classList.add('null-value');
    } else {
      element.textContent = String(val);
      element.classList.remove('null-value');
    }
  }

  function resetStateUI() {
    taskIdDisplay.textContent = 'Not Started';
    taskStatusBadge.className = 'badge badge-collecting';
    taskStatusBadge.textContent = 'Collecting Info';

    stepCollecting.className = 'step active';
    stepReady.className = 'step';
    stepConfirmed.className = 'step';

    setField(stateSource, null);
    setField(stateDestination, null);
    setField(stateDate, null);
    setField(stateTime, null);
    setField(statePassengers, null);
    setField(stateClass, null);

    stateAction.textContent = 'request_source';
    missingBox.style.display = 'block';
    missingTags.innerHTML = `
      <span class="tag">source</span>
      <span class="tag">destination</span>
      <span class="tag">date</span>
      <span class="tag">passengers</span>
      <span class="tag">class</span>
    `;

    stateJson.textContent = JSON.stringify({ status: "uninitialized" }, null, 2);
  }

  /**
   * Dynamically renders helpful quick chips depending on what the agent needs
   */
  function updateSuggestionChips(data) {
    chipsContainer.innerHTML = '';

    if (data.status === 'ready_for_confirmation') {
      createChip('Confirm / Proceed', 'yes', 'chip-confirm');
      createChip('Cancel Request', 'cancel', 'chip-cancel');
    } else if (data.status === 'confirmed' || data.status === 'cancelled') {
      createChip('Start New Request', 'Book a train from Chennai to Bangalore tomorrow for 2 people in 3AC');
    } else if (data.next_action === 'request_passengers') {
      createChip('1 passenger', '1');
      createChip('2 passengers', '2');
      createChip('3 passengers', '3');
      createChip('4 passengers', '4');
    } else if (data.next_action === 'request_class') {
      createChip('3AC', '3AC');
      createChip('2AC', '2AC');
      createChip('Sleeper (SL)', 'Sleeper');
      createChip('Chair Car (CC)', 'CC');
      createChip('2S (Second Sitting)', '2S');
    } else if (data.next_action === 'request_date') {
      createChip('Tomorrow', 'tomorrow');
      createChip('Day after tomorrow', 'day after tomorrow');
      createChip('Today', 'today');
    } else if (data.next_action === 'request_source') {
      createChip('Chennai', 'Chennai');
      createChip('Bangalore', 'Bangalore');
      createChip('Madurai', 'Madurai');
    } else if (data.next_action === 'request_destination') {
      createChip('Coimbatore', 'Coimbatore');
      createChip('Bangalore', 'Bangalore');
      createChip('Delhi', 'Delhi');
    } else {
      renderDefaultChips();
    }
  }

  function renderDefaultChips() {
    chipsContainer.innerHTML = '';
    createChip('Full Request', 'Book a train from Chennai to Coimbatore tomorrow for 2 people in 3AC.');
    createChip('Missing Passengers & Class', 'Book a train from Chennai to Coimbatore tomorrow.');
    createChip('Missing Source', 'Book a train to Coimbatore tomorrow.');
  }

  function createChip(label, msgText, extraClass = '') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `chip-action ${extraClass}`.trim();
    btn.textContent = label;
    btn.setAttribute('data-msg', msgText);
    btn.addEventListener('click', () => {
      sendMessage(msgText);
    });
    chipsContainer.appendChild(btn);
  }

  function setupChipListeners() {
    const initialChips = chipsContainer.querySelectorAll('.chip-action');
    initialChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const msg = chip.getAttribute('data-msg');
        if (msg) sendMessage(msg);
      });
    });
  }
});
