/**
 * AURA — Autonomous User Request Agent
 * Phase 3: Premium AI Agent & Workflow Client Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  // Session State
  let currentTaskId = null;
  let isProcessing = false;

  // DOM Elements: Header & Controls
  const btnNewRequest = document.getElementById('btn-new-request');
  const sessionTag = document.getElementById('session-tag');
  const themeToggle = document.getElementById('theme-toggle');

  // DOM Elements: Chat Area
  const chatStream = document.getElementById('chat-stream');
  const emptyState = document.getElementById('empty-state');
  const agentTyping = document.getElementById('agent-typing');
  const quickRepliesBar = document.getElementById('quick-replies-bar');
  const quickRepliesChips = document.getElementById('quick-replies-chips');
  const composerForm = document.getElementById('composer-form');
  const composerInput = document.getElementById('composer-input');
  const btnSend = document.getElementById('btn-send');

  // DOM Elements: Stepper & Progress
  const progressPercent = document.getElementById('progress-percent');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const stepNode1 = document.getElementById('step-node-1');
  const stepNode2 = document.getElementById('step-node-2');
  const stepNode3 = document.getElementById('step-node-3');
  const stepNode4 = document.getElementById('step-node-4');

  // DOM Elements: Current Action
  const actionBadge = document.getElementById('action-badge');
  const currentActionLabel = document.getElementById('current-action-label');

  // DOM Elements: Live Booking State
  const bookingValidityTag = document.getElementById('booking-validity-tag');
  const routeBanner = document.getElementById('route-banner');
  const bannerSource = document.getElementById('banner-source');
  const bannerDestination = document.getElementById('banner-destination');

  const rowSource = document.getElementById('row-source');
  const valSource = document.getElementById('val-source');
  const rowDestination = document.getElementById('row-destination');
  const valDestination = document.getElementById('val-destination');
  const rowDate = document.getElementById('row-date');
  const valDate = document.getElementById('val-date');
  const rowTime = document.getElementById('row-time');
  const valTime = document.getElementById('val-time');
  const rowPassengers = document.getElementById('row-passengers');
  const valPassengers = document.getElementById('val-passengers');
  const rowClass = document.getElementById('row-class');
  const valClass = document.getElementById('val-class');
  const rowTrain = document.getElementById('row-train');
  const valTrain = document.getElementById('val-train');
  const rowFare = document.getElementById('row-fare');
  const valFare = document.getElementById('val-fare');
  const rowReference = document.getElementById('row-reference');
  const valReference = document.getElementById('val-reference');

  // DOM Elements: Timeline & Inspector
  const activityCount = document.getElementById('activity-count');
  const activityList = document.getElementById('activity-list');
  const rawTaskJson = document.getElementById('raw-task-json');

  // --- INITIALIZATION ---
  initTheme();
  initEventListeners();

  function initTheme() {
    const savedTheme = localStorage.getItem('aura-theme');
    let currentTheme = 'dark';
    if (savedTheme === 'light' || savedTheme === 'dark') {
      currentTheme = savedTheme;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      currentTheme = 'light';
    }
    applyTheme(currentTheme);

    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const activeTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const nextTheme = activeTheme === 'dark' ? 'light' : 'dark';
        applyTheme(nextTheme);
        localStorage.setItem('aura-theme', nextTheme);
      });
    }

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('aura-theme')) {
          applyTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (themeToggle) {
      const isDark = theme === 'dark';
      themeToggle.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
      themeToggle.setAttribute('title', `Switch to ${isDark ? 'light' : 'dark'} mode`);
    }
  }

  function initEventListeners() {
    // Composer Submission
    composerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      sendMessage();
    });

    // Enter / Shift+Enter keydown handler
    composerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // New Request Button
    btnNewRequest.addEventListener('click', resetConversation);

    // Starter Prompt Chips in Empty State
    document.querySelectorAll('.starter-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const query = btn.getAttribute('data-query');
        if (query) sendMessage(query);
      });
    });
  }

  /**
   * Dispatches user message to POST /api/agent/message
   */
  async function sendMessage(manualText = null) {
    if (isProcessing) return;

    const message = (manualText !== null ? manualText : composerInput.value).trim();
    if (!message) return;

    if (message.toLowerCase() === 'reset' || message.toLowerCase() === 'new request') {
      resetConversation();
      return;
    }

    // Hide empty state on first interaction
    if (emptyState && emptyState.style.display !== 'none') {
      emptyState.style.display = 'none';
    }

    // Render User Bubble
    renderUserMessage(message);
    composerInput.value = '';

    // Set UI to processing state
    setProcessing(true);

    try {
      const response = await fetch('/api/agent/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: currentTaskId,
          message: message
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned error status ${response.status}`);
      }

      const data = await response.json();
      handleAgentResponse(data);
    } catch (err) {
      console.error('Agent message error:', err);
      renderErrorMessage("Something went wrong while processing your request. Please try again.");
    } finally {
      setProcessing(false);
      composerInput.focus();
    }
  }

  /**
   * Processes the structured data payload returned from the backend agent API
   */
  function handleAgentResponse(data) {
    currentTaskId = data.task_id;
    sessionTag.textContent = `Task: ${data.task_id.substring(0, 11)}`;

    // 1. Render Agent Response Bubble or Specialized Card
    if (data.booking_result) {
      renderAgentMessage(data.message);
      renderMockTicketCard(data.booking_result);
    } else if (data.status === 'cancelled') {
      renderFinalStatusBanner('cancelled', data.message);
    } else if ((data.next_action === 'request_final_confirmation' || data.status === 'booking_ready') && data.selected_train) {
      renderAgentMessage(data.message);
      renderFinalReviewCard(data);
    } else if (data.available_trains && data.available_trains.length > 0 && !data.selected_train) {
      renderAgentMessage(data.message);
      renderTrainSearchResults(data.available_trains);
    } else if (data.status === 'ready_for_confirmation') {
      renderConfirmationCard(data.booking);
    } else {
      renderAgentMessage(data.message);
    }

    // 2. Render Live Booking State
    renderBookingState(data.booking, data.missing_fields, data.status, data.selected_train, data.booking_result);

    // 3. Render Workflow Stepper & Progress
    renderWorkflow(data.status, data.next_action, data.selected_train);

    // 4. Render Current Action
    renderAgentStatus(data.status, data.next_action);

    // 5. Render Activity Timeline
    renderActivity(data.activity, data.status, data.next_action);

    // 6. Render Contextual Quick Replies
    renderQuickReplies(data.status, data.next_action, data.available_trains, data.selected_train);

    // 7. Update Raw JSON
    rawTaskJson.textContent = JSON.stringify(data, null, 2);
  }

  /**
   * Renders a user message bubble
   */
  function renderUserMessage(text) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble user-message';
    bubble.innerHTML = `
      <div class="bubble-header">
        <span class="bubble-time">${getCurrentTimeString()}</span>
        <span class="author-badge">You</span>
      </div>
      <div class="bubble-body">${escapeHtml(text)}</div>
    `;
    chatStream.appendChild(bubble);
    scrollChatToBottom();
  }

  /**
   * Renders an agent message bubble
   */
  function renderAgentMessage(text) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble agent-message';
    bubble.innerHTML = `
      <div class="bubble-header">
        <span class="author-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="m10 15 5-3-5-3v6Z"/>
          </svg>
          AURA Agent
        </span>
        <span class="bubble-time">${getCurrentTimeString()}</span>
      </div>
      <div class="bubble-body">${formatAgentText(text)}</div>
    `;
    chatStream.appendChild(bubble);
    scrollChatToBottom();
  }

  /**
   * Renders confirmation card when status === 'ready_for_confirmation'
   */
  function renderConfirmationCard(b) {
    const card = document.createElement('div');
    card.className = 'confirmation-card';

    const source = b.source || 'Unspecified';
    const dest = b.destination || 'Unspecified';
    const date = b.date ? capitalize(b.date) : 'Not specified';
    const passengers = b.passengers ? `${b.passengers} ${b.passengers === 1 ? 'Passenger' : 'Passengers'}` : '1 Passenger';
    const travelClass = b.class || 'Not specified';
    const time = b.time_preference ? capitalize(b.time_preference) : 'Anytime';

    card.innerHTML = `
      <div class="confirm-card-header">
        <span class="confirm-title">&bull; Journey Review</span>
        <span class="meta-tag">Awaiting Confirmation</span>
      </div>
      <div class="route-summary-box">
        <div class="route-loc">${escapeHtml(source)}</div>
        <div class="route-dir-arrow">&rarr;</div>
        <div class="route-loc">${escapeHtml(dest)}</div>
      </div>
      <div class="confirm-details-grid">
        <div class="confirm-field">
          <span class="confirm-field-lbl">Date</span>
          <span class="confirm-field-val">${escapeHtml(date)}</span>
        </div>
        <div class="confirm-field">
          <span class="confirm-field-lbl">Time Preference</span>
          <span class="confirm-field-val">${escapeHtml(time)}</span>
        </div>
        <div class="confirm-field">
          <span class="confirm-field-lbl">Passengers</span>
          <span class="confirm-field-val">${escapeHtml(passengers)}</span>
        </div>
        <div class="confirm-field">
          <span class="confirm-field-lbl">Class</span>
          <span class="confirm-field-val">${escapeHtml(travelClass)}</span>
        </div>
      </div>
      <div class="confirm-actions">
        <button type="button" class="btn btn-success btn-sm btn-confirm-action" style="flex: 1;">
          Confirm Request
        </button>
        <button type="button" class="btn btn-danger btn-sm btn-cancel-action">
          Cancel
        </button>
      </div>
    `;

    card.querySelector('.btn-confirm-action').addEventListener('click', () => {
      sendMessage('confirm');
    });

    card.querySelector('.btn-cancel-action').addEventListener('click', () => {
      sendMessage('cancel');
    });

    chatStream.appendChild(card);
    scrollChatToBottom();
  }

  /**
   * Renders terminal status banners (Confirmed or Cancelled)
   */
  function renderFinalStatusBanner(type, message) {
    const card = document.createElement('div');
    card.className = `final-status-card ${type}`;

    if (type === 'confirmed') {
      card.innerHTML = `
        <div class="status-headline">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          REQUEST CONFIRMED
        </div>
        <div class="status-body-text">
          ${escapeHtml(message)}
        </div>
        <span class="status-simulated-note">&bull; Simulated confirmation &bull; Actual railway booking is not connected in this prototype.</span>
      `;
    } else {
      card.innerHTML = `
        <div class="status-headline">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="6"/>
          </svg>
          REQUEST CANCELLED
        </div>
        <div class="status-body-text">${escapeHtml(message)}</div>
        <div style="margin-top: 12px;">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-restart-from-banner">Start New Request</button>
        </div>
      `;

      card.querySelector('#btn-restart-from-banner')?.addEventListener('click', resetConversation);
    }

    chatStream.appendChild(card);
    scrollChatToBottom();
  }

  /**
   * Phase 4: Renders interactive mock train search results card
   */
  function renderTrainSearchResults(trains) {
    if (!trains || trains.length === 0) return;

    const card = document.createElement('div');
    card.className = 'trains-card';
    card.innerHTML = `
      <div class="trains-header">
        <span class="trains-title">&bull; Available Trains (Mock Provider)</span>
        <span class="meta-tag">Simulation Schedules</span>
      </div>
      <div class="trains-list"></div>
    `;

    const listContainer = card.querySelector('.trains-list');

    trains.forEach(t => {
      const item = document.createElement('div');
      item.className = 'train-item-card';

      const seatsText = t.seats ? `${t.seats} seats` : 'Available';
      const statusText = t.status || 'AVAILABLE';

      item.innerHTML = `
        <div class="train-main-row">
          <div class="train-identity">
            <span class="train-num">${escapeHtml(t.train_number)}</span>
            <span class="train-name">${escapeHtml(t.train_name)}</span>
          </div>
          <span class="train-fare">₹${t.fare || 850} <small style="font-size:0.68rem; color:var(--text-muted);">/ person</small></span>
        </div>
        <div class="train-schedule-row">
          <div class="train-timing">
            <span class="train-time">${t.departure_time || '08:00'}</span>
            <span style="color:var(--text-muted);">&rarr;</span>
            <span class="train-time">${t.arrival_time || '15:30'}</span>
          </div>
          <span class="train-duration">${t.duration || '7h 30m'}</span>
        </div>
        <div class="train-bottom-row">
          <div class="train-chips">
            <span class="chip-class">${escapeHtml(t.class || '3A')}</span>
            <span class="chip-avail">&bull; ${escapeHtml(statusText)} (${escapeHtml(seatsText)})</span>
          </div>
          <button type="button" class="btn-select-train" data-train="${escapeHtml(t.train_number)}">
            Select Train
          </button>
        </div>
      `;

      item.querySelector('.btn-select-train').addEventListener('click', () => {
        sendMessage(t.train_number);
      });

      listContainer.appendChild(item);
    });

    chatStream.appendChild(card);
    scrollChatToBottom();
  }

  /**
   * Phase 4: Renders final booking review and simulation approval card
   */
  function renderFinalReviewCard(data) {
    const card = document.createElement('div');
    card.className = 'final-review-card';

    const b = data.booking || {};
    const t = data.selected_train || {};
    const avail = t.availability || data.availability || {};
    const passengers = b.passengers || 1;
    const farePerPerson = t.fare || 850;
    const totalFare = farePerPerson * passengers;

    card.innerHTML = `
      <div class="confirm-card-header">
        <span class="confirm-title" style="color: var(--accent-cyan);">&bull; Final Booking Review</span>
        <span class="meta-tag" style="background: rgba(245,158,11,0.15); color: #fbbf24; border-color: rgba(245,158,11,0.3);">Mock Provider</span>
      </div>

      <div class="route-summary-box">
        <div class="route-loc">${escapeHtml(t.source || b.source || 'Origin')}</div>
        <div class="route-dir-arrow">&rarr;</div>
        <div class="route-loc">${escapeHtml(t.destination || b.destination || 'Destination')}</div>
      </div>

      <div class="confirm-details-grid">
        <div class="confirm-field">
          <span class="confirm-field-lbl">Selected Train</span>
          <span class="confirm-field-val" style="color: var(--accent-cyan); font-family: var(--font-mono); font-size: 0.82rem;">${escapeHtml(t.train_number)} - ${escapeHtml(t.train_name)}</span>
        </div>
        <div class="confirm-field">
          <span class="confirm-field-lbl">Schedule</span>
          <span class="confirm-field-val">${escapeHtml(t.departure_time || '08:00')} &rarr; ${escapeHtml(t.arrival_time || '16:00')}</span>
        </div>
        <div class="confirm-field">
          <span class="confirm-field-lbl">Date & Class</span>
          <span class="confirm-field-val">${escapeHtml(capitalize(b.date || 'Tomorrow'))} &bull; ${escapeHtml(t.class || b.class || '3A')}</span>
        </div>
        <div class="confirm-field">
          <span class="confirm-field-lbl">Passengers</span>
          <span class="confirm-field-val">${passengers} ${passengers === 1 ? 'Passenger' : 'Passengers'}</span>
        </div>
        <div class="confirm-field">
          <span class="confirm-field-lbl">Availability</span>
          <span class="confirm-field-val" style="color: #34d399;">${escapeHtml(avail.status || 'AVAILABLE')} (${avail.seats || 42} seats)</span>
        </div>
        <div class="confirm-field">
          <span class="confirm-field-lbl">Total Estimated Fare</span>
          <span class="confirm-field-val" style="color: #34d399; font-size: 1rem;">₹${totalFare}</span>
        </div>
      </div>

      <div class="simulation-disclaimer-box">
        <span style="font-size: 1.1rem; line-height: 1;">⚠️</span>
        <div>
          <strong>MOCK SIMULATION NOTICE:</strong> This is a simulated booking via MockRailwayProvider. No real payment or IRCTC ticket will be issued.
        </div>
      </div>

      <div class="confirm-actions">
        <button type="button" class="btn btn-success btn-sm btn-confirm-final" style="flex: 1;">
          Confirm Mock Booking
        </button>
        <button type="button" class="btn btn-danger btn-sm btn-cancel-final">
          Cancel
        </button>
      </div>
    `;

    card.querySelector('.btn-confirm-final').addEventListener('click', () => {
      sendMessage('confirm');
    });

    card.querySelector('.btn-cancel-final').addEventListener('click', () => {
      sendMessage('cancel');
    });

    chatStream.appendChild(card);
    scrollChatToBottom();
  }

  /**
   * Phase 4: Renders full mock railway boarding ticket
   */
  function renderMockTicketCard(result) {
    if (!result) return;

    const card = document.createElement('div');
    card.className = 'mock-ticket-card';

    card.innerHTML = `
      <div class="ticket-header">
        <div class="ticket-brand">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect width="16" height="16" x="4" y="4" rx="2"/>
            <path d="M4 10h16"/>
            <path d="M12 4v16"/>
          </svg>
          <span>MOCK RAILWAY BOARDING PASS</span>
        </div>
        <span class="ticket-status-pill">SIMULATION CONFIRMED</span>
      </div>

      <div class="ticket-body">
        <div class="ticket-pnr-row">
          <div>
            <div class="ticket-pnr-lbl">Booking Reference</div>
            <div class="ticket-pnr-val">${escapeHtml(result.booking_reference)}</div>
          </div>
          <div style="text-align: right;">
            <div class="ticket-pnr-lbl">Mock PNR</div>
            <div style="font-family: var(--font-mono); font-size: 0.85rem; font-weight: 700; color: #7dd3fc;">${escapeHtml(result.pnr || result.booking_reference)}</div>
          </div>
        </div>

        <div class="route-summary-box" style="margin-bottom: 0;">
          <div class="route-loc">${escapeHtml(result.source)}</div>
          <div class="route-dir-arrow">&rarr;</div>
          <div class="route-loc">${escapeHtml(result.destination)}</div>
        </div>

        <div class="confirm-details-grid" style="margin-bottom: 0;">
          <div class="confirm-field">
            <span class="confirm-field-lbl">Train</span>
            <span class="confirm-field-val">${escapeHtml(result.train_number)} - ${escapeHtml(result.train_name)}</span>
          </div>
          <div class="confirm-field">
            <span class="confirm-field-lbl">Date & Class</span>
            <span class="confirm-field-val">${escapeHtml(capitalize(result.date))} &bull; ${escapeHtml(result.class)}</span>
          </div>
          <div class="confirm-field">
            <span class="confirm-field-lbl">Passengers</span>
            <span class="confirm-field-val">${result.passengers} Passenger(s)</span>
          </div>
          <div class="confirm-field">
            <span class="confirm-field-lbl">Total Mock Fare</span>
            <span class="confirm-field-val" style="color: #34d399; font-size: 1rem;">₹${result.total_fare}</span>
          </div>
        </div>

        <div class="ticket-divider"></div>

        <div class="ticket-disclaimer-box">
          ${escapeHtml(result.disclaimer || 'MOCK RAILWAY PROVIDER — Simulation only, no real railway ticket is booked.')}
        </div>

        <div style="text-align: center; margin-top: 4px;">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-book-another">
            Book Another Journey
          </button>
        </div>
      </div>
    `;

    card.querySelector('#btn-book-another').addEventListener('click', resetConversation);

    chatStream.appendChild(card);
    scrollChatToBottom();
  }

  /**
   * Renders a friendly error notification
   */
  function renderErrorMessage(msg) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble agent-message';
    bubble.innerHTML = `
      <div class="bubble-header">
        <span class="author-badge" style="color: #f43f5e;">System Notice</span>
        <span class="bubble-time">${getCurrentTimeString()}</span>
      </div>
      <div class="bubble-body" style="background-color: rgba(244, 63, 94, 0.1); border-color: rgba(244, 63, 94, 0.3); color: #fda4af;">
        ${escapeHtml(msg)}
      </div>
    `;
    chatStream.appendChild(bubble);
    scrollChatToBottom();
  }

  /**
   * Updates the Live Booking State checklist & route banner
   */
  function renderBookingState(booking, missingFields, status, selectedTrain, bookingResult) {
    const b = booking || {};

    // Route banner
    if (b.source && b.destination) {
      routeBanner.style.display = 'flex';
      bannerSource.textContent = b.source;
      bannerDestination.textContent = b.destination;
    } else {
      routeBanner.style.display = 'none';
    }

    // Individual parameter rows
    updateEntityRow(rowSource, valSource, b.source);
    updateEntityRow(rowDestination, valDestination, b.destination);
    updateEntityRow(rowDate, valDate, b.date ? capitalize(b.date) : null);
    updateEntityRow(rowTime, valTime, b.time_preference ? capitalize(b.time_preference) : null);
    updateEntityRow(rowPassengers, valPassengers, b.passengers ? `${b.passengers} ${b.passengers === 1 ? 'person' : 'people'}` : null);
    updateEntityRow(rowClass, valClass, b.class);

    // Selected Train Row
    if (selectedTrain) {
      rowTrain.classList.add('collected');
      rowTrain.querySelector('.check-icon').innerHTML = '&check;';
      valTrain.classList.remove('not-set');
      valTrain.textContent = `${selectedTrain.train_number} ${selectedTrain.train_name}`;
    } else {
      rowTrain.classList.remove('collected');
      rowTrain.querySelector('.check-icon').innerHTML = '&cir;';
      valTrain.classList.add('not-set');
      valTrain.textContent = 'Not selected';
    }

    // Fare Row
    if (selectedTrain && b.passengers) {
      rowFare.classList.add('collected');
      rowFare.querySelector('.check-icon').innerHTML = '&check;';
      valFare.classList.remove('not-set');
      valFare.textContent = `₹${(selectedTrain.fare || 850) * b.passengers}`;
    } else {
      rowFare.classList.remove('collected');
      rowFare.querySelector('.check-icon').innerHTML = '&cir;';
      valFare.classList.add('not-set');
      valFare.textContent = 'Not calculated';
    }

    // Booking Reference Row
    if (bookingResult && bookingResult.booking_reference) {
      rowReference.classList.add('collected');
      rowReference.querySelector('.check-icon').innerHTML = '&check;';
      valReference.classList.remove('not-set');
      valReference.textContent = bookingResult.booking_reference;
    } else {
      rowReference.classList.remove('collected');
      rowReference.querySelector('.check-icon').innerHTML = '&cir;';
      valReference.classList.add('not-set');
      valReference.textContent = 'Pending';
    }

    // Validity Tag
    if (status === 'booking_confirmed') {
      bookingValidityTag.className = 'validity-tag complete';
      bookingValidityTag.textContent = 'Booked (Mock)';
    } else if (status === 'confirmed' || status === 'booking_ready') {
      bookingValidityTag.className = 'validity-tag complete';
      bookingValidityTag.textContent = 'Trains Loaded';
    } else if (status === 'ready_for_confirmation') {
      bookingValidityTag.className = 'validity-tag complete';
      bookingValidityTag.textContent = 'Complete';
    } else if (status === 'cancelled') {
      bookingValidityTag.className = 'validity-tag';
      bookingValidityTag.style.backgroundColor = 'rgba(244, 63, 94, 0.15)';
      bookingValidityTag.style.color = '#fb7185';
      bookingValidityTag.textContent = 'Cancelled';
    } else {
      bookingValidityTag.className = 'validity-tag incomplete';
      const missingCount = missingFields ? missingFields.length : 0;
      bookingValidityTag.textContent = missingCount > 0 ? `${missingCount} Missing` : 'Incomplete';
    }
  }

  function updateEntityRow(rowEl, valEl, value) {
    const checkIcon = rowEl.querySelector('.check-icon');
    if (value !== null && value !== undefined) {
      rowEl.classList.add('collected');
      checkIcon.innerHTML = '&check;';
      valEl.classList.remove('not-set');
      valEl.textContent = value;
    } else {
      rowEl.classList.remove('collected');
      checkIcon.innerHTML = '&cir;';
      valEl.classList.add('not-set');
      valEl.textContent = 'Not provided';
    }
  }

  /**
   * Updates the Workflow Stepper and Progress Bar (Phase 4: 4 Stages)
   */
  function renderWorkflow(status, nextAction, selectedTrain) {
    stepNode1.className = 'step-node';
    stepNode2.className = 'step-node';
    stepNode3.className = 'step-node';
    stepNode4.className = 'step-node';

    if (status === 'collecting_information') {
      stepNode1.classList.add('active');
      progressPercent.textContent = '25%';
      progressBarFill.style.width = '25%';
    } else if (status === 'ready_for_confirmation') {
      stepNode1.classList.add('completed');
      stepNode2.classList.add('active');
      progressPercent.textContent = '50%';
      progressBarFill.style.width = '50%';
    } else if (status === 'confirmed' || status === 'searching_trains' || status === 'booking_ready') {
      if (selectedTrain || nextAction === 'request_final_confirmation') {
        stepNode1.classList.add('completed');
        stepNode2.classList.add('completed');
        stepNode3.classList.add('active');
        progressPercent.textContent = '75%';
        progressBarFill.style.width = '75%';
      } else {
        stepNode1.classList.add('completed');
        stepNode2.classList.add('active');
        progressPercent.textContent = '50%';
        progressBarFill.style.width = '50%';
      }
    } else if (status === 'booking_in_progress') {
      stepNode1.classList.add('completed');
      stepNode2.classList.add('completed');
      stepNode3.classList.add('completed');
      stepNode4.classList.add('active');
      progressPercent.textContent = '90%';
      progressBarFill.style.width = '90%';
    } else if (status === 'booking_confirmed') {
      stepNode1.classList.add('completed');
      stepNode2.classList.add('completed');
      stepNode3.classList.add('completed');
      stepNode4.classList.add('completed');
      progressPercent.textContent = '100%';
      progressBarFill.style.width = '100%';
    } else if (status === 'cancelled') {
      progressPercent.textContent = 'Cancelled';
      progressBarFill.style.width = '0%';
    }
  }

  /**
   * Updates Current Action Card
   */
  function renderAgentStatus(status, nextAction) {
    actionBadge.textContent = status ? status.toUpperCase().replace(/_/g, ' ') : 'IDLE';

    if (status === 'booking_confirmed') {
      currentActionLabel.textContent = 'Mock booking confirmed & reference issued';
      return;
    }

    if (status === 'cancelled') {
      currentActionLabel.textContent = 'Booking workflow aborted by user';
      return;
    }

    const actionMap = {
      'request_source': 'Requesting departure station',
      'request_destination': 'Requesting destination station',
      'request_date': 'Requesting travel date',
      'request_passengers': 'Requesting passenger count',
      'request_class': 'Requesting travel class',
      'request_confirmation': 'Waiting for journey approval',
      'booking_ready': 'Trains loaded — choose an option',
      'request_final_confirmation': 'Awaiting final booking approval',
      'none': 'Workflow complete'
    };

    currentActionLabel.textContent = actionMap[nextAction] || 'Evaluating request parameters';
  }

  /**
   * Renders the safe Workflow Activity Timeline
   */
  function renderActivity(activityListEvents, status, nextAction) {
    if (!activityListEvents || activityListEvents.length === 0) {
      activityCount.textContent = '0 events';
      return;
    }

    activityCount.textContent = `${activityListEvents.length} events`;
    activityList.innerHTML = '';

    activityListEvents.forEach((item, index) => {
      const isLatest = index === activityListEvents.length - 1;
      const li = document.createElement('li');
      li.className = 'timeline-item';

      let markerClass = 'done';
      let icon = '&check;';

      if (isLatest && (status === 'collecting_information' || status === 'booking_ready')) {
        markerClass = 'active';
        icon = '&rarr;';
      }

      li.innerHTML = `
        <span class="timeline-marker ${markerClass}">${icon}</span>
        <div class="timeline-text">${escapeHtml(humanizeActivity(item.action, item.description))}</div>
      `;
      activityList.appendChild(li);
    });
  }

  function humanizeActivity(action, desc) {
    const map = {
      'task_initialized': 'Booking session initialized',
      'receive_message': 'User input received',
      'extract_entities': 'Extracted journey details',
      'extract_contextual': 'Resolved requested information',
      'evaluate_state': 'Evaluated booking parameters',
      'prompt_user': 'Requested missing details',
      'confirm_booking': 'User confirmed booking parameters',
      'search_trains': 'Searched mock train schedules',
      'trains_found': 'Loaded matching train options',
      'train_selected': 'Selected train option',
      'availability_confirmed': 'Verified mock seat availability',
      'mock_booking_submitted': 'Submitted mock booking request',
      'mock_booking_confirmed': 'Mock booking reference generated',
      'cancel_booking': 'Workflow cancelled',
      'unknown_request': 'Received general query'
    };

    return map[action] || desc || action;
  }

  /**
   * Renders dynamic Contextual Quick Replies bar
   */
  function renderQuickReplies(status, nextAction, availableTrains, selectedTrain) {
    quickRepliesChips.innerHTML = '';

    if (status === 'cancelled') {
      quickRepliesBar.style.display = 'none';
      return;
    }

    if (status === 'booking_confirmed') {
      createQuickChip('Start New Request', 'reset', 'chip-confirm');
      quickRepliesBar.style.display = 'block';
      return;
    }

    if (nextAction === 'request_final_confirmation') {
      createQuickChip('Confirm Mock Booking', 'confirm', 'chip-confirm');
      createQuickChip('Cancel', 'cancel', 'chip-cancel');
      quickRepliesBar.style.display = 'block';
      return;
    }

    if (availableTrains && availableTrains.length > 0 && !selectedTrain) {
      availableTrains.forEach(t => {
        createQuickChip(`${t.train_number} ${t.train_name}`, t.train_number);
      });
      createQuickChip('Cancel', 'cancel', 'chip-cancel');
      quickRepliesBar.style.display = 'block';
      return;
    }

    if (status === 'ready_for_confirmation') {
      createQuickChip('Confirm Request', 'confirm', 'chip-confirm');
      createQuickChip('Cancel', 'cancel', 'chip-cancel');
      quickRepliesBar.style.display = 'block';
      return;
    }

    if (nextAction === 'request_passengers') {
      ['1 passenger', '2 passengers', '3 passengers', '4 passengers'].forEach(label => {
        createQuickChip(label, label);
      });
      quickRepliesBar.style.display = 'block';
    } else if (nextAction === 'request_class') {
      ['3AC', '2AC', '1AC', 'Sleeper', 'Chair Car', '2S'].forEach(label => {
        createQuickChip(label, label);
      });
      quickRepliesBar.style.display = 'block';
    } else if (nextAction === 'request_date') {
      ['Tomorrow', 'Day after tomorrow', 'Today'].forEach(label => {
        createQuickChip(label, label);
      });
      quickRepliesBar.style.display = 'block';
    } else if (nextAction === 'request_source') {
      ['Chennai', 'Bangalore', 'Madurai', 'Coimbatore'].forEach(label => {
        createQuickChip(label, label);
      });
      quickRepliesBar.style.display = 'block';
    } else if (nextAction === 'request_destination') {
      ['Coimbatore', 'Bangalore', 'Chennai', 'Delhi'].forEach(label => {
        createQuickChip(label, label);
      });
      quickRepliesBar.style.display = 'block';
    } else {
      quickRepliesBar.style.display = 'none';
    }
  }

  function createQuickChip(label, sendText, extraClass = '') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `quick-chip ${extraClass}`.trim();
    btn.textContent = label;
    btn.addEventListener('click', () => {
      sendMessage(sendText);
    });
    quickRepliesChips.appendChild(btn);
  }

  /**
   * Resets the entire conversation & session
   */
  async function resetConversation() {
    if (currentTaskId) {
      try {
        await fetch('/api/agent/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task_id: currentTaskId })
        });
      } catch (err) {
        console.warn('Could not reset server task:', err);
      }
    }

    currentTaskId = null;
    sessionTag.textContent = 'Session: Idle';

    // Clear chat stream and restore empty state
    chatStream.innerHTML = '';
    if (emptyState) {
      chatStream.appendChild(emptyState);
      emptyState.style.display = 'block';
    }

    // Reset UI panels
    renderWorkflow('collecting_information');
    progressPercent.textContent = '0%';
    progressBarFill.style.width = '0%';
    actionBadge.textContent = 'IDLE';
    currentActionLabel.textContent = 'Waiting for initial request';

    renderBookingState(null, null, 'idle');
    routeBanner.style.display = 'none';

    activityCount.textContent = '0 events';
    activityList.innerHTML = `
      <li class="timeline-item timeline-empty">
        <span class="timeline-marker pending">&cir;</span>
        <div class="timeline-text">Awaiting journey request</div>
      </li>
    `;

    quickRepliesBar.style.display = 'none';
    quickRepliesChips.innerHTML = '';

    rawTaskJson.textContent = JSON.stringify({ status: "uninitialized" }, null, 2);
    composerInput.value = '';
    composerInput.focus();
  }

  // --- HELPER UTILITIES ---

  function setProcessing(processing) {
    isProcessing = processing;
    btnSend.disabled = processing;
    agentTyping.style.display = processing ? 'block' : 'none';
    if (processing) {
      scrollChatToBottom();
    }
  }

  function scrollChatToBottom() {
    requestAnimationFrame(() => {
      chatStream.scrollTop = chatStream.scrollHeight;
    });
  }

  function getCurrentTimeString() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatAgentText(text) {
    if (!text) return '';
    const escaped = escapeHtml(text);
    return escaped.replace(/\n/g, '<br>');
  }
});
