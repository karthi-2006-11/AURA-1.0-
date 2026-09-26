# AURA — Autonomous User Request Agent
## Phase 1: Foundation & Natural-Language Understanding

A railway-focused autonomous user request agent prototype. Phase 1 demonstrates how natural-language railway travel requests are ingested, parsed into structured intent and entity data, normalized, validated, and translated into a human-friendly response.

---

## Architecture Flow

```text
User Input (Natural Language)
    │
    ▼
Frontend (HTML / CSS / Vanilla JS)
    │  (POST /api/analyze)
    ▼
Node.js + Express Server (backend/server.js)
    │
    ▼
API Route (backend/routes/analyze.js)
    │
    ▼
AURA Parser Service (backend/services/auraParser.js)
    ├── 1. Intent Detection ('train_booking' | 'unknown')
    ├── 2. Entity Extraction & Normalization
    │       ├── Stations (source, destination)
    │       ├── Date (today, tomorrow, day after tomorrow, explicit dates)
    │       ├── Time Preference (morning, afternoon, evening, night)
    │       ├── Passengers (word numbers & digits)
    │       └── Class (1A, 2A, 3A, SL, CC, EC, 2S)
    ├── 3. Validation (checks required: source, destination, date)
    └── 4. Human-Readable Interpretation Generation
    │
    ▼
Structured JSON Response
    │
    ▼
Interactive UI Display (Summary + Entity Grid + Raw JSON)
```

---

## Project Structure

```text
D:\AURA\
├── backend/
│   ├── server.js              # Express server & static asset host
│   ├── routes/
│   │   └── analyze.js         # POST /api/analyze router
│   └── services/
│       └── auraParser.js      # Core deterministic NLU parser
├── frontend/
│   ├── index.html             # Clean prototype interface
│   ├── style.css              # Responsive styling (no heavy frameworks)
│   └── script.js              # Vanilla JS client logic
├── tests/
│   ├── parser.test.js         # Automated test cases
│   └── server.test.js         # HTTP API integration test
├── package.json               # Dependencies and npm scripts
├── .gitignore                 # Protected files list
└── README.md                  # Documentation & usage guide
```

---

## How to Run the Project

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Tests
To verify all test cases including edge cases:
```bash
npm test
```

### 3. Start the Server
```bash
npm start
```
By default, the server runs at:
```
http://localhost:3000
```
Open `http://localhost:3000` in any web browser.

---

## Scope & Boundary

This prototype strictly implements Phase 1: Foundation and NLU.
