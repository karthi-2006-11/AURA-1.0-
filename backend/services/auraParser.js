/**
 * AURA - Autonomous User Request Agent
 * Phase 1: Natural Language Understanding Service
 *
 * This service implements a deterministic rule-based and pattern-matching
 * parser to extract railway booking intents and entities from natural language.
 */

// Mapping of number words to integer values for passenger extraction
const NUMBER_WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10
};

// Recognized railway travel classes and their normalized codes
const CLASS_PATTERNS = [
  { pattern: /\b(1st\s*ac|first\s*ac|1\s*ac|1a)\b/i, code: '1A' },
  { pattern: /\b(2nd\s*ac|second\s*ac|2\s*ac|2a|2\s*tier|two\s*tier)\b/i, code: '2A' },
  { pattern: /\b(3rd\s*ac|third\s*ac|3\s*ac|3ac|3a|3\s*tier|three\s*tier)\b/i, code: '3A' },
  { pattern: /\b(executive\s*chair\s*car|executive\s*class|ec)\b/i, code: 'EC' },
  { pattern: /\b(chair\s*car|ac\s*chair\s*car|cc)\b/i, code: 'CC' },
  { pattern: /\b(sleeper\s*class|sleeper|sl)\b/i, code: 'SL' },
  { pattern: /\b(second\s*seating|second\s*sitting|2nd\s*seating|2nd\s*sitting|2s)\b/i, code: '2S' }
];

// Stop-words used to terminate station name capture
const STATION_DELIMITERS = [
  'tomorrow',
  'today',
  'day after tomorrow',
  'yesterday',
  'morning',
  'afternoon',
  'evening',
  'night',
  'for',
  'in',
  'on',
  'at',
  'with',
  'by',
  'class',
  'sleeper',
  'ac',
  'adults',
  'people',
  'passengers'
];

/**
 * Capitalizes the first letter of each word in a station/city name.
 * e.g., "chennai" -> "Chennai", "new delhi" -> "New Delhi"
 */
function formatStationName(name) {
  if (!name) return null;
  const cleaned = name
    .trim()
    .replace(/^[,.\s]+|[,.\s]+$/g, '')
    .replace(/\s+/g, ' ');

  if (!cleaned) return null;

  return cleaned
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Trims known trailing noise or delimiters from extracted station strings.
 */
function cleanStationCandidate(rawText) {
  if (!rawText) return null;
  let text = rawText.trim();

  // Stop at punctuation
  const punctMatch = text.split(/[.,!?]/)[0];
  text = punctMatch.trim();

  // Stop if a delimiter word is encountered
  const words = text.split(/\s+/);
  const cleanWords = [];
  for (const word of words) {
    const lower = word.toLowerCase();
    if (STATION_DELIMITERS.includes(lower) || /^\d+$/.test(word)) {
      break;
    }
    cleanWords.push(word);
  }

  if (cleanWords.length === 0) return null;
  return formatStationName(cleanWords.join(' '));
}

/**
 * STEP 4 — INTENT DETECTION
 * Detects whether the user request is a railway booking request.
 */
function detectIntent(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return 'unknown';
  }

  const clean = text.toLowerCase().trim();

  // Railway booking action & keyword combinations
  const bookingKeywords = [
    /\b(book|reserve|find|need|want|get|search)\b.*\b(train|ticket|seats?|berth)\b/i,
    /\b(travel|go|journey)\b.*\b(from|to)\b/i,
    /\b(train|railway)\b.*\b(from|to|between)\b/i,
    /\b(sleeper|ac)\s+train\b/i,
    /\btrain\s+ticket\b/i,
    /\b(ticket|tickets)\s+(from|to)\b/i,
    /\b(train\s+to|train\s+from)\b/i
  ];

  for (const regex of bookingKeywords) {
    if (regex.test(clean)) {
      return 'train_booking';
    }
  }

  return 'unknown';
}

/**
 * STEP 6 — SOURCE AND DESTINATION EXTRACTION
 * Extracts origin and destination stations using positional pattern matching.
 */
function extractStations(text) {
  let source = null;
  let destination = null;

  if (!text || typeof text !== 'string') {
    return { source, destination };
  }

  // Pattern 1: "from [Source] to [Destination]"
  // e.g. "train from Chennai to Coimbatore tomorrow"
  const fromToMatch = text.match(/\bfrom\s+([a-zA-Z\s]+?)\s+to\s+([a-zA-Z\s]+?)(?=$|\s+(?:tomorrow|today|day after tomorrow|yesterday|morning|afternoon|evening|night|for|in|on|at|with|by|\d|[.,!?]))/i);
  if (fromToMatch) {
    source = cleanStationCandidate(fromToMatch[1]);
    destination = cleanStationCandidate(fromToMatch[2]);
    return { source, destination };
  }

  // Pattern 2: "to [Destination] from [Source]"
  // e.g. "train to Coimbatore from Chennai tomorrow"
  const toFromMatch = text.match(/\bto\s+([a-zA-Z\s]+?)\s+from\s+([a-zA-Z\s]+?)(?=$|\s+(?:tomorrow|today|day after tomorrow|yesterday|morning|afternoon|evening|night|for|in|on|at|with|by|\d|[.,!?]))/i);
  if (toFromMatch) {
    destination = cleanStationCandidate(toFromMatch[1]);
    source = cleanStationCandidate(toFromMatch[2]);
    return { source, destination };
  }

  // Pattern 3: Destination only: "to [Destination]"
  // e.g. "Book a train to Coimbatore tomorrow"
  const toOnlyMatch = text.match(/\bto\s+([a-zA-Z\s]+?)(?=$|\s+(?:tomorrow|today|day after tomorrow|yesterday|morning|afternoon|evening|night|for|in|on|at|with|by|\d|[.,!?]))/i);
  if (toOnlyMatch) {
    destination = cleanStationCandidate(toOnlyMatch[1]);
  }

  // Pattern 4: Source only: "from [Source]"
  // e.g. "Book a train from Chennai tomorrow"
  const fromOnlyMatch = text.match(/\bfrom\s+([a-zA-Z\s]+?)(?=$|\s+(?:to|tomorrow|today|day after tomorrow|yesterday|morning|afternoon|evening|night|for|in|on|at|with|by|\d|[.,!?]))/i);
  if (fromOnlyMatch) {
    source = cleanStationCandidate(fromOnlyMatch[1]);
  }

  return { source, destination };
}

/**
 * STEP 7 — DATE EXTRACTION
 * Supports natural language expressions ("today", "tomorrow", "day after tomorrow")
 * and standard explicit dates (e.g. "25th March", "2026-04-15", "15/04/2026").
 */
function extractDate(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.toLowerCase();

  // Natural language relative dates (check multi-word first)
  if (/\bday\s+after\s+tomorrow\b/i.test(clean)) {
    return 'day after tomorrow';
  }
  if (/\btomorrow\b/i.test(clean)) {
    return 'tomorrow';
  }
  if (/\btoday\b/i.test(clean)) {
    return 'today';
  }

  // Explicit date: "25th March", "15 April", "10 Dec 2026"
  const monthNames = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
  const verbalDateRegex = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames})(?:\\s+(\\d{4}))?\\b`, 'i');
  const verbalMatch = text.match(verbalDateRegex);
  if (verbalMatch) {
    return verbalMatch[0].trim();
  }

  // Explicit numerical date: DD/MM/YYYY or DD-MM-YYYY or YYYY-MM-DD
  const numericDateMatch = text.match(/\b\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\b/);
  if (numericDateMatch) {
    return numericDateMatch[0].trim();
  }

  return null;
}

/**
 * STEP 8 — TIME PREFERENCE EXTRACTION
 * Recognizes "morning", "afternoon", "evening", "night".
 */
function extractTimePreference(text) {
  if (!text || typeof text !== 'string') return null;

  const match = text.match(/\b(morning|afternoon|evening|night)\b/i);
  if (match) {
    return match[1].toLowerCase();
  }
  return null;
}

/**
 * STEP 9 — PASSENGER COUNT EXTRACTION
 * Normalizes phrases like "for 2 people", "2 passengers", "for two people", "for 3 adults" to integers.
 */
function extractPassengers(text) {
  if (!text || typeof text !== 'string') return null;

  // Pattern with descriptive keywords (people, passengers, adults, persons, seats, tickets)
  const countPattern = /\b(?:for\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:people|passengers?|adults?|persons?|seats?|tickets?)\b/i;
  const match = text.match(countPattern);

  if (match) {
    const rawVal = match[1].toLowerCase();
    if (NUMBER_WORDS[rawVal]) {
      return NUMBER_WORDS[rawVal];
    }
    const num = parseInt(rawVal, 10);
    return isNaN(num) || num <= 0 ? null : num;
  }

  // Pattern: "for 2" / "for two"
  const forCountPattern = /\bfor\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b(?!\s+(?:days?|hours?|trains?))/i;
  const forMatch = text.match(forCountPattern);
  if (forMatch) {
    const rawVal = forMatch[1].toLowerCase();
    if (NUMBER_WORDS[rawVal]) {
      return NUMBER_WORDS[rawVal];
    }
    const num = parseInt(rawVal, 10);
    return isNaN(num) || num <= 0 ? null : num;
  }

  return null;
}

/**
 * STEP 10 — RAILWAY CLASS EXTRACTION
 * Recognizes and normalizes railway class names to standard codes (1A, 2A, 3A, SL, CC, EC, 2S).
 */
function extractClass(text) {
  if (!text || typeof text !== 'string') return null;

  for (const item of CLASS_PATTERNS) {
    if (item.pattern.test(text)) {
      return item.code;
    }
  }

  return null;
}

/**
 * STEP 11 — VALIDATION
 * Required fields for train_booking are: source, destination, date.
 */
function validateRequest(intent, source, destination, date) {
  const missing_fields = [];

  if (intent !== 'train_booking') {
    return {
      valid: false,
      missing_fields: []
    };
  }

  if (!source) {
    missing_fields.push('source');
  }
  if (!destination) {
    missing_fields.push('destination');
  }
  if (!date) {
    missing_fields.push('date');
  }

  return {
    valid: missing_fields.length === 0,
    missing_fields
  };
}

/**
 * STEP 13 — HUMAN-READABLE INTERPRETATION GENERATOR
 * Creates clear, friendly summaries for the user interface.
 */
function generateHumanReadable(data) {
  if (data.intent === 'unknown') {
    return "I couldn't identify a railway booking request in your message. Please try asking like: 'Book a train from Chennai to Coimbatore tomorrow'.";
  }

  if (data.valid) {
    let summary = `You want to travel from ${data.source} to ${data.destination} ${data.date}`;
    if (data.time_preference) {
      summary += ` in the ${data.time_preference}`;
    }
    if (data.passengers) {
      summary += ` for ${data.passengers} ${data.passengers === 1 ? 'passenger' : 'passengers'}`;
    }
    if (data.class) {
      summary += ` in ${data.class}`;
    }
    summary += '.';
    return summary;
  }

  // Incomplete request
  const parts = [];
  if (data.source && data.destination) {
    parts.push(`travel from ${data.source} to ${data.destination}`);
  } else if (data.destination) {
    parts.push(`travel to ${data.destination}`);
  } else if (data.source) {
    parts.push(`travel from ${data.source}`);
  }

  if (data.date) {
    parts.push(`on ${data.date}`);
  }

  const missingLabels = data.missing_fields.map(field => {
    switch (field) {
      case 'source': return 'departure station (source)';
      case 'destination': return 'arrival station (destination)';
      case 'date': return 'travel date';
      default: return field;
    }
  });

  return `I understand you want to ${parts.length > 0 ? parts.join(' ') : 'book a train'}, but I still need: ${missingLabels.join(', ')}.`;
}

/**
 * MAIN PARSER PIPELINE
 * Combines intent detection, entity extraction, normalization, and validation.
 */
function analyzeRequest(message) {
  // Handle empty or invalid inputs gracefully
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return {
      intent: 'unknown',
      source: null,
      destination: null,
      date: null,
      time_preference: null,
      passengers: null,
      class: null,
      missing_fields: [],
      valid: false,
      human_readable: "Please enter a railway booking request."
    };
  }

  const trimmedMessage = message.trim();

  // 1. Detect Intent
  const intent = detectIntent(trimmedMessage);

  if (intent === 'unknown') {
    return {
      intent: 'unknown',
      source: null,
      destination: null,
      date: null,
      time_preference: null,
      passengers: null,
      class: null,
      missing_fields: [],
      valid: false,
      human_readable: generateHumanReadable({ intent: 'unknown' })
    };
  }

  // 2. Extract Entities
  const { source, destination } = extractStations(trimmedMessage);
  const date = extractDate(trimmedMessage);
  const time_preference = extractTimePreference(trimmedMessage);
  const passengers = extractPassengers(trimmedMessage);
  const classValue = extractClass(trimmedMessage);

  // 3. Validate
  const validation = validateRequest(intent, source, destination, date);

  const result = {
    intent,
    source,
    destination,
    date,
    time_preference,
    passengers,
    class: classValue,
    missing_fields: validation.missing_fields,
    valid: validation.valid
  };

  // 4. Attach human-readable interpretation
  result.human_readable = generateHumanReadable(result);

  return result;
}

module.exports = {
  detectIntent,
  extractStations,
  extractDate,
  extractTimePreference,
  extractPassengers,
  extractClass,
  validateRequest,
  generateHumanReadable,
  analyzeRequest
};
