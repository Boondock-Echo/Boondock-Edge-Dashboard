import api from '../../utils/apiClient';

/**

 * GPIO Service - Interacts with the backend API which proxies to GPIO service

 * 

 * IMPORTANT: All GPIO API calls go through the backend Flask server, NOT directly to the GPIO service.

 * The GPIO service (running on localhost:8000) is only accessible locally on the device.

 * The backend server (Flask) acts as a proxy, forwarding requests from the web interface

 * to the local GPIO service. This allows remote access to GPIO functionality.

 * 

 * Flow: Web Interface → Backend Flask Server → Local GPIO Service (localhost:8000)

 */


/**

 * LED Pattern Types (2025 Best Practice)

 */

export const LED_PATTERNS = {

  // New state-based patterns (2025 best practice)

  REGULAR_BLINK: 'regular_blink',        // 1 Hz - Starting

  VERY_FAST_BLINK: 'very_fast_blink',    // 5 Hz - Receiving audio

  FAST_BLINK: 'fast_blink',              // 2-3 Hz - Uploading/processing

  SOLID_ON: 'solid_on',                  // Solid ON - Normal/healthy

  VERY_SLOW_BLINK: 'very_slow_blink',    // 0.5-0.6 Hz - Critical error/crashed

  SHUTDOWN: 'shutdown',                  // 3 quick blinks → permanently OFF

  

  // Legacy patterns (backward compatibility)

  STARTUP: 'startup',

  FAST: 'fast',

  MEDIUM: 'medium',

  SLOW: 'slow',

  PULSE: 'pulse',

  TWO: 'two',

  THREE: 'three',

  ON: 'on',

  OFF: 'off',

};



/**

 * LED Control Functions

 */

export const gpioService = {

  /**

   * Get current LED pattern

   */

  async getPattern() {

    try {

      const response = await api.get('/gpio/pattern');

      return response.data;

    } catch (error) {

      console.error('Error getting LED pattern:', error);

      throw error;

    }

  },



  /**

   * Set LED pattern

   * @param {string} pattern - Pattern name (startup, fast, medium, slow, pulse, two, three, on, off)

   */

  async setPattern(pattern) {

    try {

      const response = await api.post(`/gpio/pattern/${pattern}`);

      return response.data;

    } catch (error) {

      // Re-throw error for caller to handle (LEDStatusManager will catch it)

      throw error;

    }

  },



  /**

   * Stop LED activity

   */

  async stopLED() {

    try {

      const response = await api.post('/gpio/stop');

      return response.data;

    } catch (error) {

      // Re-throw error for caller to handle (LEDStatusManager will catch it)

      throw error;

    }

  },



  /**

   * Get LED GPIO pin

   */

  async getLEDGPIO() {

    try {

      const response = await api.get('/gpio/led/gpio');

      return response.data;

    } catch (error) {

      console.error('Error getting LED GPIO:', error);

      throw error;

    }

  },



  /**

   * Set LED GPIO pin

   * @param {number} gpio - GPIO pin number (1-40)

   */

  async setLEDGPIO(gpio) {

    try {

      const response = await api.post(`/gpio/led/gpio/${gpio}`);

      return response.data;

    } catch (error) {

      console.error('Error setting LED GPIO:', error);

      throw error;

    }

  },



  /**

   * Get LED enabled status

   */

  async getLEDEnabled() {

    try {

      const response = await api.get('/gpio/led/enabled');

      return response.data;

    } catch (error) {

      console.error('Error getting LED enabled status:', error);

      throw error;

    }

  },



  /**

   * Get LED mode (source or sink)

   */

  async getLEDMode() {

    try {

      const response = await api.get('/gpio/led/mode');

      return response.data.mode;

    } catch (error) {

      console.error('Error getting LED mode:', error);

      throw error;

    }

  },



  /**

   * Set LED mode

   * @param {'source'|'sink'} mode

   */

  async setLEDMode(mode) {

    try {

      const response = await api.post(`/gpio/led/mode/${mode}`);

      return response.data;

    } catch (error) {

      console.error('Error setting LED mode:', error);

      throw error;

    }

  },



  /**

   * Set LED enabled status

   * @param {boolean} enabled - Enable or disable LED

   */

  async setLEDEnabled(enabled) {

    try {

      const response = await api.post(`/gpio/led/enabled/${enabled}`);

      return response.data;

    } catch (error) {

      console.error('Error setting LED enabled status:', error);

      throw error;

    }

  },



  /**

   * Relay Management Functions

   */



  /**

   * Get all relays

   */

  async getAllRelays() {

    try {

      const response = await api.get('/gpio/relays');

      return response.data.relays || {};

    } catch (error) {

      console.error('Error getting relays:', error);

      throw error;

    }

  },



  /**

   * Get a specific relay

   * @param {string} name - Relay name

   */

  async getRelay(name) {

    try {

      const response = await api.get(`/gpio/relays/${name}`);

      return response.data.relay;

    } catch (error) {

      console.error('Error getting relay:', error);

      throw error;

    }

  },



  /**

   * Add a new relay

   * @param {string} name - Relay name

   * @param {number} gpio - GPIO pin number (1-40)

   * @param {string} normalState - Normal state: 'on' or 'off' (default: 'off')

   */

  async addRelay(name, gpio, normalState = 'off') {

    try {

      const response = await api.post('/gpio/relays', { name, gpio, normal_state: normalState });

      return response.data;

    } catch (error) {

      console.error('Error adding relay:', error);

      throw error;

    }

  },



  /**

   * Remove a relay

   * @param {string} name - Relay name

   */

  async removeRelay(name) {

    try {

      const response = await api.delete(`/gpio/relays/${name}`);

      return response.data;

    } catch (error) {

      console.error('Error removing relay:', error);

      throw error;

    }

  },



  /**

   * Control a relay

   * @param {string} name - Relay name

   * @param {string} action - Action: 'on', 'off', or 'toggle'

   */

  async controlRelay(name, action) {

    try {

      const response = await api.post(`/gpio/relays/${name}/${action}`);

      return response.data;

    } catch (error) {

      console.error('Error controlling relay:', error);

      throw error;

    }

  },



  /**

   * Get relay normal state

   * @param {string} name - Relay name

   */

  async getRelayNormalState(name) {

    try {

      const response = await api.get(`/gpio/relays/${name}/normal_state`);

      return response.data.normal_state;

    } catch (error) {

      console.error('Error getting relay normal state:', error);

      throw error;

    }

  },



  /**

   * Set relay normal state

   * @param {string} name - Relay name

   * @param {string} normalState - Normal state: 'on' or 'off'

   */

  async setRelayNormalState(name, normalState) {

    try {

      const response = await api.post(`/gpio/relays/${name}/normal_state/${normalState}`);

      return response.data;

    } catch (error) {

      console.error('Error setting relay normal state:', error);

      throw error;

    }

  },



  /**

   * Update relay GPIO pin

   * @param {string} name - Relay name

   * @param {number} gpio - New GPIO pin number (1-40)

   */

  async updateRelayGPIO(name, gpio) {

    try {

      const response = await api.post(`/gpio/relays/${name}/gpio/${gpio}`);

      return response.data;

    } catch (error) {

      console.error('Error updating relay GPIO:', error);

      throw error;

    }

  },

};



/**

 * LED Status Manager - Manages LED status based on app activity

 * Includes resilient error handling with cooldown periods

 */

class LEDStatusManager {

  constructor() {

    this.enabled = false;

    this.currentPattern = null;

    this.statusQueue = [];

    this.isProcessing = false;

    

    // API health tracking

    this.apiBroken = false;

    this.apiBrokenUntil = null;

    this.COOLDOWN_PERIOD = 5 * 60 * 1000; // 5 minutes in milliseconds

    this.retryInterval = null;

    this.healthCheckInterval = null;

  }



  /**

   * Initialize the LED status manager

   */

  init(enabled, apiUrl) {

    // apiUrl parameter is kept for compatibility but not used

    // All calls now go through backend API

    this.enabled = enabled;

    

    // Start health check interval if enabled

    if (enabled) {

      this.startHealthCheck();

    } else {

      this.stopHealthCheck();

    }

  }



  /**

   * Check if API is currently available (not broken or cooldown expired)

   */

  isApiAvailable() {

    if (!this.apiBroken) {

      return true;

    }

    

    // Check if cooldown period has expired

    if (this.apiBrokenUntil && Date.now() >= this.apiBrokenUntil) {

      // Cooldown expired, try again

      this.apiBroken = false;

      this.apiBrokenUntil = null;

      return true;

    }

    

    return false;

  }



  /**

   * Mark API as broken and set cooldown period

   */

  markApiBroken() {

    if (!this.apiBroken) {

      console.warn('[GPIO Service] API marked as broken. Will retry in 5 minutes.');

      this.apiBroken = true;

      this.apiBrokenUntil = Date.now() + this.COOLDOWN_PERIOD;

    }

  }



  /**

   * Mark API as healthy

   */

  markApiHealthy() {

    if (this.apiBroken) {

      console.info('[GPIO Service] API is healthy again.');

      this.apiBroken = false;

      this.apiBrokenUntil = null;

    }

  }



  /**

   * Start periodic health check

   */

  startHealthCheck() {

    // Clear existing interval if any

    this.stopHealthCheck();

    

    // Check health every minute

    this.healthCheckInterval = setInterval(() => {

      this.checkApiHealth();

    }, 60 * 1000); // 1 minute

    

    // Initial health check

    this.checkApiHealth();

  }



  /**

   * Stop periodic health check

   */

  stopHealthCheck() {

    if (this.healthCheckInterval) {

      clearInterval(this.healthCheckInterval);

      this.healthCheckInterval = null;

    }

  }



  /**

   * Check API health by attempting a simple request

   */

  async checkApiHealth() {

    // Only check if API is currently marked as broken

    if (!this.apiBroken) {

      return;

    }

    

    // Don't check if still in cooldown

    if (this.apiBrokenUntil && Date.now() < this.apiBrokenUntil) {

      return;

    }

    

    try {

      // Try a simple GET request to check if API is alive

      await gpioService.getPattern();

      // If successful, mark as healthy

      this.markApiHealthy();

    } catch (error) {

      // API still broken, extend cooldown

      this.markApiBroken();

    }

  }



  /**

   * Check if LED status indicators are enabled

   */

  isEnabled() {

    return this.enabled;

  }



  /**

   * Get API health status

   * @returns {object} Status object with broken flag and time until retry

   */

  getApiHealthStatus() {

    return {

      broken: this.apiBroken,

      retryAt: this.apiBrokenUntil,

      timeUntilRetry: this.apiBrokenUntil ? Math.max(0, this.apiBrokenUntil - Date.now()) : 0,

    };

  }



  /**

   * Set LED status based on app activity

   * @param {string} activity - Activity type

   */

  async setStatus(activity) {

    if (!this.enabled) {

      return;

    }



    // Don't attempt API calls if API is broken and in cooldown

    if (!this.isApiAvailable()) {

      // Silently fail - don't log or throw errors

      return;

    }



    // Map activities to LED patterns

    const activityMap = {

      'startup': LED_PATTERNS.STARTUP,

      'recording': LED_PATTERNS.FAST,

      'transcribing': LED_PATTERNS.MEDIUM,

      'idle': LED_PATTERNS.SLOW,

      'error': LED_PATTERNS.PULSE,

      'message_received': LED_PATTERNS.TWO,

      'alert': LED_PATTERNS.THREE,

      'active': LED_PATTERNS.ON,

      'offline': LED_PATTERNS.OFF,

    };



    const pattern = activityMap[activity] || LED_PATTERNS.SLOW;



    // Don't update if same pattern

    if (this.currentPattern === pattern) {

      return;

    }



    this.currentPattern = pattern;



    try {

      await gpioService.setPattern(pattern);

      // If successful, ensure API is marked as healthy

      this.markApiHealthy();

    } catch (error) {

      // Silently handle error - mark API as broken and don't throw

      this.markApiBroken();

      // Don't log error to avoid console spam

    }

  }



  /**

   * Stop LED activity

   */

  async stop() {

    // Don't attempt API calls if API is broken and in cooldown

    if (!this.isApiAvailable()) {

      return;

    }



    try {

      await gpioService.stopLED();

      this.currentPattern = null;

      // If successful, ensure API is marked as healthy

      this.markApiHealthy();

    } catch (error) {

      // Silently handle error - mark API as broken and don't throw

      this.markApiBroken();

      // Don't log error to avoid console spam

    }

  }

}



// Export singleton instance

export const ledStatusManager = new LEDStatusManager();



export default gpioService;


