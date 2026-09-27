/**
 * AURA - Autonomous User Request Agent
 * Phase 4: Railway Provider Configuration
 *
 * Configures the active railway service provider.
 * Defaults to 'mock' provider.
 *
 * NOTE: No credentials, API keys, or private tokens are stored here.
 * Future authorized provider arrangements will inject credentials via
 * environment variables without modifying application logic.
 */

module.exports = {
  provider: process.env.RAILWAY_PROVIDER || 'mock'
};
