import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import buttonStyles from '../ui/Button.module.css';
import { useState, useEffect, useCallback } from 'react';
import { Network, Lightbulb, Power, Plus, Trash2, RefreshCw, AlertCircle, CheckCircle2, Play,
  Square, Edit2, X, Check } from 'lucide-react';
import { gpioService, LED_PATTERNS } from '../services/gpioService';
import { toast } from 'react-toastify';
import SettingsSectionHeader from './SettingsSectionHeader';

const Interfaces = ({ }) => {
  // Configuration state
  const [ledEnabled, setLedEnabled] = useState(() => {
    const stored = localStorage.getItem('ledStatusIndicatorsEnabled');
    return stored === 'true';
  });
  
  // Relay state
  const [relays, setRelays] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('unknown'); // 'connected', 'disconnected', 'unknown'
  const [ledGPIO, setLedGPIO] = useState(null);
  const [ledMode, setLedMode] = useState('source'); // 'source' or 'sink'
  
  // New relay form
  const [showAddRelay, setShowAddRelay] = useState(false);
  const [newRelayName, setNewRelayName] = useState('');
  const [newRelayGPIO, setNewRelayGPIO] = useState('');
  const [newRelayNormalState, setNewRelayNormalState] = useState('off');
  
  // Edit relay state
  const [editingRelay, setEditingRelay] = useState(null); // {name, gpio}

  // Save LED enabled state
  useEffect(() => {
    localStorage.setItem('ledStatusIndicatorsEnabled', ledEnabled.toString());
  }, [ledEnabled]);

  // Test connection and load relays
  const testConnection = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Test connection by getting LED pattern through backend
      await gpioService.getPattern();
      setConnectionStatus('connected');
      // Load LED GPIO and mode
      try {
        const gpioInfo = await gpioService.getLEDGPIO();
        if (gpioInfo && typeof gpioInfo.gpio === 'number') {
          setLedGPIO(gpioInfo.gpio);
        }
      } catch (e) {
        console.error('Error loading LED GPIO:', e);
      }
      try {
        const mode = await gpioService.getLEDMode();
        if (mode === 'source' || mode === 'sink') {
          setLedMode(mode);
        }
      } catch (e) {
        console.error('Error loading LED mode:', e);
      }
      await loadRelays();
      // Success - no message needed, connection status indicator will show it
    } catch (err) {
      setConnectionStatus('disconnected');
      
      // Provide more detailed error message
      let errorMessage = 'Unable to connect to GPIO service. ';
      if (err.response?.status === 503) {
        errorMessage += 'GPIO service is not available. Please check if the GPIO service is running on the server.';
      } else if (err.response?.status === 504) {
        errorMessage += 'GPIO service request timed out.';
      } else if (err.response) {
        errorMessage += `Server responded with status ${err.response.status}.`;
        if (err.response.data?.error) {
          errorMessage += ` ${err.response.data.error}`;
        }
      } else {
        errorMessage += 'Please check if the backend server is running and can reach the GPIO service.';
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Connection test failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load relays from API
  const loadRelays = useCallback(async () => {
    try {
      const relaysData = await gpioService.getAllRelays();
      setRelays(relaysData);
      setError(null);
    } catch (err) {
      console.error('Error loading relays:', err);
      setError('Failed to load relays');
    }
  }, []);

  // Initial load - always test connection so existing relays/LED config are visible
  useEffect(() => {
    testConnection();
  }, []); // Only run once on mount

  // Note: API URL is now configured on the backend via GPIO_SERVICE_URL environment variable

  // Handle LED enabled toggle
  const handleLEDEnabledToggle = async (enabled) => {
    setLedEnabled(enabled);
    if (enabled) {
      // Test connection when enabling
      await testConnection();
    }
    // Note: LED status is now managed automatically by the backend
    // This toggle is kept for UI consistency but doesn't control backend behavior
  };

  // Handle LED GPIO change
  const handleUpdateLedGPIO = async () => {
    if (ledGPIO == null) return;
    const gpio = parseInt(ledGPIO, 10);
    if (isNaN(gpio) || gpio < 1 || gpio > 40) {
      toast.error('LED GPIO pin must be a number between 1 and 40');
      return;
    }
    setLoading(true);
    try {
      await gpioService.setLEDGPIO(gpio);
      toast.success(`LED GPIO updated to ${gpio}`);
      setLedGPIO(gpio);
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to update LED GPIO';
      toast.error(errorMsg);
      console.error('Error updating LED GPIO:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle LED mode change
  const handleUpdateLedMode = async (mode) => {
    setLoading(true);
    try {
      await gpioService.setLEDMode(mode);
      setLedMode(mode);
      toast.success(`LED mode set to ${mode === 'source' ? 'Source (active high)' : 'Sink (active low)'}`);
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to update LED mode';
      toast.error(errorMsg);
      console.error('Error updating LED mode:', err);
    } finally {
      setLoading(false);
    }
  };

  // Add new relay
  const handleAddRelay = async () => {
    if (!newRelayName.trim() || !newRelayGPIO) {
      toast.error('Please provide both relay name and GPIO pin');
      return;
    }

    const gpio = parseInt(newRelayGPIO);
    if (isNaN(gpio) || gpio < 1 || gpio > 40) {
      toast.error('GPIO pin must be a number between 1 and 40');
      return;
    }

    setLoading(true);
    try {
      await gpioService.addRelay(newRelayName.trim(), gpio, newRelayNormalState);
      toast.success(`Relay "${newRelayName}" added successfully`);
      setNewRelayName('');
      setNewRelayGPIO('');
      setNewRelayNormalState('off');
      setShowAddRelay(false);
      await loadRelays();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to add relay';
      toast.error(errorMsg);
      console.error('Error adding relay:', err);
    } finally {
      setLoading(false);
    }
  };

  // Remove relay
  const handleRemoveRelay = async (name) => {
    if (!window.confirm(`Are you sure you want to remove relay "${name}"?`)) {
      return;
    }

    setLoading(true);
    try {
      await gpioService.removeRelay(name);
      toast.success(`Relay "${name}" removed successfully`);
      await loadRelays();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to remove relay';
      toast.error(errorMsg);
      console.error('Error removing relay:', err);
    } finally {
      setLoading(false);
    }
  };

  // Control relay
  const handleControlRelay = async (name, action) => {
    setLoading(true);
    try {
      await gpioService.controlRelay(name, action);
      toast.success(`Relay "${name}" turned ${action}`);
      await loadRelays();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to control relay';
      toast.error(errorMsg);
      console.error('Error controlling relay:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update relay normal state
  const handleUpdateNormalState = async (name, normalState) => {
    setLoading(true);
    try {
      await gpioService.setRelayNormalState(name, normalState);
      toast.success(`Relay "${name}" normal state set to ${normalState.toUpperCase()}`);
      await loadRelays();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to update normal state';
      toast.error(errorMsg);
      console.error('Error updating normal state:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update relay GPIO
  const handleUpdateRelayGPIO = async (name, newGPIO) => {
    const gpio = parseInt(newGPIO, 10);
    if (isNaN(gpio) || gpio < 1 || gpio > 40) {
      toast.error('GPIO pin must be a number between 1 and 40');
      return;
    }

    setLoading(true);
    try {
      await gpioService.updateRelayGPIO(name, gpio);
      toast.success(`Relay "${name}" GPIO updated to ${gpio}`);
      setEditingRelay(null);
      await loadRelays();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to update relay GPIO';
      toast.error(errorMsg);
      console.error('Error updating relay GPIO:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stack">
      <SettingsSectionHeader
        icon={Network}
        title="Interfaces"
        description="Configure GPIO interfaces for LED status indicators and relay control"
        iconColor="blue"
      />

      <div className="stack">
        {/* Current Configuration Summary */}
        {connectionStatus === 'connected' && (
          <div className={cardStyles.card}>
            <h3 className="pageTitle">
              Current Configuration
            </h3>
            <div className="gridThree">
              {/* LED GPIO */}
              <div className={cardStyles.card}>
                <div className="row">
                  <Lightbulb size={16}  />
                  <span className="mutedText smallText">
                    LED GPIO Pin
                  </span>
                </div>
                <p >
                  {ledGPIO !== null ? `GPIO ${ledGPIO}` : 'Not Set'}
                </p>
              </div>
              
              {/* LED Mode */}
              <div className={cardStyles.card}>
                <div className="row">
                  <Lightbulb size={16}  />
                  <span className="mutedText smallText">
                    LED Mode
                  </span>
                </div>
                <p >
                  {ledMode === 'source' ? 'Source' : ledMode === 'sink' ? 'Sink' : 'Unknown'}
                </p>
                <p className="mutedText smallText">
                  {ledMode === 'source' ? 'Active High' : ledMode === 'sink' ? 'Active Low' : ''}
                </p>
              </div>
              
              {/* Relays Count */}
              <div className={cardStyles.card}>
                <div className="row">
                  <Power size={16}  />
                  <span className="mutedText smallText">
                    Configured Relays
                  </span>
                </div>
                <p >
                  {Object.keys(relays).length}
                </p>
                <p className="mutedText smallText">
                  {Object.keys(relays).length === 0 
                    ? 'No relays configured' 
                    : Object.keys(relays).length === 1 
                      ? '1 relay' 
                      : `${Object.keys(relays).length} relays`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* API Configuration */}
        <div className="stack">
          <div>
            <div className="rowBetween">
              <div>
                <div className="row">
                  <Network size={18}  />
                  <label className={formStyles.label}>
                    GPIO Service Connection
                  </label>
                </div>
                <p className="mutedText smallText">
                  GPIO service calls are handled by the backend server. Configure GPIO_SERVICE_URL on the server if needed.
                </p>
              </div>
              <button
                onClick={testConnection}
                disabled={loading}
                className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
                title="Test Connection"
              >
                {loading ? (
                  <RefreshCw size={16}  />
                ) : (
                  <RefreshCw size={16} />
                )}
                Test Connection
              </button>
            </div>
            
            {/* Connection Status */}
            <div className="row">
              {connectionStatus === 'connected' && (
                <>
                  <CheckCircle2 size={16}  />
                  <span className="mutedText smallText">
                    Connected to GPIO service
                  </span>
                </>
              )}
              {connectionStatus === 'disconnected' && (
                <>
                  <AlertCircle size={16}  />
                  <span className="mutedText smallText">
                    GPIO service unavailable
                  </span>
                </>
              )}
              {connectionStatus === 'unknown' && (
                <>
                  <AlertCircle size={16}  />
                  <span className="mutedText smallText">
                    Connection status unknown
                  </span>
                </>
              )}
            </div>
          </div>

          {/* LED Status Indicators Toggle */}
          <div className={cardStyles.card}>
            <div className="rowBetween">
              <div className="row">
                <div className={cardStyles.card}>
                  <Lightbulb size={24}  />
                </div>
                <div >
                  <h4 className="pageTitle">
                    Enable LED Status Indicators
                  </h4>
                  <p className="mutedText smallText">
                    LED status indicators are automatically managed by the backend server (startup → ready → active heartbeat)
                  </p>
                </div>
              </div>
              <div >
                <button
                  onClick={() => handleLEDEnabledToggle(!ledEnabled)}
                  className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.icon}`}
                >
                  <div  />
                </button>
              </div>
            </div>
          </div>

          {/* LED GPIO & Mode Configuration */}
          <div className={cardStyles.card}>
            <div className="row">
              <Lightbulb size={18}  />
              <h3 className="pageTitle">
                LED GPIO & Mode
              </h3>
            </div>
            <p className="mutedText smallText">
              Configure which GPIO pin drives the status LED and whether it operates as a source (active high) or sink (active low).
            </p>
            <div className="gridTwo">
              <div>
                <label className={formStyles.label}>
                  LED GPIO Pin (1-40)
                </label>
                <div className="row">
                  <input
                    type="number"
                    value={ledGPIO ?? ''}
                    onChange={(e) => setLedGPIO(e.target.value)}
                    placeholder="e.g., 13"
                    min="1"
                    max="40"
                    className={formStyles.input}
                  />
                  <button
                    onClick={handleUpdateLedGPIO}
                    disabled={loading || ledGPIO == null || ledGPIO === ''}
                    className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
                  >
                    Save
                  </button>
                </div>
              </div>
              <div>
                <label className={formStyles.label}>
                  LED Mode
                </label>
                <div className="row">
                  <select
                    value={ledMode}
                    onChange={(e) => handleUpdateLedMode(e.target.value)}
                    className={formStyles.select}
                  >
                    <option value="source">Source (GPIO → LED → Ground, active high)</option>
                    <option value="sink">Sink (3.3V → LED → GPIO, active low)</option>
                  </select>
                </div>
                <p className="mutedText smallText">
                  Use <strong>Source</strong> when the GPIO drives current into the LED (LED to ground). Use <strong>Sink</strong> when the LED is tied to 3.3V and the GPIO sinks current.
                </p>
              </div>
            </div>
          </div>

          {/* LED Pattern Testing */}
          <div className={cardStyles.card}>
            <div className="row">
              <Play size={18}  />
              <h3 className="pageTitle">
                Test LED Patterns
              </h3>
            </div>
            <p className="mutedText smallText">
              Test different LED flashing patterns to verify your GPIO service is working correctly
            </p>
            
            <div className="gridThree">
              {[
                { pattern: LED_PATTERNS.STARTUP, label: 'Startup', description: '3s on/off' },
                { pattern: LED_PATTERNS.FAST, label: 'Fast', description: '0.25s blink' },
                { pattern: LED_PATTERNS.MEDIUM, label: 'Medium', description: '0.5s blink' },
                { pattern: LED_PATTERNS.SLOW, label: 'Slow', description: '1s blink' },
                { pattern: LED_PATTERNS.PULSE, label: 'Pulse', description: 'Quick pulse' },
                { pattern: LED_PATTERNS.TWO, label: 'Two Blinks', description: '2 blinks' },
                { pattern: LED_PATTERNS.THREE, label: 'Three Blinks', description: '3 blinks' },
                { pattern: LED_PATTERNS.ON, label: 'On', description: 'Solid on' },
                { pattern: LED_PATTERNS.OFF, label: 'Off', description: 'Solid off' },
              ].map(({ pattern, label, description }) => (
                <button
                  key={pattern}
                  onClick={async () => {
                    setLoading(true);
                    try {
                      await gpioService.setPattern(pattern);
                      toast.success(`LED pattern set to: ${label}`);
                    } catch (err) {
                      const errorMsg = err.response?.data?.detail || err.message || 'Failed to set LED pattern';
                      toast.error(errorMsg);
                      console.error('Error setting LED pattern:', err);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading || connectionStatus === 'disconnected'}
                  className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
                  title={description}
                >
                  <div >
                    {label}
                  </div>
                  <div >
                    {description}
                  </div>
                </button>
              ))}
            </div>
            
            {/* Stop LED Button */}
            <div >
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    await gpioService.stopLED();
                    toast.success('LED stopped');
                  } catch (err) {
                    const errorMsg = err.response?.data?.detail || err.message || 'Failed to stop LED';
                    toast.error(errorMsg);
                    console.error('Error stopping LED:', err);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading || connectionStatus === 'disconnected'}
                className={`${buttonStyles.button} ${buttonStyles.danger} ${buttonStyles.medium}`}
              >
                <Square size={16} />
                Stop LED
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className={cardStyles.card}>
              <div className="row">
                <AlertCircle size={20} />
                <span className="mutedText smallText">{typeof error === 'string' ? error : (error?.message || String(error))}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Relay Management */}
      <div >
        <div className="row">
          <div className={cardStyles.card}>
            <Power size={24}  />
          </div>
          <div>
            <h2 className="pageTitle">
              Relay Management
            </h2>
            <p className="mutedText smallText">
              Configure and control GPIO relays
            </p>
          </div>
        </div>

        {/* Add Relay Button */}
        <div >
          <button
            onClick={() => setShowAddRelay(!showAddRelay)}
            className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
          >
            <Plus size={16} />
            Add Relay
          </button>
        </div>

        {/* Add Relay Form */}
        {showAddRelay && (
          <div className={cardStyles.card}>
            <h3 className="pageTitle">
              Add New Relay
            </h3>
            <div className="gridTwo">
              <div>
                <label className={formStyles.label}>
                  Relay Name
                </label>
                <input
                  type="text"
                  value={newRelayName}
                  onChange={(e) => setNewRelayName(e.target.value)}
                  placeholder="e.g., Relay1"
                  className={formStyles.input}
                />
              </div>
              <div>
                <label className={formStyles.label}>
                  GPIO Pin (1-40)
                </label>
                <input
                  type="number"
                  value={newRelayGPIO}
                  onChange={(e) => setNewRelayGPIO(e.target.value)}
                  placeholder="e.g., 18"
                  min="1"
                  max="40"
                  className={formStyles.input}
                />
              </div>
              <div>
                <label className={formStyles.label}>
                  Normal State
                </label>
                <select
                  value={newRelayNormalState}
                  onChange={(e) => setNewRelayNormalState(e.target.value)}
                  className={formStyles.select}
                >
                  <option value="off">Normal Off (default OFF state)</option>
                  <option value="on">Normal On (default ON state)</option>
                </select>
                <p className="mutedText smallText">
                  The default state when the relay is initialized or reset.
                </p>
              </div>
            </div>
            <div className="row">
              <button
                onClick={handleAddRelay}
                disabled={loading || !newRelayName.trim() || !newRelayGPIO}
                className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
              >
                Add Relay
              </button>
              <button
                onClick={() => {
                  setShowAddRelay(false);
                  setNewRelayName('');
                  setNewRelayGPIO('');
                  setNewRelayNormalState('off');
                }}
                className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Relays Summary */}
        {connectionStatus === 'connected' && Object.keys(relays).length > 0 && (
          <div className={cardStyles.card}>
            <h3 className="pageTitle">
              Configured Relays
            </h3>
            <div className="gridThree">
              {Object.entries(relays).map(([name, relay]) => (
                <div
                  key={name}
                  className={cardStyles.card}
                >
                  <div className="rowBetween">
                    <div>
                      <p className="mutedText smallText">
                        {name}
                      </p>
                      <p className="mutedText smallText">
                        GPIO {relay.gpio}
                      </p>
                    </div>
                    <div >
                      <span className="mutedText smallText">
                        {relay.state ? 'ON' : 'OFF'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Relays List */}
        <div className="stack">
          {Object.keys(relays).length === 0 ? (
            <div className={cardStyles.card}>
              <Power size={32}  />
              <p>No relays configured. Click "Add Relay" to create one.</p>
            </div>
          ) : (
            Object.entries(relays).map(([name, relay]) => (
              <div
                key={name}
                className={cardStyles.card}
              >
                <div className="rowBetween">
                  <div >
                    <h3 className="pageTitle">
                      {name}
                    </h3>
                    <div className="rowWrap">
                      {editingRelay?.name === name ? (
                        <div className="row">
                          <span className="mutedText smallText">GPIO:</span>
                          <input
                            type="number"
                            min="1"
                            max="40"
                            value={editingRelay.gpio}
                            onChange={(e) => setEditingRelay({ ...editingRelay, gpio: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleUpdateRelayGPIO(name, editingRelay.gpio);
                              } else if (e.key === 'Escape') {
                                setEditingRelay(null);
                              }
                            }}
                            className={formStyles.input}
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdateRelayGPIO(name, editingRelay.gpio)}
                            className={`${buttonStyles.button} ${buttonStyles.success} ${buttonStyles.icon}`}
                            title="Save"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => setEditingRelay(null)}
                            className={`${buttonStyles.button} ${buttonStyles.danger} ${buttonStyles.icon}`}
                            title="Cancel"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="row">
                          <span className="mutedText smallText">
                            GPIO: {relay.gpio}
                          </span>
                          <button
                            onClick={() => setEditingRelay({ name, gpio: relay.gpio })}
                            disabled={loading}
                            className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.icon}`}
                            title="Edit GPIO"
                          >
                            <Edit2 size={14} />
                          </button>
                        </div>
                      )}
                      <span className="mutedText smallText">
                        {relay.state ? 'ON' : 'OFF'}
                      </span>
                      <span className="mutedText smallText">
                        Normal: {relay.normal_state === 'on' ? 'ON' : 'OFF'}
                      </span>
                    </div>
                  </div>
                  <div className="rowWrap">
                    <button
                      onClick={() => handleControlRelay(name, relay.state ? 'off' : 'on')}
                      disabled={loading}
                      className={`${buttonStyles.button} ${buttonStyles.danger} ${buttonStyles.medium}`}
                    >
                      <span>🔋</span>
                      <span >{relay.state ? 'Disconnect Battery' : 'Connect Battery'}</span>
                      <span >{relay.state ? 'Disconnect' : 'Connect'}</span>
                    </button>
                    <button
                      onClick={() => handleControlRelay(name, 'toggle')}
                      disabled={loading}
                      className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
                      title="Toggle"
                    >
                      ↕
                    </button>
                    <select
                      value={relay.normal_state || 'off'}
                      onChange={(e) => handleUpdateNormalState(name, e.target.value)}
                      disabled={loading}
                      className={formStyles.select}
                      title="Set Normal State (default state when initialized)"
                    >
                      <option value="off">Normal Off</option>
                      <option value="on">Normal On</option>
                    </select>
                    <button
                      onClick={() => handleRemoveRelay(name)}
                      disabled={loading}
                      className={`${buttonStyles.button} ${buttonStyles.danger} ${buttonStyles.medium}`}
                      title="Remove Relay"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Refresh Button */}
        {Object.keys(relays).length > 0 && (
          <div >
            <button
              onClick={loadRelays}
              disabled={loading}
              className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
            >
              <RefreshCw size={16}  />
              Refresh Relays
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Interfaces;
