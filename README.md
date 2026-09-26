# AURA — Autonomous User Request Agent
## Phase 1 + Phase 2: AI Agent & Multi-Turn Booking Workflow

A railway-focused autonomous user request agent prototype.
- **Phase 1**: Natural-Language Understanding (NLU), entity extraction, normalization, and validation.
- **Phase 2**: Autonomous AI Agent workflow, in-memory session management, contextual follow-ups, and interactive simulated booking progression.

---

## Agent Workflow Architecture

```text
User Message (e.g., "Book a train from Chennai to Coimbatore tomorrow.")
    │
    ▼
Frontend (Vanilla HTML/CSS/JS Conversational Interface)
    │  POST /api/agent/message { task_id, message }
    ▼
Express Route (backend/routes/agent.js)
    │
    ▼
AURA Agent Engine (backend/services/auraAgent.js)
    ├── 1. Session Store (Map<taskId, BookingTask>)
    │       └── Retrieves existing task or initializes new task
    ├── 2. Confirmation / Cancellation Evaluation
    │       └── Handles "yes", "confirm", "cancel", "stop"
    ├── 3. Contextual Short-Answer Resolution
    │       └── Understands "2" as passengers, "3AC" as class, etc.
    ├── 4. NLU Parsing (reusing backend/services/auraParser.js)
    │       └── Extracts source, destination, date, passengers, class, time
    ├── 5. Missing Field Prioritization
    │       └── Evaluates priority: source -> destination -> date -> passengers -> class
    ├── 6. Action & Prompt Decision
    │       ├── Status: collecting_information -> Prompts for next missing detail
    │       ├── Status: ready_for_confirmation -> Generates journey summary
    │       └── Status: confirmed / cancelled -> Final simulated status
    └── 7. Safe Activity Logging
    │
    ▼
Structured Agent Response JSON
    │
    ▼
Frontend UI Update
    ├── Appends conversation bubbles (User & Agent)
    ├── Updates 3-step Workflow Stepper (Collecting -> Ready -> Confirmed)
    ├── Updates Live Booking State Sidebar
    └── Contextual Quick Reply Chips
```

---

## Project Structure

```text
D:\AURA\
├── backend/
│   ├── server.js              # Express server & static asset host
│   ├── routes/
│   │   ├── analyze.js         # Phase 1: POST /api/analyze
│   │   └── agent.js           # Phase 2: POST /api/agent/message & /reset
│   ├── services/
│   │   ├── auraParser.js      # Phase 1: Core deterministic NLU parser
│   │   └── auraAgent.js       # Phase 2: Agent decision engine & session manager
│   └── models/
│       └── bookingTask.js     # Phase 2: Booking task state model
├── frontend/
│   ├── index.html             # Conversational interface + state sidebar
│   ├── style.css              # Custom styling (zero CSS frameworks)
│   └── script.js              # Multi-turn chat client & dynamic chips
├── tests/
│   ├── parser.test.js         # Phase 1: Parser unit tests
│   ├── server.test.js         # Phase 1: HTTP API integration test
│   ├── agent.test.js          # Phase 2: Agent workflow tests (8 scenarios)
│   └── agent_server.test.js   # Phase 2: Multi-turn HTTP integration test
├── package.json               # Dependencies and test scripts
└── README.md                  # Complete documentation
```

---

## How to Run

### 1. Install Dependencies
```bash
npm install
```

### 2. Run All Tests
```bash
npm test
```
Runs 18 automated tests across Phase 1 and Phase 2.

### 3. Start the Server
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## Agent API Endpoints

### 1. `POST /api/agent/message`

**Request:**
```json
{
  "task_id": null,
  "message": "Book me a train from Chennai to Coimbatore tomorrow."
}
```

**Response (Collecting Info):**
```json
{
  "task_id": "task_8a7d1b",
  "status": "collecting_information",
  "next_action": "request_passengers",
  "message": "Got it. How many passengers are travelling?",
  "booking": {
    "source": "Chennai",
    "destination": "Coimbatore",
    "date": "tomorrow",
    "time_preference": null,
    "passengers": null,
    "class": null
  },
  "missing_fields": ["passengers", "class"],
  "activity": [...]
}
```

**Follow-up Request (User answers passengers):**
```json
{
  "task_id": "task_8a7d1b",
  "message": "2"
}
```

**Response (Next question):**
```json
{
  "task_id": "task_8a7d1b",
  "status": "collecting_information",
  "next_action": "request_class",
  "message": "What travel class would you prefer? (e.g., 3AC, 2AC, 1AC, Sleeper, CC, 2S)",
  "booking": {
    "source": "Chennai",
    "destination": "Coimbatore",
    "date": "tomorrow",
    "time_preference": null,
    "passengers": 2,
    "class": null
  },
  "missing_fields": ["class"]
}
```

**Follow-up Request (User answers class):**
```json
{
  "task_id": "task_8a7d1b",
  "message": "3AC"
}
```

**Response (Ready for Confirmation):**
```json
{
  "task_id": "task_8a7d1b",
  "status": "ready_for_confirmation",
  "next_action": "request_confirmation",
  "message": "Here is your booking request:\n\nFrom: Chennai\nTo: Coimbatore\nDate: tomorrow\nPassengers: 2\nClass: 3A\n\nWould you like to proceed?",
  "booking": {
    "source": "Chennai",
    "destination": "Coimbatore",
    "date": "tomorrow",
    "time_preference": null,
    "passengers": 2,
    "class": "3A"
  },
  "missing_fields": []
}
```

**Follow-up Request (User confirms):**
```json
{
  "task_id": "task_8a7d1b",
  "message": "yes"
}
```

**Response (Simulated Confirmation):**
```json
{
  "task_id": "task_8a7d1b",
  "status": "confirmed",
  "next_action": "booking_ready",
  "message": "Your request has been confirmed for the next booking step. Actual railway booking is not connected in Phase 2."
}
```

### 2. `POST /api/agent/reset`
Resets the session state for a given `task_id`.

---

## Phase 2 Test Verification (8/8 Scenarios)

1. **TEST 1 — Complete request**: Directly reaches `ready_for_confirmation` without asking redundant questions.
2. **TEST 2 — Missing source**: Prompted for departure station (`request_source`).
3. **TEST 3 — Multi-turn completion**: Follows through 3 turns until confirmation summary.
4. **TEST 4 — Short response interpretation**: Interprets `"3"` as `passengers = 3`, not station.
5. **TEST 5 — Class normalization**: Normalizes `"3AC"` to `"3A"` and `"sleeper"` to `"SL"`.
6. **TEST 6 — Confirmation**: Reaches `confirmed` and `booking_ready` (strictly simulated).
7. **TEST 7 — Cancellation**: `"cancel"` moves status to `cancelled`.
8. **TEST 8 — Multi-turn persistence**: Information gathered in earlier turns is safely preserved throughout the session.

---

## Scope & Boundary Confirmation

This implementation is strictly a **Phase 2 prototype**:
- **NO** actual tickets booked or IRCTC website connections.
- **NO** live train searches or schedules.
- **NO** payment gateways.
- **NO** browser automation or scraping.
- **NO** external database or user login.
