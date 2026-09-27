/**
 * AURA — Autonomous User Request Agent
 * Phase 3: Premium AI Agent & Workflow Client Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  // Session State
  let currentTaskId = null;
  let currentNextAction = null;
  let currentStatus = null;
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
  const journeyDatePicker = document.getElementById('journey-date-picker');
  const btnOpenDatePicker = document.getElementById('btn-open-date-picker');

  // DOM Elements: Custom AURA Calendar Popover
  const auraCalendar = document.getElementById('aura-calendar');
  const calPrevMonth = document.getElementById('cal-prev-month');
  const calNextMonth = document.getElementById('cal-next-month');
  const calMonthTitle = document.getElementById('cal-month-title');
  const calGrid = document.getElementById('cal-grid');

  // Calendar Popover State
  let isCalendarOpen = false;
  let activeCalendarTrigger = null;
  let calViewYear = new Date().getFullYear();
  let calViewMonth = new Date().getMonth();
  let selectedJourneyDate = null;
  let lastSelectedTrain = null;
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
    initCalendar();

    // Composer focus / blur to gently dim background environment during input
    if (composerInput) {
      composerInput.addEventListener('focus', () => {
        document.body.classList.add('composer-focused');
      });
      composerInput.addEventListener('blur', () => {
        document.body.classList.remove('composer-focused');
      });
    }

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

  function initCalendar() {
    if (!auraCalendar) return;

    if (calPrevMonth) {
      calPrevMonth.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        changeCalendarMonth(-1);
      });
    }

    if (calNextMonth) {
      calNextMonth.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        changeCalendarMonth(1);
      });
    }

    // Document-level event delegation for all date buttons (Trip Overview and dynamically rendered Journey Review cards)
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('#btn-open-date-picker, .btn-edit-date-review, #val-date, #row-date');
      if (trigger) {
        // If clicking inside the calendar itself, ignore
        if (auraCalendar.contains(e.target)) return;

        e.stopPropagation();
        e.preventDefault();

        const resolvedTrigger = trigger.closest('.btn-edit-date-review') ||
                                trigger.closest('#btn-open-date-picker') ||
                                btnOpenDatePicker ||
                                trigger;

        if (isCalendarOpen && activeCalendarTrigger === resolvedTrigger) {
          closeCalendar();
        } else {
          openDatePicker(resolvedTrigger);
        }
        return;
      }

      // Dismiss on click outside
      if (isCalendarOpen) {
        if (auraCalendar.contains(e.target)) return;
        if (activeCalendarTrigger && (activeCalendarTrigger.contains(e.target) || activeCalendarTrigger === e.target)) return;
        closeCalendar();
      }
    });

    // Dismiss on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isCalendarOpen) {
        e.preventDefault();
        const returnFocus = activeCalendarTrigger;
        closeCalendar();
        if (returnFocus && typeof returnFocus.focus === 'function') {
          returnFocus.focus();
        }
      }
    });
  }

  function toggleCalendar(triggerEl) {
    if (isCalendarOpen && activeCalendarTrigger === triggerEl) {
      closeCalendar();
    } else {
      openDatePicker(triggerEl);
    }
  }

  function openDatePicker(triggerEl) {
    openCalendar(triggerEl);
  }

  function openCalendar(triggerEl) {
    if (!auraCalendar) return;

    activeCalendarTrigger = triggerEl || btnOpenDatePicker || rowDate;

    // Determine initial month and selected date safely without undeclared variables
    let existingDateRaw = null;
    if (selectedJourneyDate && !isNaN(selectedJourneyDate.getTime())) {
      existingDateRaw = toDateInputValue(selectedJourneyDate);
    } else if (valDate && !valDate.classList.contains('not-set') && valDate.textContent.trim() !== '—' && valDate.textContent.trim() !== 'Not provided') {
      existingDateRaw = valDate.textContent.trim();
    }

    const parsedExisting = parseJourneyDate(existingDateRaw);
    const now = new Date();

    if (parsedExisting && !isNaN(parsedExisting.getTime())) {
      selectedJourneyDate = parsedExisting;
      calViewYear = parsedExisting.getFullYear();
      calViewMonth = parsedExisting.getMonth();
    } else {
      selectedJourneyDate = null;
      calViewYear = now.getFullYear();
      calViewMonth = now.getMonth();
    }

    // 1. Make visible first so layout and dimensions are active and measurable
    auraCalendar.style.display = 'block';
    isCalendarOpen = true;

    // 2. Render calendar grid for current view year/month
    renderCalendarGrid();

    // 3. Position calendar accurately based on measured dimensions
    positionCalendar(activeCalendarTrigger);

    window.addEventListener('scroll', onCalendarViewportEvent, true);
    window.addEventListener('resize', onCalendarViewportEvent);
  }

  function closeCalendar() {
    if (!isCalendarOpen || !auraCalendar) return;
    auraCalendar.style.display = 'none';
    isCalendarOpen = false;
    activeCalendarTrigger = null;

    window.removeEventListener('scroll', onCalendarViewportEvent, true);
    window.removeEventListener('resize', onCalendarViewportEvent);
  }

  function onCalendarViewportEvent() {
    if (!isCalendarOpen || !activeCalendarTrigger) return;
    if (!document.body.contains(activeCalendarTrigger)) {
      closeCalendar();
      return;
    }
    const rect = activeCalendarTrigger.getBoundingClientRect();
    if (rect.bottom < -20 || rect.top > window.innerHeight + 20) {
      closeCalendar();
      return;
    }
    positionCalendar(activeCalendarTrigger);
  }

  function positionCalendar(trigger) {
    if (!auraCalendar || !trigger) return;

    const rect = trigger.getBoundingClientRect();
    const calWidth = auraCalendar.offsetWidth || 310;
    const calHeight = auraCalendar.offsetHeight || 320;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    let top;

    // Smart vertical positioning (above vs below)
    if (spaceBelow >= calHeight + 12) {
      top = rect.bottom + 8;
    } else if (spaceAbove >= calHeight + 12) {
      top = rect.top - calHeight - 8;
    } else {
      if (spaceBelow >= spaceAbove) {
        top = Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - calHeight - 12));
      } else {
        top = Math.max(12, Math.min(rect.top - calHeight - 8, window.innerHeight - calHeight - 12));
      }
    }

    // Horizontal clamping: keep entirely inside viewport
    let left;
    if (window.innerWidth <= 480) {
      left = Math.max(12, (window.innerWidth - calWidth) / 2);
    } else {
      // If trigger is in the right half of the screen, right-align calendar to trigger
      let desiredLeft = (rect.right > window.innerWidth / 2)
        ? (rect.right - calWidth)
        : rect.left;

      left = Math.max(12, Math.min(desiredLeft, window.innerWidth - calWidth - 12));
    }

    top = Math.max(12, Math.min(top, window.innerHeight - calHeight - 12));

    auraCalendar.style.position = 'fixed';
    auraCalendar.style.top = `${Math.round(top)}px`;
    auraCalendar.style.left = `${Math.round(left)}px`;
  }

  function changeCalendarMonth(delta) {
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();

    calViewMonth += delta;
    if (calViewMonth < 0) {
      calViewMonth = 11;
      calViewYear--;
    } else if (calViewMonth > 11) {
      calViewMonth = 0;
      calViewYear++;
    }

    // Do not allow navigating before the current month
    if (calViewYear < todayYear || (calViewYear === todayYear && calViewMonth < todayMonth)) {
      calViewYear = todayYear;
      calViewMonth = todayMonth;
    }

    renderCalendarGrid();
    if (activeCalendarTrigger) {
      positionCalendar(activeCalendarTrigger);
    }
  }

  function renderCalendarGrid() {
    if (!calGrid || !calMonthTitle) return;

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    calMonthTitle.textContent = `${monthNames[calViewMonth]} ${calViewYear}`;

    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDay = now.getDate();

    const isAtCurrentMonth = (calViewYear === todayYear && calViewMonth === todayMonth);
    if (calPrevMonth) {
      calPrevMonth.disabled = isAtCurrentMonth;
      calPrevMonth.setAttribute('aria-disabled', isAtCurrentMonth ? 'true' : 'false');
    }

    calGrid.innerHTML = '';

    const firstDayIndex = new Date(calViewYear, calViewMonth, 1).getDay();
    const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calViewYear, calViewMonth, 0).getDate();

    // Trailing days from previous month (muted/disabled)
    for (let i = 0; i < firstDayIndex; i++) {
      const dayNum = daysInPrevMonth - firstDayIndex + i + 1;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-day-btn is-outside';
      btn.textContent = dayNum;
      btn.disabled = true;
      btn.tabIndex = -1;
      btn.setAttribute('aria-hidden', 'true');
      calGrid.appendChild(btn);
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-day-btn';
      btn.textContent = d;

      const dateObj = new Date(calViewYear, calViewMonth, d);
      const isPast = (calViewYear < todayYear) ||
                     (calViewYear === todayYear && calViewMonth < todayMonth) ||
                     (calViewYear === todayYear && calViewMonth === todayMonth && d < todayDay);
      const isToday = (calViewYear === todayYear && calViewMonth === todayMonth && d === todayDay);
      const isSelected = selectedJourneyDate &&
                         (selectedJourneyDate.getFullYear() === calViewYear &&
                          selectedJourneyDate.getMonth() === calViewMonth &&
                          selectedJourneyDate.getDate() === d);

      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      btn.setAttribute('aria-label', `${daysOfWeek[dateObj.getDay()]}, ${monthNames[calViewMonth]} ${d}, ${calViewYear}`);

      if (isPast) {
        btn.classList.add('is-past');
        btn.disabled = true;
        btn.setAttribute('aria-disabled', 'true');
      } else {
        if (isToday) btn.classList.add('is-today');
        if (isSelected) {
          btn.classList.add('is-selected');
          btn.setAttribute('aria-selected', 'true');
        }

        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          onDateSelected(dateObj);
        });
      }

      calGrid.appendChild(btn);
    }

    // Leading days from next month to complete the grid (fixed rows to avoid jumping)
    const totalRendered = firstDayIndex + daysInMonth;
    const targetCells = totalRendered > 35 ? 42 : 35;
    for (let n = 1; n <= (targetCells - totalRendered); n++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-day-btn is-outside';
      btn.textContent = n;
      btn.disabled = true;
      btn.tabIndex = -1;
      btn.setAttribute('aria-hidden', 'true');
      calGrid.appendChild(btn);
    }
  }

  function onDateSelected(dateObj) {
    selectedJourneyDate = dateObj;
    closeCalendar();
    const isoStr = toDateInputValue(dateObj);
    onDatePicked(isoStr);
  }

  function onDatePicked(chosenIso) {
    const chosenDate = parseJourneyDate(chosenIso);
    if (!chosenDate) return;

    // Immediately update visible formatted date in Trip Overview
    const formatted = formatJourneyDate(chosenIso);
    valDate.textContent = formatted;
    valDate.classList.remove('not-set');
    if (rowDate) rowDate.classList.add('collected');

    // Agent date representation (e.g. "28th September 2026")
    const agentDateStr = formatDateForAgent(chosenDate);

    // If waiting for date, send agentDateStr directly; otherwise send "Book train for <date>"
    if (currentNextAction === 'request_date') {
      sendMessage(agentDateStr);
    } else {
      sendMessage(`Book train for ${agentDateStr}`);
    }
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
    currentNextAction = data.next_action;
    currentStatus = data.status;
    sessionTag.textContent = `Task: ${data.task_id.substring(0, 11)}`;

    if (data.selected_train) {
      lastSelectedTrain = data.selected_train;
    }

    // 1. Render Agent Response Bubble or Specialized Card
    if (data.booking_result) {
      document.body.classList.add('booking-complete');
      renderMockTicketCard(data.booking_result, data.selected_train || lastSelectedTrain, data.booking);
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
    const date = b.date ? formatJourneyDate(b.date) : 'Not specified';
    const passengers = b.passengers ? `${b.passengers} ${b.passengers === 1 ? 'Passenger' : 'Passengers'}` : '1 Passenger';
    const travelClass = b.class || 'Not specified';
    const time = b.time_preference ? capitalize(b.time_preference) : 'Anytime';

    card.innerHTML = `
      <div class="confirm-card-header">
        <span class="confirm-title">&bull; Journey Review</span>
        <span class="meta-tag">Awaiting Confirmation</span>
      </div>
      <div class="route-summary-box">
        <div class="route-loc-item">
          <span class="route-loc-lbl">From</span>
          <div class="route-loc">${escapeHtml(source)}</div>
        </div>
        <div class="route-dir-arrow">&rarr;</div>
        <div class="route-loc-item">
          <span class="route-loc-lbl">To</span>
          <div class="route-loc">${escapeHtml(dest)}</div>
        </div>
      </div>
      <div class="confirm-details-grid">
        <div class="confirm-field confirm-field-wide">
          <span class="confirm-field-lbl">Journey Date</span>
          <div class="confirm-field-date-row">
            <span class="confirm-field-val">${escapeHtml(date)}</span>
            <button type="button" class="btn-edit-date-review" aria-label="Change journey date" title="Change journey date">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                <line x1="16" x2="16" y1="2" y2="6"/>
                <line x1="8" x2="8" y1="2" y2="6"/>
                <line x1="3" x2="21" y1="10" y2="10"/>
              </svg>
              <span>Change</span>
            </button>
          </div>
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

    card.querySelector('.btn-edit-date-review')?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      openDatePicker(e.currentTarget);
    });

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
        <span class="trains-title">&bull; Available Trains</span>
        <span class="meta-tag">Direct Trains</span>
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
    const formattedDate = formatJourneyDate(b.date || t.date || 'tomorrow');

    card.innerHTML = `
      <div class="confirm-card-header">
        <span class="confirm-title">REVIEW YOUR JOURNEY</span>
        <span class="meta-tag">Final Step</span>
      </div>

      <div class="route-summary-box">
        <div class="route-loc-item">
          <span class="route-loc-lbl">From</span>
          <div class="route-loc">${escapeHtml(t.source || b.source || 'Origin')}</div>
        </div>
        <div class="route-dir-arrow">&rarr;</div>
        <div class="route-loc-item">
          <span class="route-loc-lbl">To</span>
          <div class="route-loc">${escapeHtml(t.destination || b.destination || 'Destination')}</div>
        </div>
      </div>

      <div class="confirm-details-grid">
        <div class="confirm-field confirm-field-wide">
          <span class="confirm-field-lbl">Journey Date</span>
          <div class="confirm-field-date-row">
            <span class="confirm-field-val">${escapeHtml(formattedDate)}</span>
            <button type="button" class="btn-edit-date-review" aria-label="Change journey date" title="Change journey date">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                <line x1="16" x2="16" y1="2" y2="6"/>
                <line x1="8" x2="8" y1="2" y2="6"/>
                <line x1="3" x2="21" y1="10" y2="10"/>
              </svg>
              <span>Change</span>
            </button>
          </div>
        </div>
        <div class="confirm-field">
          <span class="confirm-field-lbl">Selected Train</span>
          <span class="confirm-field-val" style="color: var(--accent-cyan); font-family: var(--font-mono); font-size: 0.85rem;">${escapeHtml(t.train_number)} - ${escapeHtml(t.train_name)}</span>
        </div>
        <div class="confirm-field">
          <span class="confirm-field-lbl">Schedule</span>
          <span class="confirm-field-val">${escapeHtml(t.departure_time || '08:00')} &rarr; ${escapeHtml(t.arrival_time || '16:00')}</span>
        </div>
        <div class="confirm-field">
          <span class="confirm-field-lbl">Passengers</span>
          <span class="confirm-field-val">${passengers}</span>
        </div>
        <div class="confirm-field">
          <span class="confirm-field-lbl">Class</span>
          <span class="confirm-field-val">${escapeHtml(t.class || b.class || '3A')}</span>
        </div>
        <div class="confirm-field">
          <span class="confirm-field-lbl">Availability</span>
          <span class="confirm-field-val" style="color: var(--success-text);">${escapeHtml(avail.status || 'Available')} (${avail.seats || 42} seats)</span>
        </div>
        <div class="confirm-field">
          <span class="confirm-field-lbl">Estimated Fare</span>
          <span class="confirm-field-val" style="color: var(--success-text); font-size: 1.05rem;">₹${totalFare}</span>
        </div>
      </div>

      <div class="confirm-actions">
        <button type="button" class="btn btn-success btn-confirm-final" style="flex: 1;">
          Confirm Booking
        </button>
        <button type="button" class="btn btn-danger btn-sm btn-cancel-final">
          Cancel
        </button>
      </div>
    `;

    card.querySelector('.btn-edit-date-review')?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      openDatePicker(e.currentTarget);
    });

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
   * Helper: Generates crisp simulated QR code vector SVG
   */
  function generateSimulatedQrSvg(refCode, size = 104) {
    const N = 25;
    const grid = Array.from({ length: N }, () => Array(N).fill(0));

    function placeFinder(r0, c0) {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (r === 0 || r === 6 || c === 0 || c === 6) {
            grid[r0 + r][c0 + c] = 1;
          } else if (r === 1 || r === 5 || c === 1 || c === 5) {
            grid[r0 + r][c0 + c] = 0;
          } else {
            grid[r0 + r][c0 + c] = 1;
          }
        }
      }
    }

    placeFinder(0, 0);
    placeFinder(0, N - 7);
    placeFinder(N - 7, 0);

    for (let i = 8; i < N - 8; i++) {
      grid[6][i] = (i % 2 === 0) ? 1 : 0;
      grid[i][6] = (i % 2 === 0) ? 1 : 0;
    }

    const ar = 16, ac = 16;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (r === 0 || r === 4 || c === 0 || c === 4) {
          grid[ar + r][ac + c] = 1;
        } else if (r === 1 || r === 3 || c === 1 || c === 3) {
          grid[ar + r][ac + c] = 0;
        } else {
          grid[ar + r][ac + c] = 1;
        }
      }
    }

    let hash = 5381;
    const str = String(refCode || 'AURA-TICKET');
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const inTL = r < 8 && c < 8;
        const inTR = r < 8 && c >= N - 8;
        const inBL = r >= N - 8 && c < 8;
        const inAlign = r >= ar && r < ar + 5 && c >= ac && c < ac + 5;
        const isTiming = (r === 6 && c >= 8 && c < N - 8) || (c === 6 && r >= 8 && r < N - 8);

        if (!inTL && !inTR && !inBL && !inAlign && !isTiming) {
          const bitVal = Math.abs((hash ^ (r * 31 + c * 17 + (r ^ c) * 7))) % 7;
          grid[r][c] = (bitVal === 0 || bitVal === 2 || bitVal === 5) ? 1 : 0;
        }
      }
    }

    let rects = '';
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (grid[r][c] === 1) {
          rects += `<rect x="${c}" y="${r}" width="1" height="1" fill="#0f172a"/>`;
        }
      }
    }

    return `<svg width="${size}" height="${size}" viewBox="0 0 ${N} ${N}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect width="${N}" height="${N}" fill="#ffffff"/>
      ${rects}
    </svg>`;
  }

  const STATION_DIRECTORY = {
    'chennai': { code: 'MAS', name: 'Chennai Central' },
    'coimbatore': { code: 'CBE', name: 'Coimbatore Jn' },
    'bangalore': { code: 'SBC', name: 'KSR Bengaluru' },
    'bengaluru': { code: 'SBC', name: 'KSR Bengaluru' },
    'madurai': { code: 'MDU', name: 'Madurai Jn' },
    'salem': { code: 'SA', name: 'Salem Jn' },
    'tiruchirappalli': { code: 'TPJ', name: 'Tiruchirappalli Jn' },
    'trichy': { code: 'TPJ', name: 'Tiruchirappalli Jn' },
    'erode': { code: 'ED', name: 'Erode Jn' },
    'delhi': { code: 'NDLS', name: 'New Delhi' },
    'mumbai': { code: 'CSMT', name: 'Mumbai CSMT' }
  };

  function getStationMeta(stationName) {
    if (!stationName) return { code: 'STN', name: 'Station' };
    const key = stationName.trim().toLowerCase();
    if (STATION_DIRECTORY[key]) return STATION_DIRECTORY[key];
    const code = stationName.length <= 4 ? stationName.toUpperCase() : stationName.slice(0, 3).toUpperCase();
    return { code: code, name: capitalize(stationName) };
  }

  const CLASS_FULL_NAMES = {
    '1A': 'AC First Class (1A)',
    '2A': 'AC 2 Tier (2A)',
    '3A': 'AC 3 Tier (3A)',
    '3E': 'AC 3 Economy (3E)',
    'SL': 'Sleeper Class (SL)',
    'CC': 'AC Chair Car (CC)',
    'EC': 'Executive Chair Car (EC)',
    '2S': 'Second Sitting (2S)'
  };

  function formatBookingTimestamp(isoStr) {
    const d = isoStr ? new Date(isoStr) : new Date();
    if (isNaN(d.getTime())) return 'Recently booked';
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hrs = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}-${month}-${year} ${hrs}:${mins} IST`;
  }

  function generatePassengerAllocations(passengerCount, travelClass, refCode) {
    const cls = (travelClass || '3A').toUpperCase();
    let coachPrefix = 'B';
    let berths = ['Lower', 'Middle', 'Upper', 'Side Lower', 'Side Upper'];

    if (cls === '1A') {
      coachPrefix = 'H';
      berths = ['Lower', 'Upper', 'Lower', 'Upper'];
    } else if (cls === '2A') {
      coachPrefix = 'A';
      berths = ['Lower', 'Upper', 'Side Lower', 'Side Upper'];
    } else if (cls === '3A' || cls === '3E') {
      coachPrefix = 'B';
      berths = ['Lower', 'Middle', 'Upper', 'Side Lower', 'Side Upper'];
    } else if (cls === 'SL') {
      coachPrefix = 'S';
      berths = ['Lower', 'Middle', 'Upper', 'Side Lower', 'Side Upper'];
    } else if (cls === 'CC') {
      coachPrefix = 'C';
      berths = ['Window', 'Aisle', 'Middle', 'Window', 'Aisle'];
    } else if (cls === 'EC') {
      coachPrefix = 'E';
      berths = ['Window', 'Aisle', 'Window', 'Aisle'];
    } else if (cls === '2S') {
      coachPrefix = 'D';
      berths = ['Window', 'Middle', 'Aisle'];
    }

    let seed = 21;
    if (refCode) {
      let hash = 0;
      for (let i = 0; i < refCode.length; i++) {
        hash = (hash * 31 + refCode.charCodeAt(i)) % 35;
      }
      seed = 12 + Math.abs(hash);
    }

    const rows = [];
    const count = Math.max(1, parseInt(passengerCount, 10) || 1);
    for (let i = 1; i <= count; i++) {
      const seatNum = seed + (i - 1);
      const berthType = berths[(i - 1) % berths.length];
      const coach = `${coachPrefix}1`;
      rows.push({
        sno: i,
        name: `Passenger ${i} (Adult)`,
        bookingStatus: 'CNF',
        currentStatus: 'CNF',
        coach: coach,
        berth: `${seatNum} / ${berthType}`,
        quota: 'GN'
      });
    }
    return rows;
  }

  /**
   * Phase 4 & Post-Phase 6: Renders AURA Electronic Reservation Slip (E-Ticket)
   */
  function renderMockTicketCard(result, selectedTrain = null, booking = null) {
    if (!result) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'aura-booking-success-view';

    const formattedDate = formatJourneyDate(result.date || (booking && booking.date));
    const srcMeta = getStationMeta(result.source);
    const dstMeta = getStationMeta(result.destination);

    const trainSchedules = {
      '12675': { dep: '06:10', arr: '14:05', dur: '07h 55m' },
      '12679': { dep: '14:30', arr: '22:15', dur: '07h 45m' },
      '12673': { dep: '22:10', arr: '06:00', dur: '07h 50m' },
      '12676': { dep: '15:15', arr: '22:50', dur: '07h 35m' },
      '12680': { dep: '06:20', arr: '13:50', dur: '07h 30m' },
      '12007': { dep: '06:00', arr: '10:45', dur: '04h 45m' },
      '12607': { dep: '15:30', arr: '21:35', dur: '06h 05m' },
      '12657': { dep: '22:50', arr: '04:30', dur: '05h 40m' },
      '12608': { dep: '06:20', arr: '12:20', dur: '06h 00m' },
      '12658': { dep: '22:40', arr: '04:20', dur: '05h 40m' },
      '12638': { dep: '21:35', arr: '05:15', dur: '07h 40m' },
      '12637': { dep: '21:40', arr: '05:35', dur: '07h 55m' },
      '12635': { dep: '13:50', arr: '21:15', dur: '07h 25m' }
    };

    const schedFallback = trainSchedules[result.train_number] || { dep: '08:00', arr: '15:30', dur: '07h 30m' };
    const depTime = (selectedTrain && (selectedTrain.departure || selectedTrain.departure_time)) || schedFallback.dep;
    const arrTime = (selectedTrain && (selectedTrain.arrival || selectedTrain.arrival_time)) || schedFallback.arr;
    const duration = (selectedTrain && selectedTrain.duration) || schedFallback.dur;

    const travelClass = result.class || (booking && booking.class) || '3A';
    const classDisplayName = CLASS_FULL_NAMES[travelClass] || `${travelClass} Class`;
    const passengersCount = Math.max(1, parseInt(result.passengers || (booking && booking.passengers) || 1, 10));
    const passengerAllocations = generatePassengerAllocations(passengersCount, travelClass, result.booking_reference);

    const totalFare = Number(result.total_fare) || 0;
    const convenienceFee = totalFare > 40 ? 40 : 0;
    const baseFare = Math.max(0, totalFare - convenienceFee);
    const bookingTimeStr = formatBookingTimestamp(result.booked_at);
    const qrSvg = generateSimulatedQrSvg(result.booking_reference, 104);

    const passengerRowsHtml = passengerAllocations.map(p => `
      <tr>
        <td style="text-align: center; color: #64748b; font-weight: 700;">${p.sno}</td>
        <td>
          <div style="font-weight: 700; color: #0f172a;">${escapeHtml(p.name)}</div>
          <div style="font-size: 0.72rem; color: #64748b;">Adult &bull; Indian National</div>
        </td>
        <td style="text-align: center;">
          <span class="eticket-cnf-badge">CNF</span>
        </td>
        <td style="text-align: center;">
          <span class="eticket-cnf-badge">CNF</span>
        </td>
        <td style="text-align: center; font-weight: 800; color: #1e3a8a; font-family: var(--font-mono);">${escapeHtml(p.coach)}</td>
        <td style="font-weight: 800; color: #0f172a; font-family: var(--font-mono);">${escapeHtml(p.berth)}</td>
        <td style="text-align: center; font-weight: 700; color: #475569;">${escapeHtml(p.quota)}</td>
      </tr>
    `).join('');

    wrapper.innerHTML = `
      <!-- 1. FINAL CONFIRMATION HERO -->
      <div class="confirmation-hero">
        <div class="hero-check-circle" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div class="hero-eyebrow">JOURNEY CONFIRMED</div>
        <h1 class="hero-main-title">Your railway journey is ready.</h1>
        <p class="hero-sub-title">Your AURA reservation reference has been generated.</p>
      </div>

      <!-- 2. THE COMPLETE AURA E-TICKET DOCUMENT (760-900PX, CENTERED) -->
      <div class="aura-eticket-card mock-ticket-card" id="aura-eticket-document">
        <!-- Header -->
        <div class="eticket-header">
          <div class="eticket-brand-col">
            <div class="eticket-logo-row">
              <svg class="eticket-logo-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="18" height="16" x="3" y="4" rx="3"/>
                <path d="M7 15h10"/>
                <circle cx="7.5" cy="11.5" r="1.5" fill="currentColor"/>
                <circle cx="16.5" cy="11.5" r="1.5" fill="currentColor"/>
                <path d="M9 4v-1a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/>
              </svg>
              <div class="eticket-titles">
                <div class="eticket-org-name">AURA RAILWAY RESERVATION SYSTEM</div>
                <div class="eticket-doc-type">ELECTRONIC RESERVATION SLIP (ERS)</div>
              </div>
            </div>
          </div>
          <div class="eticket-status-col">
            <span class="eticket-simulated-badge">SIMULATED RESERVATION</span>
            <span class="eticket-status-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              CONFIRMED
            </span>
          </div>
        </div>

        <!-- Reference & Meta Bar -->
        <div class="eticket-ref-bar">
          <div class="eticket-ref-cell">
            <span class="eticket-cell-lbl">PNR / BOOKING REF</span>
            <span class="eticket-cell-val eticket-mono-ref">${escapeHtml(result.booking_reference)}</span>
          </div>
          <div class="eticket-ref-cell">
            <span class="eticket-cell-lbl">TRANSACTION / TASK ID</span>
            <span class="eticket-cell-val eticket-mono">${escapeHtml(currentTaskId ? currentTaskId.substring(0, 15) : 'AURA-TXN-001')}</span>
          </div>
          <div class="eticket-ref-cell">
            <span class="eticket-cell-lbl">BOOKING DATE & TIME</span>
            <span class="eticket-cell-val">${escapeHtml(bookingTimeStr)}</span>
          </div>
          <div class="eticket-ref-cell eticket-cell-right">
            <span class="eticket-cell-lbl">QUOTA</span>
            <span class="eticket-cell-val">GENERAL (GN)</span>
          </div>
        </div>

        <!-- Journey Route Banner -->
        <div class="eticket-journey-banner">
          <div class="eticket-journey-station">
            <div class="eticket-stn-code">${escapeHtml(srcMeta.code)}</div>
            <div class="eticket-stn-name">${escapeHtml(srcMeta.name)}</div>
            <div class="eticket-stn-time">Dep: <strong>${escapeHtml(depTime)} hrs</strong></div>
          </div>

          <div class="eticket-route-middle">
            <div class="eticket-journey-date">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                <line x1="16" x2="16" y1="2" y2="6"/>
                <line x1="8" x2="8" y1="2" y2="6"/>
                <line x1="3" x2="21" y1="10" y2="10"/>
              </svg>
              <span>${escapeHtml(formattedDate)}</span>
            </div>
            <div class="eticket-route-arrow-line">
              <div class="route-line-fill"></div>
              <span class="route-duration-badge">${escapeHtml(duration)}</span>
            </div>
            <div class="eticket-class-pill">${escapeHtml(classDisplayName)}</div>
          </div>

          <div class="eticket-journey-station eticket-station-dst">
            <div class="eticket-stn-code">${escapeHtml(dstMeta.code)}</div>
            <div class="eticket-stn-name">${escapeHtml(dstMeta.name)}</div>
            <div class="eticket-stn-time">Arr: <strong>${escapeHtml(arrTime)} hrs</strong></div>
          </div>
        </div>

        <!-- Train Details Strip -->
        <div class="eticket-schedule-strip">
          <div class="eticket-strip-col">
            <span class="strip-lbl">Train Number & Name</span>
            <span class="strip-val">${escapeHtml(result.train_number)} / ${escapeHtml(result.train_name)}</span>
          </div>
          <div class="eticket-strip-col">
            <span class="strip-lbl">Boarding Station</span>
            <span class="strip-val">${escapeHtml(srcMeta.name)} (${escapeHtml(srcMeta.code)})</span>
          </div>
          <div class="eticket-strip-col">
            <span class="strip-lbl">Destination Station</span>
            <span class="strip-val">${escapeHtml(dstMeta.name)} (${escapeHtml(dstMeta.code)})</span>
          </div>
          <div class="eticket-strip-col">
            <span class="strip-lbl">Class / Quota</span>
            <span class="strip-val">${escapeHtml(result.class)} &bull; GN</span>
          </div>
        </div>

        <!-- Passenger Table -->
        <div class="eticket-passengers-section">
          <div class="eticket-section-title">PASSENGER DETAILS (${passengersCount})</div>
          <div class="eticket-table-scroll">
            <table class="eticket-passengers-table">
              <thead>
                <tr>
                  <th style="width: 44px; text-align: center;">#</th>
                  <th>Passenger</th>
                  <th style="text-align: center;">Booking Status</th>
                  <th style="text-align: center;">Current Status</th>
                  <th style="text-align: center;">Coach</th>
                  <th>Seat / Berth</th>
                  <th style="text-align: center;">Quota</th>
                </tr>
              </thead>
              <tbody>
                ${passengerRowsHtml}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Bottom Split: Fare & QR -->
        <div class="eticket-bottom-grid">
          <div class="eticket-fare-box">
            <div class="eticket-section-title" style="margin-bottom: 8px;">PAYMENT &amp; FARE SUMMARY</div>
            <div class="eticket-fare-rows">
              <div class="eticket-fare-row">
                <span>Ticket Base Fare (${passengersCount} Passenger${passengersCount > 1 ? 's' : ''}):</span>
                <span>₹${baseFare.toFixed(2)}</span>
              </div>
              <div class="eticket-fare-row">
                <span>Convenience &amp; Reservation Fee:</span>
                <span>₹${convenienceFee.toFixed(2)}</span>
              </div>
              <div class="eticket-fare-row">
                <span>Goods &amp; Services Tax (GST):</span>
                <span>₹0.00</span>
              </div>
              <div class="eticket-fare-row eticket-fare-total">
                <span>Total Amount Paid:</span>
                <span class="fare-total-highlight">₹${totalFare.toFixed(2)}</span>
              </div>
            </div>
            <div class="eticket-payment-tag">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect width="20" height="14" x="2" y="5" rx="2"/>
                <line x1="2" x2="22" y1="10" y2="10"/>
              </svg>
              PAYMENT STATUS: COMPLETED (SIMULATED)
            </div>
          </div>

          <div class="eticket-qr-box">
            <div class="eticket-qr-wrapper">
              ${qrSvg}
            </div>
            <div class="eticket-qr-caption">
              <div class="qr-verify-txt">DIGITAL TOKEN</div>
              <div class="qr-hash-mono">${escapeHtml(result.booking_reference)}</div>
            </div>
          </div>
        </div>

        <!-- 7. Disclaimer / Advisory Footer (Elegant & Minimal) -->
        <div class="eticket-disclaimer-footer">
          <div class="eticket-disclaimer-p">
            <strong>AURA PROTOTYPE</strong> &bull; Simulated reservation &bull; No real railway ticket issued
          </div>
          <div class="eticket-disclaimer-sub">
            Academic research prototype &bull; Valid original photo ID required during journey on Indian Railways
          </div>
        </div>
      </div>

      <!-- 3. ACTIONS TOOLBAR UNDER TICKET -->
      <div class="confirmation-actions">
        <button type="button" class="btn btn-primary btn-lg btn-new-journey" id="btn-start-new-journey">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
            <path d="M8 16H3v5"/>
          </svg>
          Start New Journey
        </button>

        <button type="button" class="btn btn-secondary btn-ticket-action" id="btn-print-eticket">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect width="12" height="8" x="6" y="14"/>
          </svg>
          Print Ticket
        </button>

        <button type="button" class="btn btn-secondary btn-ticket-action" id="btn-save-pdf">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" x2="12" y1="18" y2="12"/>
            <polyline points="9 15 12 18 15 15"/>
          </svg>
          Save as PDF
        </button>
      </div>

      <!-- 4. SUBTLE COLLAPSIBLE TECHNICAL SESSION DETAILS -->
      <details class="confirmation-technical-details">
        <summary>Technical &amp; Session Details</summary>
        <div class="conf-tech-body">
          <div class="conf-tech-row"><span>Booking Reference:</span> <strong class="mono">${escapeHtml(result.booking_reference)}</strong></div>
          <div class="conf-tech-row"><span>Task Session ID:</span> <span class="mono">${escapeHtml(currentTaskId || 'N/A')}</span></div>
          <div class="conf-tech-row"><span>Booked Timestamp:</span> <span>${escapeHtml(bookingTimeStr)}</span></div>
          <div class="conf-tech-row"><span>Status:</span> <span class="pill-cnf">CONFIRMED</span></div>
          <div class="conf-tech-row"><span>Architecture:</span> <span>Deterministic NLU &bull; Stateful Mock Provider Simulation</span></div>
        </div>
      </details>
    `;

    wrapper.querySelector('#btn-start-new-journey')?.addEventListener('click', resetConversation);
    wrapper.querySelector('#btn-print-eticket')?.addEventListener('click', () => {
      window.print();
    });
    wrapper.querySelector('#btn-save-pdf')?.addEventListener('click', () => {
      window.print();
    });

    chatStream.appendChild(wrapper);
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
    if (b.date) {
      updateEntityRow(rowDate, valDate, formatJourneyDate(b.date));
      const parsed = parseJourneyDate(b.date);
      if (parsed) {
        selectedJourneyDate = parsed;
        if (journeyDatePicker) {
          journeyDatePicker.value = toDateInputValue(parsed);
        }
      }
    } else {
      updateEntityRow(rowDate, valDate, null);
      selectedJourneyDate = null;
      if (journeyDatePicker) journeyDatePicker.value = '';
    }
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

    // Compact Journey Summary card updates
    const tripStationFrom = document.getElementById('trip-station-from');
    const tripStationTo = document.getElementById('trip-station-to');
    const tripDateDisplay = document.getElementById('trip-date-display');
    const tripMetaInfo = document.getElementById('trip-meta-info');

    if (tripStationFrom && tripStationTo && tripDateDisplay && tripMetaInfo) {
      if (b && b.source) {
        tripStationFrom.textContent = getStationMeta(b.source).name;
        tripStationFrom.classList.add('has-val');
      } else {
        tripStationFrom.textContent = 'Select origin';
        tripStationFrom.classList.remove('has-val');
      }

      if (b && b.destination) {
        tripStationTo.textContent = getStationMeta(b.destination).name;
        tripStationTo.classList.add('has-val');
      } else {
        tripStationTo.textContent = 'Select destination';
        tripStationTo.classList.remove('has-val');
      }

      if (b && b.date) {
        tripDateDisplay.textContent = formatJourneyDate(b.date);
        tripDateDisplay.classList.add('has-val');
      } else {
        tripDateDisplay.textContent = 'Date not selected';
        tripDateDisplay.classList.remove('has-val');
      }

      const passCount = (b && b.passengers) ? b.passengers : 1;
      const passText = `${passCount} ${passCount === 1 ? 'passenger' : 'passengers'}`;
      const clsText = (b && b.class) ? b.class : 'Any class';
      tripMetaInfo.textContent = `${passText} · ${clsText}`;
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
    document.body.classList.remove('booking-complete');

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
    currentNextAction = null;
    currentStatus = null;
    lastSelectedTrain = null;
    sessionTag.textContent = 'Session: Idle';

    const tripStationFrom = document.getElementById('trip-station-from');
    const tripStationTo = document.getElementById('trip-station-to');
    const tripDateDisplay = document.getElementById('trip-date-display');
    const tripMetaInfo = document.getElementById('trip-meta-info');
    if (tripStationFrom) {
      tripStationFrom.textContent = 'Select origin';
      tripStationFrom.classList.remove('has-val');
    }
    if (tripStationTo) {
      tripStationTo.textContent = 'Select destination';
      tripStationTo.classList.remove('has-val');
    }
    if (tripDateDisplay) {
      tripDateDisplay.textContent = 'Date not selected';
      tripDateDisplay.classList.remove('has-val');
    }
    if (tripMetaInfo) {
      tripMetaInfo.textContent = '1 passenger · Any class';
    }

    if (journeyDatePicker) {
      journeyDatePicker.value = '';
      journeyDatePicker.min = toDateInputValue(new Date());
    }

    closeCalendar();
    selectedJourneyDate = null;

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

  /**
   * Reusable Date Parser for Journey Dates
   * Resolves relative expressions ('today', 'tomorrow', 'day after tomorrow')
   * and explicit calendar dates into local Date objects.
   */
  function parseJourneyDate(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const clean = raw.trim().toLowerCase();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDate = now.getDate();

    if (clean === 'today') {
      return new Date(currentYear, currentMonth, currentDate);
    }
    if (clean === 'tomorrow') {
      return new Date(currentYear, currentMonth, currentDate + 1);
    }
    if (clean === 'day after tomorrow') {
      return new Date(currentYear, currentMonth, currentDate + 2);
    }

    // ISO format: YYYY-MM-DD
    const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
    }

    // DD/MM/YYYY or DD-MM-YYYY
    const numMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (numMatch) {
      return new Date(parseInt(numMatch[3], 10), parseInt(numMatch[2], 10) - 1, parseInt(numMatch[1], 10));
    }

    // Verbal date: e.g. '25th March', '28th September 2026'
    const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const monthAbbrs = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const verbalMatch = clean.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?$/);
    if (verbalMatch) {
      const day = parseInt(verbalMatch[1], 10);
      const mStr = verbalMatch[2];
      let mIdx = months.indexOf(mStr);
      if (mIdx === -1) mIdx = monthAbbrs.indexOf(mStr.slice(0, 3));
      if (mIdx !== -1) {
        let year = verbalMatch[3] ? parseInt(verbalMatch[3], 10) : currentYear;
        return new Date(year, mIdx, day);
      }
    }

    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
    return null;
  }

  /**
   * ONE Reusable Journey Date Formatter
   * Produces polished calendar date format: "Monday, September 28, 2026"
   */
  function formatJourneyDate(raw) {
    if (!raw) return 'Not provided';
    const d = parseJourneyDate(raw);
    if (!d || isNaN(d.getTime())) return capitalize(raw);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  function toDateInputValue(d) {
    if (!d || isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function formatDateForAgent(d) {
    if (!d || isNaN(d.getTime())) return 'tomorrow';
    const day = d.getDate();
    const suffix = getOrdinalSuffix(day);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${day}${suffix} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  function getOrdinalSuffix(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }
});
