/**
 * AURA - Autonomous User Request Agent
 * Phase 4: Railway Provider Base Abstraction
 *
 * Defines the common contract expected from any railway service provider.
 * Keeps AURA's agent logic decoupled from specific provider implementations.
 */

class RailwayProvider {
  /**
   * Search for trains matching journey criteria
   * @param {Object} criteria - { source, destination, date, class, passengers }
   * @returns {Promise<Array>} List of available train options
   */
  async searchTrains(criteria) {
    throw new Error('searchTrains() must be implemented by the provider subclass.');
  }

  /**
   * Fetch detailed train information by train number
   * @param {string} trainNumber
   * @returns {Promise<Object>}
   */
  async getTrainDetails(trainNumber) {
    throw new Error('getTrainDetails() must be implemented by the provider subclass.');
  }

  /**
   * Check seat availability for a specific train and class
   * @param {Object} query - { train_number, class, date, passengers }
   * @returns {Promise<Object>} { availability, seats, provider, mock }
   */
  async checkAvailability(query) {
    throw new Error('checkAvailability() must be implemented by the provider subclass.');
  }

  /**
   * Validates and prepares booking parameters
   * @param {Object} bookingTask
   * @returns {Promise<Object>}
   */
  async prepareBooking(bookingTask) {
    throw new Error('prepareBooking() must be implemented by the provider subclass.');
  }

  /**
   * Executes booking request
   * @param {Object} bookingTask
   * @returns {Promise<Object>} Booking confirmation payload
   */
  async book(bookingTask) {
    throw new Error('book() must be implemented by the provider subclass.');
  }
}

module.exports = RailwayProvider;
