/**
 * AURA - Autonomous User Request Agent
 * Phase 4: Mock Railway Provider
 *
 * Implements the RailwayProvider interface with realistic deterministic sample data.
 *
 * IMPORTANT:
 * - This is a MOCK provider for prototype workflow verification.
 * - It does NOT connect to IRCTC or any live railway reservation system.
 * - Every result explicitly labels itself as mock data.
 * - References use the identifiable format: AURA-MOCK-XXXXXX.
 */

const crypto = require('crypto');
const RailwayProvider = require('./railwayProvider');
const railwayConfig = require('../config/railway');

// Standard fares per class in INR (sample realistic values)
const CLASS_BASE_FARES = {
  '1A': 2200,
  '2A': 1350,
  '3A': 850,
  'CC': 580,
  'EC': 1400,
  'SL': 320,
  '2S': 160
};

// Known route schedules with realistic train data
const MOCK_SCHEDULE_DATABASE = [
  // Chennai -> Coimbatore
  {
    train_number: '12673',
    train_name: 'Cheran Express',
    source: 'Chennai',
    destination: 'Coimbatore',
    departure: '22:15',
    arrival: '06:00',
    duration: '07h 45m',
    classes: ['1A', '2A', '3A', 'SL'],
    seats: { '1A': 6, '2A': 18, '3A': 42, 'SL': 118 }
  },
  {
    train_number: '12675',
    train_name: 'Kovai Express',
    source: 'Chennai',
    destination: 'Coimbatore',
    departure: '14:15',
    arrival: '20:55',
    duration: '06h 40m',
    classes: ['CC', '2S', '3A'],
    seats: { 'CC': 64, '2S': 180, '3A': 28 }
  },
  {
    train_number: '20643',
    train_name: 'Coimbatore Vande Bharat',
    source: 'Chennai',
    destination: 'Coimbatore',
    departure: '14:25',
    arrival: '20:15',
    duration: '05h 50m',
    classes: ['CC', 'EC'],
    seats: { 'CC': 78, 'EC': 14 }
  },

  // Coimbatore -> Chennai
  {
    train_number: '12674',
    train_name: 'Cheran Express',
    source: 'Coimbatore',
    destination: 'Chennai',
    departure: '22:50',
    arrival: '07:00',
    duration: '08h 10m',
    classes: ['1A', '2A', '3A', 'SL'],
    seats: { '1A': 8, '2A': 22, '3A': 54, 'SL': 140 }
  },
  {
    train_number: '12676',
    train_name: 'Kovai Express',
    source: 'Coimbatore',
    destination: 'Chennai',
    departure: '15:15',
    arrival: '22:50',
    duration: '07h 35m',
    classes: ['CC', '2S', '3A'],
    seats: { 'CC': 52, '2S': 160, '3A': 32 }
  },

  // Chennai -> Bangalore
  {
    train_number: '12007',
    train_name: 'Mysuru Shatabdi Express',
    source: 'Chennai',
    destination: 'Bangalore',
    departure: '06:00',
    arrival: '10:55',
    duration: '04h 55m',
    classes: ['CC', 'EC'],
    seats: { 'CC': 86, 'EC': 16 }
  },
  {
    train_number: '12607',
    train_name: 'Lalbagh SF Express',
    source: 'Chennai',
    destination: 'Bangalore',
    departure: '15:30',
    arrival: '21:35',
    duration: '06h 05m',
    classes: ['CC', '2S'],
    seats: { 'CC': 48, '2S': 195 }
  },
  {
    train_number: '12657',
    train_name: 'Chennai - Bengaluru Mail',
    source: 'Chennai',
    destination: 'Bangalore',
    departure: '22:50',
    arrival: '04:30',
    duration: '05h 40m',
    classes: ['1A', '2A', '3A', 'SL'],
    seats: { '1A': 10, '2A': 26, '3A': 62, 'SL': 155 }
  },

  // Bangalore -> Chennai
  {
    train_number: '12608',
    train_name: 'Lalbagh SF Express',
    source: 'Bangalore',
    destination: 'Chennai',
    departure: '06:20',
    arrival: '12:20',
    duration: '06h 00m',
    classes: ['CC', '2S'],
    seats: { 'CC': 55, '2S': 180 }
  },
  {
    train_number: '12658',
    train_name: 'Bengaluru - Chennai Mail',
    source: 'Bangalore',
    destination: 'Chennai',
    departure: '22:40',
    arrival: '04:20',
    duration: '05h 40m',
    classes: ['1A', '2A', '3A', 'SL'],
    seats: { '1A': 8, '2A': 20, '3A': 48, 'SL': 130 }
  },

  // Madurai -> Chennai
  {
    train_number: '12638',
    train_name: 'Pandian SF Express',
    source: 'Madurai',
    destination: 'Chennai',
    departure: '21:35',
    arrival: '05:15',
    duration: '07h 40m',
    classes: ['1A', '2A', '3A', 'SL'],
    seats: { '1A': 12, '2A': 30, '3A': 68, 'SL': 175 }
  },
  {
    train_number: '12636',
    train_name: 'Vaigai SF Express',
    source: 'Madurai',
    destination: 'Chennai',
    departure: '07:10',
    arrival: '14:30',
    duration: '07h 20m',
    classes: ['CC', '2S'],
    seats: { 'CC': 72, '2S': 240 }
  },

  // Salem -> Chennai
  {
    train_number: '22650',
    train_name: 'Yercaud SF Express',
    source: 'Salem',
    destination: 'Chennai',
    departure: '21:00',
    arrival: '04:15',
    duration: '07h 15m',
    classes: ['2A', '3A', 'SL'],
    seats: { '2A': 16, '3A': 38, 'SL': 120 }
  }
];

class MockRailwayProvider extends RailwayProvider {
  constructor() {
    super();
    this.name = 'MockRailwayProvider';
  }

  /**
   * Search for trains matching the query criteria (synchronous implementation)
   */
  searchTrainsSync(criteria) {
    const { source, destination, date, class: travelClass } = criteria || {};

    if (!source || !destination || !date) {
      throw new Error('source, destination, and date are required for train search.');
    }

    const srcNorm = source.trim().toLowerCase();
    const destNorm = destination.trim().toLowerCase();

    // 1. Look up in predefined database
    let matches = MOCK_SCHEDULE_DATABASE.filter(t =>
      t.source.toLowerCase() === srcNorm &&
      t.destination.toLowerCase() === destNorm
    );

    // 2. Fallback: If not in predefined database, generate realistic deterministic mock trains
    if (matches.length === 0) {
      matches = [
        {
          train_number: '12901',
          train_name: `${formatCity(source)} Express`,
          source: formatCity(source),
          destination: formatCity(destination),
          departure: '08:30',
          arrival: '16:45',
          duration: '08h 15m',
          classes: ['1A', '2A', '3A', 'SL'],
          seats: { '1A': 8, '2A': 20, '3A': 48, 'SL': 110 }
        },
        {
          train_number: '12903',
          train_name: `${formatCity(destination)} Superfast`,
          source: formatCity(source),
          destination: formatCity(destination),
          departure: '21:00',
          arrival: '06:30',
          duration: '09h 30m',
          classes: ['2A', '3A', 'SL', '2S'],
          seats: { '2A': 14, '3A': 36, 'SL': 95, '2S': 140 }
        }
      ];
    }

    // Map each train to include requested class details, fare, and mock tags
    return matches.map(t => {
      const preferredClass = travelClass && t.classes.includes(travelClass)
        ? travelClass
        : (t.classes.includes('3A') ? '3A' : t.classes[0]);

      const availableSeats = t.seats[preferredClass] || 25;
      const baseFare = CLASS_BASE_FARES[preferredClass] || 500;

      return {
        train_number: t.train_number,
        train_name: t.train_name,
        source: t.source,
        destination: t.destination,
        date,
        departure: t.departure,
        arrival: t.arrival,
        duration: t.duration,
        class: preferredClass,
        available_classes: [...t.classes],
        availability: availableSeats > 0 ? 'AVAILABLE' : 'WL',
        seats: availableSeats,
        fare: baseFare,
        provider: 'mock',
        mock: true,
        disclaimer: 'MOCK RAILWAY PROVIDER — Simulation only, no real railway ticket is booked.'
      };
    });
  }

  async searchTrains(criteria) {
    return this.searchTrainsSync(criteria);
  }

  /**
   * Retrieves single train details
   */
  getTrainDetailsSync(trainNumber) {
    if (!trainNumber) throw new Error('trainNumber is required.');
    const match = MOCK_SCHEDULE_DATABASE.find(t => t.train_number === String(trainNumber));
    if (match) {
      return { ...match, provider: 'mock', mock: true };
    }
    return {
      train_number: String(trainNumber),
      train_name: 'Express Special',
      provider: 'mock',
      mock: true
    };
  }

  async getTrainDetails(trainNumber) {
    return this.getTrainDetailsSync(trainNumber);
  }

  /**
   * Checks availability for train and class
   */
  checkAvailabilitySync(query) {
    const { train_number, class: travelClass } = query || {};
    if (!train_number) throw new Error('train_number is required to check availability.');

    const train = this.getTrainDetailsSync(train_number);
    const cls = travelClass || '3A';
    const seats = train.seats && train.seats[cls] !== undefined ? train.seats[cls] : 38;

    return {
      success: true,
      train_number: String(train_number),
      class: cls,
      availability: seats > 0 ? 'AVAILABLE' : 'WL',
      seats,
      provider: 'mock',
      mock: true,
      timestamp: new Date().toISOString(),
      disclaimer: 'MOCK RAILWAY PROVIDER — Simulation only, no real railway ticket is booked.'
    };
  }

  async checkAvailability(query) {
    return this.checkAvailabilitySync(query);
  }

  /**
   * Prepares and validates booking task parameters
   */
  prepareBookingSync(bookingTask) {
    if (!bookingTask || !bookingTask.booking) {
      throw new Error('Valid bookingTask is required.');
    }
    const b = bookingTask.booking;
    if (!b.source || !b.destination || !b.date) {
      throw new Error('source, destination, and date are required to prepare booking.');
    }
    if (!bookingTask.selected_train) {
      throw new Error('A train must be selected before preparing booking.');
    }

    const train = bookingTask.selected_train;
    const passengers = b.passengers || 1;
    const baseFare = train.fare || (CLASS_BASE_FARES[train.class] || 500);
    const totalFare = baseFare * passengers;

    return {
      valid: true,
      train_number: train.train_number,
      train_name: train.train_name,
      source: train.source,
      destination: train.destination,
      date: b.date,
      class: train.class,
      passengers,
      total_fare: totalFare,
      provider: 'mock',
      mock: true
    };
  }

  async prepareBooking(bookingTask) {
    return this.prepareBookingSync(bookingTask);
  }

  /**
   * Executes simulated mock booking
   */
  bookSync(bookingTask) {
    const prep = this.prepareBookingSync(bookingTask);

    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const mockRef = `AURA-MOCK-${randomSuffix}`;

    return {
      success: true,
      provider: 'mock',
      mock: true,
      booking_reference: mockRef,
      status: 'CONFIRMED',
      train_number: prep.train_number,
      train_name: prep.train_name,
      source: prep.source,
      destination: prep.destination,
      date: prep.date,
      class: prep.class,
      passengers: prep.passengers,
      total_fare: prep.total_fare,
      booked_at: new Date().toISOString(),
      disclaimer: 'MOCK RAILWAY PROVIDER — Simulation only, no real railway ticket is booked.'
    };
  }

  async book(bookingTask) {
    return this.bookSync(bookingTask);
  }
}

function formatCity(city) {
  if (!city) return 'Station';
  return city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
}

// Factory function to obtain the active provider
let providerInstance = null;
function getProvider() {
  if (!providerInstance) {
    if (railwayConfig.provider === 'mock') {
      providerInstance = new MockRailwayProvider();
    } else {
      providerInstance = new MockRailwayProvider();
    }
  }
  return providerInstance;
}

module.exports = {
  MockRailwayProvider,
  getProvider
};
