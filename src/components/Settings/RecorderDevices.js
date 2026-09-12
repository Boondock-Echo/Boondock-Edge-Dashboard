import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../utils/apiClient';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import buttonStyles from '../ui/Button.module.css';
import noticeStyles from '../ui/Notice.module.css';
import tableStyles from '../ui/Table.module.css';
import modalStyles from '../ui/Modal.module.css';
import { Cpu, RefreshCw, Usb, AlertCircle, Edit3, Save as SaveIcon, Power, Upload, Trash2, Zap, Package, Mic,
  UploadCloud, ChevronDown, ChevronUp, Info } from 'lucide-react';

/** Recording health payload (DEVICE_SERIAL.md): rc = recording count, uc = uploaded count this session */
function getRecordingHealthBlock(serialPort) {
  const h = serialPort?.health;
  if (!h) return null;
  if (h.recording?.data) return h.recording.data;
  if (h.data && typeof h.data === 'object') {
    const d = h.data;
    const looksRecording =
      d.rc != null ||
      d.uc != null ||
      d.tr != null ||
      d.tu != null ||
      (Array.isArray(d.st) && (d.am != null || d.ax != null));
    if (looksRecording) return d;
  }
  if (h.legacy?.data) return h.legacy.data;
  return null;
}

function getSystemHealthBlock(serialPort) {
  return serialPort?.health?.system?.data || null;
}

const RecorderDevices = ({ enabled }) => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [deviceBusy, setDeviceBusy] = useState({});
  const [configByPort, setConfigByPort] = useState({});
  const [allSerialPorts, setAllSerialPorts] = useState([]);
  const [firmwares, setFirmwares] = useState([]);
  const [firmwareUploadModal, setFirmwareUploadModal] = useState({ open: false, name: '', files: {}, uploading: false, error: null });
  const [flashModal, setFlashModal] = useState({ open: false, port: null, firmwareId: '', flashing: false, error: null });
  const [flashProgress, setFlashProgress] = useState({ status: 'not_started', progress: 0, message: '', output: '' });
  const [firmwareEditModal, setFirmwareEditModal] = useState({ open: false, firmware: null, name: '', description: '', saving: false, error: null });
  const [monitorMessages, setMonitorMessages] = useState([]);
  const [messagesPolling, setMessagesPolling] = useState(false);
  const [selectedPorts, setSelectedPorts] = useState([]); // Ports to filter messages
  const [commandInput, setCommandInput] = useState('');
  const [sendingCommand, setSendingCommand] = useState(false);
  const [monitoredPorts, setMonitoredPorts] = useState([]); // Ports that are being monitored
  const [cliModeEnabled, setCliModeEnabled] = useState({}); // Track CLI mode per port
  const [resetting, setResetting] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState({}); // Store parsed device status per port
  const [channels, setChannels] = useState([]); // Store channels for MAC address matching
  const [lastUpdateTime, setLastUpdateTime] = useState({}); // Track last update time per port
  const [globalSettings, setGlobalSettings] = useState({}); // Store global settings for host config
  const [expandedDevices, setExpandedDevices] = useState({}); // Track which devices have expanded details
  const [dynamicRangeHistory, setDynamicRangeHistory] = useState({}); // Track last 5 dynamic range readings per port
  const [rebootCounts, setRebootCounts] = useState({}); // Track reboot counts per port
  const [rebootHistory, setRebootHistory] = useState({}); // Track reboot history per port
  const [serialData, setSerialData] = useState({}); // Store parsed serial data (short, health, config, error logs) per port
  const flashProgressTimerRef = useRef(null);
  const messagesPollTimerRef = useRef(null);
  const firmwareUploadDialogRef = useRef(null);
  const flashDialogRef = useRef(null);
  const firmwareEditDialogRef = useRef(null);

  const setDeviceBusyState = useCallback((port, action) => {
    setDeviceBusy((prev) => ({ ...prev, [port]: action }));
  }, []);

  const clearDeviceBusyState = useCallback((port) => {
    setDeviceBusy((prev) => {
      if (!(port in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[port];
      return next;
    });
  }, []);

  const loadConfigsForPorts = useCallback(async (ports, reset = false) => {
    if (!ports || ports.length === 0) {
      if (reset) {
        setConfigByPort({});
      }
      return;
    }

    const tasks = ports.map(async (port) => {
      try {
        const response = await api.get(`/recorders/config`, { 
          params: { port },
          // Suppress error responses (404 is expected when no config exists)
          validateStatus: () => true
        });
        
        // Handle successful response
        if (response.status === 200 || response.status === 201) {
          const config = response.data?.config ?? null;
          return { port, config };
        }
        
        // Handle 404 - normal case when no config saved
        if (response.status === 404) {
          return { port, config: null };
        }
        
        // Handle other errors
        throw { port, error: new Error(`HTTP ${response.status}`) };
      } catch (error) {
        throw { port, error };
      }
    });

    const results = await Promise.allSettled(tasks);

    setConfigByPort((prev) => {
      const base = reset ? {} : { ...prev };
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const { port, config } = result.value;
          if (config !== null && config !== undefined) {
            base[port] = config;
          } else if (reset) {
            delete base[port];
          }
        } else {
          const failedPort = result.reason?.port;
          if (reset && failedPort && Object.prototype.hasOwnProperty.call(base, failedPort)) {
            delete base[failedPort];
          }
          // Only log actual errors, not 404s
          if (result.reason?.error) {
            const errorMsg = result.reason.error?.message || '';
            if (!errorMsg.includes('404')) {
              console.warn('Failed to load recorder config:', failedPort, result.reason.error);
            }
          }
        }
      });
      return base;
    });
  }, []);

  const fetchAllSerialPorts = useCallback(async () => {
    try {
      const response = await api.get(`/recorders/serial-ports`);
      setAllSerialPorts(response.data?.ports || []);
    } catch (err) {
      console.error('Failed to fetch serial ports:', err);
    }
  }, []);

  const fetchFirmwares = useCallback(async () => {
    try {
      const response = await api.get(`/recorders/firmware`);
      setFirmwares(response.data?.firmwares || []);
    } catch (err) {
      console.error('Failed to fetch firmwares:', err);
    }
  }, []);

  const fetchDevices = useCallback(async (showLoader = true) => {
    if (!enabled) {
      setDevices([]);
      setLoading(false);
      setError(null);
      setConfigByPort({});
      return;
    }

    if (showLoader) {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await api.get(`/recorders/devices`);
      const deviceList = response.data?.devices || [];
      setDevices(deviceList);
      await loadConfigsForPorts(deviceList.map((device) => device.port), true);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load Boondock Edge devices.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [enabled, loadConfigsForPorts]);

  const fetchChannels = useCallback(async () => {
    try {
      const response = await api.get(`/channels`);
      const channelList = response.data?.channels || response.data || [];
      setChannels(Array.isArray(channelList) ? channelList : []);
    } catch (err) {
      console.debug('Failed to fetch channels:', err);
      setChannels([]);
    }
  }, []);

  const fetchGlobalSettings = useCallback(async () => {
    try {
      const response = await api.get(`/settings`);
      const settings = response.data || {};
      // Map backend field names to frontend field names
      // Note: host_password may be masked as '***' - we'll handle that in validation
      setGlobalSettings({
        ...settings,
        host_ssid: settings.host_ssid || '',
        host_password: settings.host_password || '',
        host_ip: settings.host_ip || '',
        host_port: settings.host_port || '',
      });
    } catch (err) {
      console.debug('Failed to fetch global settings:', err);
      setGlobalSettings({});
    }
  }, []);

  const fetchRebootCounts = useCallback(async () => {
    if (!enabled) {
      return;
    }
    try {
      const response = await api.get(`/recorders/reboot-counts`);
      const counts = response.data?.reboot_counts || [];
      const countsMap = {};
      counts.forEach(item => {
        if (item.port) {
          countsMap[item.port] = item.reboot_count || 0;
        }
      });
      setRebootCounts(countsMap);
    } catch (err) {
      console.debug('Failed to fetch reboot counts:', err);
      setRebootCounts({});
    }
  }, [enabled]);

  const fetchSerialData = useCallback(async (port) => {
    if (!enabled || !port) {
      return;
    }
    try {
      const response = await api.get(`/recorders/serial-data`, {
        params: { port },
        validateStatus: () => true
      });
      
      // Only process successful responses
      if (response.status === 200 || response.status === 201) {
        const data = response.data || {};
        setSerialData(prev => ({
          ...prev,
          [port]: {
            short: data.short,
            health: data.health,
            config: data.config,
            errorLogs: data.error_logs || []
          }
        }));
        setLastUpdateTime(prev => ({ ...prev, [port]: Date.now() }));
      }
      // Silently ignore 404 and other errors (device data may not be available yet)
    } catch (err) {
      // Silent fail - serial data might not be available
    }
  }, [enabled]);

  const fetchRebootHistory = useCallback(async (port, macAddress) => {
    if (!enabled || !port) {
      return;
    }
    try {
      const params = macAddress ? { mac: macAddress, limit: 5 } : { port: port, limit: 5 };
      const response = await api.get(`/recorders/reboot-history`, { params });
      const reboots = response.data?.reboots || [];
      setRebootHistory(prev => ({
        ...prev,
        [port]: reboots
      }));
    } catch (err) {
      console.debug('Failed to fetch reboot history:', err);
      setRebootHistory(prev => ({
        ...prev,
        [port]: []
      }));
    }
  }, [enabled]);

  useEffect(() => {
    fetchDevices();
    fetchAllSerialPorts();
    fetchFirmwares();
    fetchChannels();
    fetchGlobalSettings();
    fetchRebootCounts();
  }, [fetchDevices, fetchAllSerialPorts, fetchFirmwares, fetchChannels, fetchGlobalSettings, fetchRebootCounts]);

  const fetchMonitorMessages = useCallback(async () => {
    if (!enabled) {
      return;
    }
    try {
      const response = await api.get(`/recorders/monitor/messages`, {
        params: { limit: 100 }
      });
      const messages = response.data?.messages || [];
      setMonitorMessages(messages);
      
      // Parse JSON messages to extract device status (handles new message types: short, performance, config)
      const statusByPort = {};
      messages.forEach(msg => {
        try {
          // Try to parse JSON from the message
          const jsonMatch = msg.message.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const jsonData = JSON.parse(jsonMatch[0]);
            if (jsonData && typeof jsonData === 'object') {
              const port = msg.port;
              const messageType = jsonData.ty; // Type: "short", "performance", or "config"
              // Merge with existing data to preserve all information
              const existing = statusByPort[port] || {};
              
              // Initialize status object with existing data
              const status = { ...existing };
              
              // Handle SHORT message (sent every 5 seconds)
              if (messageType === 'short') {
                // Basic status fields
                status.record = jsonData.rg === true;
                status.upload = jsonData.ug === true;
                status.queue = jsonData.qe !== undefined ? jsonData.qe : existing.queue;
                status.uptime = jsonData.ut !== undefined ? jsonData.ut : existing.uptime;
                
                // Audio data
                if (!status.audio) status.audio = {};
                if (jsonData.cd !== undefined) status.audio.currentDb = jsonData.cd;
                if (jsonData.mi !== undefined) status.audio.minDb = jsonData.mi;
                if (jsonData.mx !== undefined) status.audio.maxDb = jsonData.mx;
                if (jsonData.ad !== undefined) status.audio.avgDb = jsonData.ad; // Note: user description says "av" but example shows "ad"
                if (jsonData.av !== undefined) status.audio.avgDb = jsonData.av; // Support both
                if (jsonData.dy !== undefined) status.audio.currentDynamic = jsonData.dy;
                
                // Network info
                if (jsonData.mc !== undefined) status.mac = jsonData.mc;
                if (jsonData.ip !== undefined) status.ip = jsonData.ip;
                if (jsonData.wi !== undefined) {
                  // Convert string "true"/"false" to boolean
                  status.wifi = jsonData.wi === true || jsonData.wi === "true";
                }
                if (jsonData.ri !== undefined) status.rssi = jsonData.ri;
              }
              
              // Handle PERFORMANCE message (sent once every minute) - DEPRECATED: merged into health
              if (messageType === 'performance') {
                // Storage info (st is string "SD" in system health; in recording health st is task-stack array - do not overwrite)
                if (jsonData.st !== undefined && typeof jsonData.st === 'string') {
                  status.storage = jsonData.st; // Storage type: "SD" or "PSRAM"
                }
                if (jsonData.sd !== undefined) {
                  status.sd = jsonData.sd === true;
                }
                // SD card size and used space
                if (jsonData.sz !== undefined) status.sdTotal = jsonData.sz; // SD card Total Size in bytes
                if (jsonData.su !== undefined) status.sdUsed = jsonData.su; // SD card Space used in bytes
                if (jsonData.ht !== undefined) status.heapTotal = jsonData.ht;
                if (jsonData.hu !== undefined) status.heapUsed = jsonData.hu;
                if (jsonData.hm !== undefined) status.heapMin = jsonData.hm;
                if (jsonData.hb !== undefined) status.heapBlock = jsonData.hb;
                if (jsonData.pt !== undefined) status.psramTotal = jsonData.pt;
                if (jsonData.pu !== undefined) status.psramUsed = jsonData.pu;
                if (jsonData.tm !== undefined) status.timeSet = jsonData.tm === true;
                if (jsonData.rt !== undefined) status.rtcEnabled = jsonData.rt === true;
                if (jsonData.ct !== undefined) status.currentTime = jsonData.ct;
                if (jsonData.ep !== undefined) status.epochTime = jsonData.ep;
                if (jsonData.tr !== undefined) status.recorded = jsonData.tr;
                if (jsonData.tu !== undefined) status.uploaded = jsonData.tu;
                if (jsonData.lr !== undefined) status.lastRecordingTime = jsonData.lr;
                if (jsonData.ld !== undefined) status.lastRecordingDuration = jsonData.ld;
                if (jsonData.lt !== undefined) status.lastRecordingStart = jsonData.lt;
              }
              
              // Handle HEALTH message (includes performance metrics merged from performance messages)
              if (messageType === 'health') {
                // Storage info (st is string "SD" in system health; in recording health st is task-stack array - do not overwrite)
                if (jsonData.st !== undefined && typeof jsonData.st === 'string') {
                  status.storage = jsonData.st; // Storage type: "SD" or "PSRAM"
                }
                if (jsonData.sd !== undefined) {
                  status.sd = jsonData.sd === true;
                }
                // SD card size and used space (formatted strings)
                if (jsonData.sz !== undefined) status.sdTotal = jsonData.sz; // Total storage size (formatted string)
                if (jsonData.su !== undefined) status.sdUsed = jsonData.su; // Used storage size (formatted string)
                if (jsonData.ht !== undefined) status.heapTotal = jsonData.ht; // Heap total (formatted string)
                if (jsonData.hu !== undefined) status.heapUsed = jsonData.hu; // Heap used (formatted string)
                if (jsonData.hm !== undefined) status.heapMin = jsonData.hm; // Heap min (formatted string)
                if (jsonData.hb !== undefined) status.heapBlock = jsonData.hb; // Heap block (formatted string)
                if (jsonData.pt !== undefined) status.psramTotal = jsonData.pt; // PSRAM total (formatted string)
                if (jsonData.pu !== undefined) status.psramUsed = jsonData.pu; // PSRAM used (formatted string)
                if (jsonData.tm !== undefined) status.timeSet = jsonData.tm === true;
                if (jsonData.rt !== undefined) status.rtcEnabled = jsonData.rt === true;
                if (jsonData.ct !== undefined) status.currentTime = jsonData.ct;
                if (jsonData.ep !== undefined) status.epochTime = jsonData.ep;
                // Total recordings and uploaded (from health messages)
                if (jsonData.tr !== undefined) status.recorded = jsonData.tr;
                if (jsonData.tu !== undefined) status.uploaded = jsonData.tu;
                if (jsonData.lr !== undefined) status.lastRecordingTime = jsonData.lr;
                if (jsonData.ld !== undefined) status.lastRecordingDuration = jsonData.ld;
                if (jsonData.lt !== undefined) status.lastRecordingStart = jsonData.lt;
              }
              
              // Handle CONFIG message (sent on device start or settings change)
              if (messageType === 'config') {
                if (jsonData.mc !== undefined) status.mac = jsonData.mc;
                if (jsonData.fw !== undefined) status.firmware = jsonData.fw;
                if (jsonData.ho !== undefined) status.host = jsonData.ho;
                if (jsonData.po !== undefined) status.hostPort = jsonData.po;
                if (jsonData.ss !== undefined) status.ssid = jsonData.ss;
                if (jsonData.sie !== undefined) status.staticIpEnabled = jsonData.sie === true;
                if (jsonData.sip !== undefined) status.staticIp = jsonData.sip;
                if (jsonData.ssn !== undefined) status.staticSubnet = jsonData.ssn;
                if (jsonData.sgt !== undefined) status.staticGateway = jsonData.sgt;
                if (jsonData.sd1 !== undefined) status.staticDns1 = jsonData.sd1;
                if (jsonData.sd2 !== undefined) status.staticDns2 = jsonData.sd2;
                if (jsonData.rte !== undefined) status.rtcEnabled = jsonData.rte === true;
                if (jsonData.usc !== undefined) status.useSdCard = jsonData.usc === true;
                if (jsonData.rsc !== undefined) status.recordToSdCard = jsonData.rsc === true;
                if (jsonData.m1b !== undefined) status.mode1bit = jsonData.m1b === true;
                if (jsonData.frq !== undefined) status.frequency = jsonData.frq;
                if (jsonData.fmf !== undefined) status.formatIfMountFailed = jsonData.fmf === true;
                if (jsonData.oh !== undefined) status.offsetHours = jsonData.oh;
                if (jsonData.mh !== undefined) status.maintenanceHour = jsonData.mh;
                if (jsonData.mm !== undefined) status.maintenanceMinute = jsonData.mm;
                if (jsonData.wtp !== undefined) status.wifiTxPower = jsonData.wtp;
                if (jsonData.ath !== undefined) status.threshold = jsonData.ath;
                if (jsonData.mi !== undefined) status.minRecording = jsonData.mi;
                if (jsonData.mx !== undefined) status.maxRecording = jsonData.mx;
                if (jsonData.si !== undefined) status.silenceThreshold = jsonData.si;
                if (jsonData.pr !== undefined) status.prerecording = jsonData.pr;
                if (jsonData.gn !== undefined) status.gain = jsonData.gn;
                if (jsonData.is !== undefined) status.inputSamplingRate = jsonData.is;
                if (jsonData.ib !== undefined) status.inputBuffers = jsonData.ib;
                if (jsonData.ds !== undefined) status.discardSmall = jsonData.ds === true;
                if (jsonData.dm !== undefined) status.discardSmallMs = jsonData.dm;
              }
              
              // Store the updated status
              statusByPort[port] = status;
            }
          }
        } catch (e) {
          // Not a JSON message, ignore
        }
      });
      
      // Update device status, keeping existing status if no new data
      const currentTime = Date.now();
      setDeviceStatus(prev => {
        const updated = { ...prev };
        Object.keys(statusByPort).forEach(port => {
          updated[port] = statusByPort[port];
        });
        return updated;
      });
      
      // Update dynamic range history (running average of last 5 readings)
      setDynamicRangeHistory(prev => {
        const updated = { ...prev };
        Object.keys(statusByPort).forEach(port => {
          const status = statusByPort[port];
          if (status.audio?.currentDynamic !== undefined) {
            const currentValue = status.audio.currentDynamic;
            if (!updated[port]) {
              updated[port] = [];
            }
            // Add new value to history
            updated[port] = [...updated[port], currentValue].slice(-5); // Keep only last 5
          }
        });
        return updated;
      });
      
      // Update last update time for ports that received new data
      setLastUpdateTime(prev => {
        const updated = { ...prev };
        Object.keys(statusByPort).forEach(port => {
          updated[port] = currentTime;
        });
        return updated;
      });
    } catch (err) {
      // Silently fail - monitoring might not be active
      console.debug('Failed to fetch monitor messages:', err);
    }
  }, [enabled]);

  const fetchMonitorStatus = useCallback(async () => {
    if (!enabled) {
      return;
    }
    try {
      const response = await api.get(`/recorders/monitor/status`);
      const statusList = response.data?.devices || [];
      const monitored = statusList
        .filter(d => d.monitor_flag && d.monitoring_active)
        .map(d => d.port);
      setMonitoredPorts(monitored);
      
      // Initialize selected ports to all monitored ports if not set
      if (selectedPorts.length === 0 && monitored.length > 0) {
        setSelectedPorts(monitored);
      }
    } catch (err) {
      console.debug('Failed to fetch monitor status:', err);
    }
  }, [enabled, selectedPorts.length]);

  // Default selected ports to all devices so Send is available even if monitor/status hasn't returned active ports yet
  useEffect(() => {
    if (enabled && devices.length > 0 && selectedPorts.length === 0) {
      const ports = devices.map((d) => d.port).filter(Boolean);
      if (ports.length > 0) {
        setSelectedPorts(ports);
      }
    }
  }, [enabled, devices, selectedPorts.length]);

  const handleSendCommand = useCallback(async () => {
    if (!commandInput.trim() || selectedPorts.length === 0) {
      setNotification({ type: 'error', text: 'Please enter a command and select at least one port.' });
      return;
    }

    setSendingCommand(true);
    try {
      const response = await api.post(`/recorders/monitor/send`, {
        command: commandInput.trim(),
        ports: selectedPorts
      });
      
      const successCount = response.data?.success_count || 0;
      const totalCount = response.data?.total_count || 0;
      
      if (successCount === totalCount) {
        setNotification({ type: 'success', text: `Command sent successfully to ${successCount} port(s).` });
      } else {
        setNotification({ type: 'error', text: `Command sent to ${successCount}/${totalCount} port(s). Some ports failed.` });
      }
      
      setCommandInput('');
    } catch (err) {
      let message = err.response?.data?.message || 'Failed to send command.';
      if (err.response?.status === 403 && message.toLowerCase().includes('discovery')) {
        message = 'Recorder discovery is disabled. Enable "Boondock Edge devices" in Global Settings to send serial commands.';
      }
      setNotification({ type: 'error', text: message });
    } finally {
      setSendingCommand(false);
    }
  }, [commandInput, selectedPorts]);

  const handleReset = useCallback(async () => {
    if (monitoredPorts.length === 0) {
      setNotification({ type: 'error', text: 'No devices are being monitored.' });
      return;
    }

    setResetting(true);
    try {
      const response = await api.post(`/recorders/monitor/reset`);
      const successCount = response.data?.success_count || 0;
      const totalCount = response.data?.total_count || 0;
      
      if (successCount === totalCount) {
        setNotification({ type: 'success', text: `Reset ${successCount} device(s) successfully.` });
      } else {
        setNotification({ type: 'error', text: `Reset ${successCount}/${totalCount} device(s). Some devices failed.` });
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to reset devices.';
      setNotification({ type: 'error', text: message });
    } finally {
      setResetting(false);
    }
  }, [monitoredPorts.length]);

  const handleCliMode = useCallback(async () => {
    if (selectedPorts.length === 0) {
      setNotification({ type: 'error', text: 'Please select at least one port.' });
      return;
    }

    // Determine CLI mode state - if all selected ports have CLI enabled, turn off; otherwise turn on
    const allEnabled = selectedPorts.every(port => cliModeEnabled[port]);
    const command = allEnabled ? 'climode off' : 'climode on';

    setSendingCommand(true);
    try {
      const response = await api.post(`/recorders/monitor/send`, {
        command: command,
        ports: selectedPorts
      });
      
      const successCount = response.data?.success_count || 0;
      const totalCount = response.data?.total_count || 0;
      
      // Update CLI mode state for successful ports
      if (successCount > 0) {
        const newState = {};
        selectedPorts.forEach(port => {
          if (response.data?.results?.[port]) {
            newState[port] = !allEnabled;
          }
        });
        setCliModeEnabled(prev => ({ ...prev, ...newState }));
      }
      
      if (successCount === totalCount) {
        setNotification({ type: 'success', text: `CLI Mode ${allEnabled ? 'disabled' : 'enabled'} on ${successCount} port(s).` });
      } else {
        setNotification({ type: 'error', text: `CLI Mode command sent to ${successCount}/${totalCount} port(s). Some ports failed.` });
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to send CLI Mode command.';
      setNotification({ type: 'error', text: message });
    } finally {
      setSendingCommand(false);
    }
  }, [selectedPorts, cliModeEnabled]);

  const handleAutoConfig = useCallback(async () => {
    if (selectedPorts.length === 0) {
      setNotification({ type: 'error', text: 'Please select at least one port.' });
      return;
    }

    // Validate host configuration (coerce to string — API/settings may return numbers)
    const hostSsid = String(globalSettings.host_ssid ?? '').trim();
    const hostPassword = String(globalSettings.host_password ?? '');
    const hostIp = String(globalSettings.host_ip ?? '').trim();
    const hostPort = globalSettings.host_port != null && globalSettings.host_port !== ''
      ? String(globalSettings.host_port)
      : '';

    const isPasswordMasked = hostPassword === '***';
    const hasPassword = hostPassword.trim() !== '' && !isPasswordMasked;

    const portNum = parseInt(hostPort, 10);
    const isValidPort = !isNaN(portNum) && portNum >= 1 && portNum <= 65535;

    if (!hostSsid || !hasPassword || !hostIp || !isValidPort) {
      if (isPasswordMasked) {
        setNotification({ type: 'error', text: 'Host password is configured but masked. Please re-enter the password in Global Settings to use Auto Config.' });
      } else if (!isValidPort) {
        setNotification({ type: 'error', text: 'Please configure a valid Host Port (1-65535) in Global Settings.' });
      } else {
        setNotification({ type: 'error', text: 'Please configure Host SSID, Password, IP, and Port in Global Settings.' });
      }
      return;
    }

    setSendingCommand(true);
    try {
      const response = await api.post(`/recorders/monitor/autoconfig`, {
        ports: selectedPorts,
        host_ssid: hostSsid,
        host_password: hostPassword,
        host_ip: hostIp,
        host_port: portNum,
        command_interval: 2.5,
      }, {
        timeout: 60000,
      });

      const data = response.data || {};
      const successCount = data.success_count ?? 0;
      const totalCount = data.total_count ?? selectedPorts.length;
      const results = data.results || {};

      if (successCount === totalCount) {
        setNotification({ type: 'success', text: `Auto Config completed successfully on ${successCount} port(s).` });
      } else if (successCount > 0) {
        const failed = selectedPorts.filter(p => !(results[p] && results[p].success));
        const msg = results[failed[0]]?.message || 'Step failed or timed out';
        setNotification({ type: 'error', text: `Auto Config completed on ${successCount}/${totalCount} port(s). Failed: ${failed.join(', ')} — ${msg}` });
      } else {
        const firstPort = selectedPorts[0];
        const msg = results[firstPort]?.message || data.message || 'Auto Config failed';
        setNotification({ type: 'error', text: msg });
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to run Auto Config.';
      setNotification({ type: 'error', text: message });
    } finally {
      setSendingCommand(false);
    }
  }, [selectedPorts, globalSettings]);

  const handleReboot = useCallback(async () => {
    if (selectedPorts.length === 0) {
      setNotification({ type: 'error', text: 'Please select at least one port.' });
      return;
    }

    setSendingCommand(true);
    try {
      const response = await api.post(`/recorders/monitor/send`, {
        command: 'reboot',
        ports: selectedPorts
      });
      
      const successCount = response.data?.success_count || 0;
      const totalCount = response.data?.total_count || 0;
      
      if (successCount === totalCount) {
        setNotification({ type: 'success', text: `Reboot command sent to ${successCount} port(s).` });
      } else {
        setNotification({ type: 'error', text: `Reboot command sent to ${successCount}/${totalCount} port(s). Some ports failed.` });
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to send reboot command.';
      setNotification({ type: 'error', text: message });
    } finally {
      setSendingCommand(false);
    }
  }, [selectedPorts]);

  const handleRefreshDeviceData = useCallback(async () => {
    if (selectedPorts.length === 0) {
      setNotification({ type: 'error', text: 'Please select at least one port.' });
      return;
    }

    setSendingCommand(true);
    try {
      // Send "config ?" command first
      await api.post(`/recorders/monitor/send`, {
        command: 'config ?',
        ports: selectedPorts
      });
      
      setNotification({ type: 'success', text: 'Refreshing device info... (config sent, health in 5s)' });
      
      // Wait 5 seconds then send "health ?" command
      setTimeout(async () => {
        try {
          const response = await api.post(`/recorders/monitor/send`, {
            command: 'health ?',
            ports: selectedPorts
          });
          
          const successCount = response.data?.success_count || 0;
          const totalCount = response.data?.total_count || 0;
          
          if (successCount === totalCount) {
            setNotification({ type: 'success', text: `Refresh complete on ${successCount} port(s).` });
          } else {
            setNotification({ type: 'error', text: `Refresh sent to ${successCount}/${totalCount} port(s). Some ports failed.` });
          }
        } catch (err) {
          const message = err.response?.data?.message || 'Failed to send health command.';
          setNotification({ type: 'error', text: message });
        } finally {
          setSendingCommand(false);
        }
      }, 5000);
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to send config command.';
      setNotification({ type: 'error', text: message });
      setSendingCommand(false);
    }
  }, [selectedPorts]);

  useEffect(() => {
    if (!enabled) {
      if (messagesPollTimerRef.current) {
        clearInterval(messagesPollTimerRef.current);
        messagesPollTimerRef.current = null;
      }
      setMessagesPolling(false);
      return;
    }

    // Start polling for messages and status; keep all device cards updating (no need to expand)
    setMessagesPolling(true);
    fetchMonitorMessages();
    fetchMonitorStatus();
    // Fetch serial data for all devices immediately so cards show stats as soon as you're on Settings > Devices
    devices.forEach((device) => {
      if (device?.port) fetchSerialData(device.port);
    });

    // Poll every 2 seconds so Recordings/Uploaded/Refreshed keep updating on the page
    messagesPollTimerRef.current = setInterval(() => {
      fetchMonitorMessages();
      fetchMonitorStatus();
      devices.forEach((device) => {
        if (device?.port) fetchSerialData(device.port);
      });
    }, 2000);

    return () => {
      if (messagesPollTimerRef.current) {
        clearInterval(messagesPollTimerRef.current);
        messagesPollTimerRef.current = null;
      }
    };
  }, [enabled, fetchMonitorMessages, fetchMonitorStatus, fetchSerialData, devices]);


  const handleRefresh = async () => {
    if (!enabled) {
      setError('Enable Boondock Edge devices in Global settings to run discovery.');
      return;
    }

    setRefreshing(true);
    setError(null);
    try {
      const response = await api.post(`/recorders/refresh`);
      const deviceList = response.data?.devices || [];
      setDevices(deviceList);
      await loadConfigsForPorts(deviceList.map((device) => device.port), true);
      await fetchAllSerialPorts();
    } catch (err) {
      setError(err.response?.data?.message || 'Recorder discovery failed.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleFirmwareFileChange = (fileType, file) => {
    setFirmwareUploadModal((prev) => ({
      ...prev,
      files: { ...prev.files, [fileType]: file }
    }));
  };

  const handleUploadFirmware = async () => {
    if (!firmwareUploadModal.name.trim()) {
      setFirmwareUploadModal((prev) => ({ ...prev, error: 'Firmware name is required.' }));
      return;
    }

    const requiredFiles = ['bootloader.bin', 'partitions.bin', 'firmware.bin'];
    for (const fileType of requiredFiles) {
      if (!firmwareUploadModal.files[fileType]) {
        setFirmwareUploadModal((prev) => ({ ...prev, error: `Please select ${fileType}` }));
        return;
      }
    }

    setFirmwareUploadModal((prev) => ({ ...prev, uploading: true, error: null }));

    try {
      const formData = new FormData();
      formData.append('name', firmwareUploadModal.name);
      requiredFiles.forEach((fileType) => {
        formData.append(fileType, firmwareUploadModal.files[fileType]);
      });

      await api.post(`/recorders/firmware`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setNotification({ type: 'success', text: 'Firmware uploaded successfully.' });
      setFirmwareUploadModal({ open: false, name: '', files: {}, uploading: false, error: null });
      await fetchFirmwares();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to upload firmware.';
      setFirmwareUploadModal((prev) => ({ ...prev, uploading: false, error: message }));
    }
  };

  const handleDeleteRecorder = async (port) => {
    if (!window.confirm(`Are you sure you want to delete the recorder on port ${port}? This will stop monitoring and remove it from the inventory.`)) {
      return;
    }

    try {
      const response = await api.delete(`/recorders/devices/${encodeURIComponent(port)}`);
      if (response.data?.success) {
        setNotification({ type: 'success', message: response.data.message || `Recorder on port ${port} deleted successfully.` });
        // Refresh the device list
        await fetchDevices(false);
      } else {
        setNotification({ type: 'error', message: response.data?.message || 'Failed to delete recorder.' });
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to delete recorder.';
      setNotification({ type: 'error', message });
    }
  };

  const handleDeleteFirmware = async (firmwareId) => {
    if (!window.confirm('Are you sure you want to delete this firmware?')) {
      return;
    }

    try {
      await api.delete(`/recorders/firmware/${firmwareId}`);
      setNotification({ type: 'success', text: 'Firmware deleted successfully.' });
      await fetchFirmwares();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to delete firmware.';
      setNotification({ type: 'error', text: message });
    }
  };

  const handleEditFirmware = (firmware) => {
    setFirmwareEditModal({
      open: true,
      firmware,
      name: firmware.name || '',
      description: firmware.description || '',
      saving: false,
      error: null
    });
  };

  const handleSaveFirmwareEdit = async () => {
    if (!firmwareEditModal.firmware || !firmwareEditModal.name.trim()) {
      setFirmwareEditModal((prev) => ({ ...prev, error: 'Firmware name is required.' }));
      return;
    }

    setFirmwareEditModal((prev) => ({ ...prev, saving: true, error: null }));

    try {
      await api.put(`/recorders/firmware/${firmwareEditModal.firmware.id}`, {
        name: firmwareEditModal.name.trim(),
        description: firmwareEditModal.description.trim()
      });
      setNotification({ type: 'success', text: 'Firmware updated successfully.' });
      setFirmwareEditModal({ open: false, firmware: null, name: '', description: '', saving: false, error: null });
      await fetchFirmwares();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update firmware.';
      setFirmwareEditModal((prev) => ({ ...prev, saving: false, error: message }));
    }
  };

  const pollFlashProgress = useCallback(async (port) => {
    if (!port) return;

    try {
      const response = await api.get(`/recorders/flash/progress`, {
        params: { port }
      });
      const progress = response.data || {};
      setFlashProgress(progress);

      // If completed or failed, stop polling
      if (progress.status === 'completed' || progress.status === 'failed') {
        if (flashProgressTimerRef.current) {
          clearInterval(flashProgressTimerRef.current);
          flashProgressTimerRef.current = null;
        }
        clearDeviceBusyState(port);
        
        if (progress.status === 'completed') {
          setNotification({ type: 'success', text: 'Firmware flashed successfully!' });
        } else {
          setNotification({ type: 'error', text: progress.message || 'Flash operation failed.' });
        }
      }
    } catch (err) {
      console.error('Failed to poll flash progress:', err);
    }
  }, [clearDeviceBusyState]);

  const startProgressPolling = useCallback((port) => {
    // Clear any existing timer
    if (flashProgressTimerRef.current) {
      clearInterval(flashProgressTimerRef.current);
    }
    
    // Poll immediately
    pollFlashProgress(port);
    
    // Then poll every 500ms
    flashProgressTimerRef.current = setInterval(() => {
      pollFlashProgress(port);
    }, 500);
  }, [pollFlashProgress]);

  const stopProgressPolling = useCallback(() => {
    if (flashProgressTimerRef.current) {
      clearInterval(flashProgressTimerRef.current);
      flashProgressTimerRef.current = null;
    }
  }, []);

  const handleFlashFirmware = async () => {
    if (!flashModal.port || !flashModal.firmwareId) {
      setFlashModal((prev) => ({ ...prev, error: 'Port and firmware are required.' }));
      return;
    }

    setFlashModal((prev) => ({ ...prev, flashing: true, error: null }));
    setFlashProgress({ status: 'not_started', progress: 0, message: 'Starting flash operation...', output: '' });
    setDeviceBusyState(flashModal.port, 'flash');

    try {
      const response = await api.post(`/recorders/flash`, {
        port: flashModal.port,
        firmware_id: flashModal.firmwareId
      });

      // Start polling for progress
      startProgressPolling(flashModal.port);
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to start flash operation.';
      setFlashModal((prev) => ({ ...prev, flashing: false, error: message }));
      setFlashProgress({ status: 'failed', progress: 0, message: message, output: '' });
      setNotification({ type: 'error', text: message });
      clearDeviceBusyState(flashModal.port);
      stopProgressPolling();
    }
  };

  const handleCloseFlashModal = () => {
    stopProgressPolling();
    if (flashModal.port) {
      clearDeviceBusyState(flashModal.port);
    }
    setFlashModal({ open: false, port: null, firmwareId: '', flashing: false, error: null });
    setFlashProgress({ status: 'not_started', progress: 0, message: '', output: '' });
  };

  useEffect(() => {
    return () => {
      stopProgressPolling();
    };
  }, [stopProgressPolling]);

  const fetchStoredConfig = useCallback(async (port) => {
    try {
      const response = await api.get(`/recorders/config`, { params: { port } });
      const config = response.data?.config;
      if (config !== null && config !== undefined) {
        setConfigByPort((prev) => ({ ...prev, [port]: config }));
        return config;
      }
      return null;
    } catch (err) {
      if (err?.response?.status === 404) {
        setConfigByPort((prev) => {
          if (!(port in prev)) {
            return prev;
          }
          const next = { ...prev };
          delete next[port];
          return next;
        });
        return null;
      }
      throw err;
    }
  }, []);



  useEffect(() => {
    const dialog = firmwareUploadDialogRef.current;
    if (!dialog) return;
    if (firmwareUploadModal.open && !dialog.open) dialog.showModal();
    if (!firmwareUploadModal.open && dialog.open) dialog.close();
  }, [firmwareUploadModal.open]);

  useEffect(() => {
    const dialog = flashDialogRef.current;
    if (!dialog) return;
    if (flashModal.open && !dialog.open) dialog.showModal();
    if (!flashModal.open && dialog.open) dialog.close();
  }, [flashModal.open]);

  useEffect(() => {
    const dialog = firmwareEditDialogRef.current;
    if (!dialog) return;
    if (firmwareEditModal.open && !dialog.open) dialog.showModal();
    if (!firmwareEditModal.open && dialog.open) dialog.close();
  }, [firmwareEditModal.open]);


  return (
    <div className={`${cardStyles.card} ${cardStyles.compact}`}>
      <div className="rowBetween">
        <div className="row">
          <div className={`${cardStyles.card} ${cardStyles.compact}`}>
            <Cpu size={24} />
          </div>
          <div>
            <h2 className="pageTitle">Boondock Edge Recorders</h2>
            <p className="mutedText smallText">
              Enumerate Boondock Edge Devices over Serial Port.
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
        >
          <RefreshCw className={`iconSmall ${refreshing ? 'spin' : ''}`} />
          {refreshing ? 'Scanning…' : 'Refresh'}
        </button>
      </div>

      {!enabled && (
        <div className="row">
          <AlertCircle className="iconMedium" />
          <div>
            <h3 className={cardStyles.title}>Discovery Disabled</h3>
            <p className="mutedText smallText">
              Toggle <strong>Enable Boondock Edge devices</strong> in Global settings to enumerate ESP32 recorders.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className={`${noticeStyles.notice} ${noticeStyles.error}`}>
          {typeof error === 'string' ? error : (error?.message || String(error))}
        </div>
      )}

      {notification && (
        <div className={`${noticeStyles.notice} ${noticeStyles.error}`}>
          {notification.text}
        </div>
      )}

      {/* Monitor Messages Display */}
      {enabled && (
        <div className={cardStyles.card}>
          <div >
            <div className="rowBetween">
              <div>
                <h3 className={cardStyles.title}>
                  Serial Messages
                </h3>
                <p className="mutedText smallText">
                  Real-time messages from monitored devices
                </p>
              </div>
              {monitoredPorts.length > 0 && (
                <div >
                  <span>Monitoring:</span> {monitoredPorts.join(', ')}
                </div>
              )}
            </div>
          </div>
          
          {/* Command Buttons */}
          <div >
            <div className="rowWrap">
              <button
                onClick={handleRefreshDeviceData}
                disabled={sendingCommand || selectedPorts.length === 0}
                title="Fetch latest config and health data from selected devices (sends 'config ?' then 'health ?' after 5 seconds)"
                className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
              >
                <RefreshCw className={`iconSmall ${sendingCommand ? 'spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={handleReset}
                disabled={resetting || monitoredPorts.length === 0}
                title="Reconnect serial monitoring for all monitored devices (useful if connection is stuck)"
                className={`${buttonStyles.button} ${buttonStyles.warning} ${buttonStyles.medium}`}
              >
                <Usb className={`iconSmall ${resetting ? 'spin' : ''}`} />
                Reset
              </button>
              <button
                onClick={handleAutoConfig}
                disabled={sendingCommand || selectedPorts.length === 0}
                title="Set WiFi SSID/password, custom upload host/port, save, and reboot on selected devices (waits for device response after each command)"
                className={`${buttonStyles.button} ${buttonStyles.success} ${buttonStyles.medium}`}
              >
                <Zap className="iconSmall" />
                Auto Config
              </button>
              <button
                onClick={handleReboot}
                disabled={sendingCommand || selectedPorts.length === 0}
                title="Restart selected devices (sends 'reboot' command to trigger a full device restart)"
                className={`${buttonStyles.button} ${buttonStyles.danger} ${buttonStyles.medium}`}
              >
                <Power className="iconSmall" />
                Reboot
              </button>
            </div>
            
            {/* Command Input */}
            <div className="rowWrap">
              <input
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendCommand();
                  }
                }}
                placeholder="Enter custom command to send to selected ports..."
                disabled={sendingCommand || selectedPorts.length === 0}
                className={formStyles.input}
              />
              <button
                onClick={handleSendCommand}
                disabled={sendingCommand || !commandInput.trim() || selectedPorts.length === 0}
                className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
              >
                {sendingCommand ? 'Sending...' : 'Send'}
              </button>
            </div>
            
            {/* Port Filter */}
            {monitoredPorts.length > 0 && (
              <div>
                <label className={formStyles.label}>
                  Filter Ports (select ports to display messages):
                </label>
                <div className="rowWrap">
                  {monitoredPorts.map((port) => (
                    <label key={port} className={formStyles.checkbox}>
                      <input
                        type="checkbox"
                        checked={selectedPorts.includes(port)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPorts([...selectedPorts, port]);
                          } else {
                            setSelectedPorts(selectedPorts.filter(p => p !== port));
                          }
                        }}
                        
                      />
                      <span className="mutedText smallText">
                        {port}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Messages Display - Terminal Style */}
          <div className={tableStyles.scroll}>
            {monitorMessages
              .filter(msg => selectedPorts.length === 0 || selectedPorts.includes(msg.port))
              .slice()
              .reverse()
              .slice(0, 5)  // Show only latest 5 messages
              .map((msg, idx) => (
                <div
                  key={`${msg.port}-${msg.timestamp}-${idx}`}
                  
                >
                  <span className="pill pillAccent">{msg.port}</span>
                  <span className="mutedText smallText">::</span>
                  <span className="pill pillWarning">{msg.local_time}</span>
                  <span className="mutedText smallText">::</span>
                  <span className="pill pillSuccess">{msg.message}</span>
                </div>
              ))}
            {monitorMessages.filter(msg => selectedPorts.length === 0 || selectedPorts.includes(msg.port)).length === 0 && (
              <div className="centeredContent mutedText smallText">
                No messages to display. {selectedPorts.length === 0 ? 'Select ports to filter messages.' : 'Waiting for messages...'}
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="row">
          <span className="spinner spinnerSmall" aria-hidden="true" />
        </div>
      ) : (
        <div className="gridTwo">
          {devices.length === 0 ? (
            <div className={cardStyles.card}>
              No devices in inventory. Connect a device and refresh.
            </div>
          ) : (
            devices.map((device) => {
              // Find corresponding serial port info if available
              const port = allSerialPorts.find(p => p.port === device.port) || device;
              const isEsp32 = true; // All devices in inventory are ESP32 devices
              const busyStatus = deviceBusy[device.port];
              const disableActions = !enabled || Boolean(busyStatus);
              const config = configByPort[device.port];
              const firmware = typeof config?.firmware === 'string' ? config.firmware : '';
              const wifiNetworks = Array.isArray(config?.wifi) ? config.wifi : [];
              const primaryWifi = wifiNetworks.length > 0 && typeof wifiNetworks[0]?.ssid === 'string' ? wifiNetworks[0].ssid : '';
              const description = device.description || port.description || '';

              const status = deviceStatus[device.port] || {};
              const isRecording = status.record === true;
              const isUploading = status.upload === true;
              const audioData = status.audio || {};
              const minDb = audioData.minDb || -80;
              const maxDb = audioData.maxDb || 0;
              const currentDb = audioData.currentDb || -80;
              
              // Find channel by MAC address
              const macAddress = status.mac || status.config?.mac;
              const ipAddress = status.ip;
              const wifiStatus = status.wifi;
              const rssi = status.rssi;
              
              // Function to get RSSI rating
              const getRssiRating = (rssiValue) => {
                if (rssiValue === undefined || rssiValue === null) return null;
                if (rssiValue > -50) return 'Excellent';
                if (rssiValue > -70) return 'Good';
                if (rssiValue > -85) return 'Average';
                return 'Poor';
              };
              
              const rssiRating = getRssiRating(rssi);
              
              // Function to get Dynamic Range rating
              const getDynamicRangeRating = (dynamicValue) => {
                if (dynamicValue === undefined || dynamicValue === null) return null;
                if (dynamicValue > 80) return 'Clipping';
                if (dynamicValue >= 50) return 'Excellent';
                if (dynamicValue >= 20) return 'Good';
                if (dynamicValue >= 10) return 'Average';
                return 'Quiet';
              };
              
              // Calculate running average of dynamic range (last 5 readings)
              const history = dynamicRangeHistory[device.port] || [];
              const averageDynamicRange = history.length > 0
                ? history.reduce((sum, val) => sum + val, 0) / history.length
                : status.audio?.currentDynamic;
              
              const dynamicRangeRating = getDynamicRangeRating(averageDynamicRange);
              const matchedChannel = macAddress ? channels.find(ch => 
                (ch.mac && ch.mac.toUpperCase() === macAddress.toUpperCase()) ||
                (ch.mac_address && ch.mac_address.toUpperCase() === macAddress.toUpperCase())
              ) : null;
              
              // Calculate time since last update
              const lastUpdate = lastUpdateTime[device.port];
              const getTimeAgo = (timestamp) => {
                if (!timestamp) return 'Never';
                const seconds = Math.floor((Date.now() - timestamp) / 1000);
                if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
                const minutes = Math.floor(seconds / 60);
                if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
                const hours = Math.floor(minutes / 60);
                if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
                const days = Math.floor(hours / 24);
                return `${days} day${days !== 1 ? 's' : ''} ago`;
              };
              
              // Normalize audio levels for display (-80 dB to 20 dB range)
              const audioRange = 100; //  (100 dB span)
              const minPercent = Math.max(0, Math.min(100, ((minDb + 80) / audioRange) * 100));
              const maxPercent = Math.max(0, Math.min(100, ((maxDb + 80) / audioRange) * 100));
              const currentPercent = Math.max(0, Math.min(100, ((currentDb + 80) / audioRange) * 100));
              
              // Calculate threshold
              const threshold = status.threshold;
              let thresholdDb = null;
              let thresholdPercent = null;
              if (threshold !== undefined && typeof threshold === 'number') {
                thresholdDb = threshold - 80.0; // -80 to -20 dB range
                thresholdPercent = Math.max(0, Math.min(100, thresholdDb * 100));
              }

              return (
                <div key={device.port} className={`${cardStyles.card} ${cardStyles.compact}`}>
                {/* Compact Header with Uptime */}
                <div className="rowBetween">
                  <div className="row">
                    <div className={cardStyles.card}>
                      <Usb className="iconSmall" />
                    </div>
                    <div>
                      <h3 className={cardStyles.title}>{device.port}</h3>
                    </div>
                  </div>
                  
                  {/* Uptime - Center */}
                  {status.uptime !== undefined && (() => {
                    const totalSeconds = status.uptime;
                    const hours = Math.floor(totalSeconds / 3600);
                    const minutes = Math.floor((totalSeconds % 3600) / 60);
                    const seconds = totalSeconds % 60;
                    const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                    return (
                      <div className="row">
                        <div >
                          ⏱️ Uptime
                        </div>
                        <div >
                          {formattedTime}
                        </div>
                      </div>
                    );
                  })()}
                  
                  <div className="row">
                    {/* Permanent Recording Icon */}
                    <div className="row">
                      <Mic className="iconSmall" />
                    </div>
                    {/* Permanent Uploading Icon */}
                    <div className="row">
                      <UploadCloud className="iconSmall" />
                    </div>
                    {device.status && (
                      <span className="pill">
                        {device.status === 'available' ? '✅' : '⚠️'}
                      </span>
                    )}
                    {/* Delete Button */}
                    <button
                      onClick={() => handleDeleteRecorder(device.port)}
                      className={`${buttonStyles.button} ${buttonStyles.danger} ${buttonStyles.icon}`}
                      title={`Delete recorder on port ${device.port}`}
                    >
                      <Trash2 className="iconSmall" />
                    </button>
                  </div>
                </div>

                {/* Key Stats: rc = recording count, uc = uploaded count (DEVICE_SERIAL.md), td = total duration */}
                {(() => {
                  const healthData = getRecordingHealthBlock(serialData[device.port]);
                  const recordingCount = healthData?.rc !== undefined ? healthData.rc : (healthData?.tr !== undefined ? healthData.tr : status.recorded);
                  const uploadedCount = healthData?.uc !== undefined ? healthData.uc : (healthData?.tu !== undefined ? healthData.tu : status.uploaded);
                  const totalDurationSec = healthData?.td;
                  
                  // Format duration as HH:MM:SS
                  const formatDuration = (seconds) => {
                    if (seconds === undefined || seconds === null) return null;
                    const hrs = Math.floor(seconds / 3600);
                    const mins = Math.floor((seconds % 3600) / 60);
                    const secs = seconds % 60;
                    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                  };
                  
                  const formattedDuration = formatDuration(totalDurationSec);
                  
                  // Always show KPIs, display "-" when data is missing
                  return (
                    <div className="rowWrap">
                      <div className="row">
                        <div >
                          Recordings
                        </div>
                        <div >
                          {recordingCount !== undefined ? recordingCount : '-'}
                        </div>
                      </div>
                      <div className="row">
                        <div >
                          Uploaded
                        </div>
                        <div >
                          {uploadedCount !== undefined ? uploadedCount : '-'}
                        </div>
                      </div>
                      <div className="row">
                        <div >
                          Recording time
                        </div>
                        <div >
                          {formattedDuration || '-'}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Pending Upload Stats - Smaller font row below main stats */}
                {(() => {
                  const healthData = getRecordingHealthBlock(serialData[device.port]);
                  const uploadPending = healthData?.up;
                  
                  const totalPending = uploadPending?.tp;
                  const missedFiles = uploadPending?.mf;
                  const nvsQueue = uploadPending?.nq;
                  
                  // Only show if we have any pending upload data (excluding queue which is shown above)
                  if (totalPending === undefined && missedFiles === undefined && nvsQueue === undefined) {
                    return null;
                  }
                  
                  return (
                    <div className="row">
                      {totalPending !== undefined && (
                        <div className="row">
                          <span className="mutedText smallText">Pending:</span>
                          <span className="pill pillSuccess">
                            {totalPending}
                          </span>
                        </div>
                      )}
                      {missedFiles !== undefined && missedFiles > 0 && (
                        <div className="row">
                          <span className="mutedText smallText">Missed:</span>
                          <span className="pill pillDanger">
                            {missedFiles}
                          </span>
                        </div>
                      )}
                      {nvsQueue !== undefined && nvsQueue > 0 && (
                        <div className="row">
                          <span className="mutedText smallText">NVS:</span>
                          <span className="mutedText smallText">
                            {nvsQueue}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Device Identity - Compact */}
                {(status.firmware || macAddress || ipAddress || wifiStatus !== undefined || matchedChannel || lastUpdate || rebootCounts[device.port] !== undefined) && (
                  <div className={cardStyles.card}>
                    <div className="gridTwo">
                      {status.firmware && (
                        <div className="row">
                          <span>🔧</span>
                          <span>Firmware:</span>
                          <span className="pill pillAccent">{status.firmware}</span>
                        </div>
                      )}
                      {macAddress && (
                        <div className="row">
                          <span>🆔</span>
                          <span>MAC:</span>
                          <span className="pill pillAccent">{macAddress}</span>
                        </div>
                      )}
                      {ipAddress && (
                        <div className="row">
                          <span>🌐</span>
                          <span>IP:</span>
                          <span className="pill pillAccent">{ipAddress}</span>
                        </div>
                      )}
                      {wifiStatus !== undefined && (
                        <div className="row">
                          <span>📶</span>
                          <span>WiFi:</span>
                          {wifiStatus ? (
                            <span className="pill pillSuccess">
                              {rssiRating || 'Connected'}
                            </span>
                          ) : (
                            <span className="pill pillDanger">
                              Disconnected
                            </span>
                          )}
                        </div>
                      )}
                      {matchedChannel && (
                        <div className="row">
                          <span>📻</span>
                          <span>Channel:</span>
                          <span className="pill pillSuccess">{matchedChannel.name}</span>
                        </div>
                      )}
                      {rebootCounts[device.port] !== undefined && (
                        <div className="row">
                          <span>🔄</span>
                          <span>Reboots:</span>
                          <span className="pill pillWarning">{rebootCounts[device.port]}</span>
                        </div>
                      )}
                      {lastUpdate && (
                        <div className="row">
                          <span>🕐</span>
                          <span>Refreshed:</span>
                          <span className="mutedText smallText">{getTimeAgo(lastUpdate)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="stack">
                  {/* Audio Level Bar - Compact */}
                  {status.audio && Object.keys(status.audio).length > 0 && (minDb !== -80 || maxDb !== 0 || currentDb !== -80) && (
                    <div >
                      <div className="rowBetween">
                        <span className="mutedText tinyText">🔊 Audio Level</span>
                        <span className="mutedText tinyText">
                          {typeof currentDb === 'number' ? currentDb.toFixed(1) : 'N/A'} dB <span className="mutedText smallText">(min: {typeof minDb === 'number' ? minDb.toFixed(1) : 'N/A'}, max: {typeof maxDb === 'number' ? maxDb.toFixed(1) : 'N/A'})</span>
                        </span>
                      </div>
                      <div >
                        <div >
                          {/* Bar below threshold (gray) */}
                          {thresholdPercent !== null && (
                            <div
                              
                              style={{ width: `${Math.min(thresholdPercent, currentPercent)}%` }}
                            />
                          )}
                          {/* Bar above threshold (orange) */}
                          {thresholdPercent !== null && currentPercent > thresholdPercent ? (
                            <div
                              
                              style={{ 
                                left: `${thresholdPercent}%`,
                                width: `${currentPercent - thresholdPercent}%`
                              }}
                            />
                          ) : thresholdPercent === null ? (
                            // Fallback if no threshold: use old color logic
                            <div
                              
                              style={{ width: `${currentPercent}%` }}
                            />
                          ) : (
                            // Current dB is below threshold, show gray
                            <div
                              
                              style={{ width: `${currentPercent}%` }}
                            />
                          )}
                          {/* Threshold marker */}
                          {thresholdPercent !== null && (
                            <div
                              
                              style={{ left: `${thresholdPercent}%` }}
                            />
                          )}
                          {/* Current audio level marker */}
                          <div
                            
                            style={{ left: `${currentPercent}%` }}
                          />
                        </div>
                      </div>
                      {/* Threshold and Dynamic Range in one row */}
                      <div className="gridTwo">
                        {/* Threshold Setting */}
                        {threshold !== undefined && thresholdDb !== null && (
                          <div className="row">
                            <span className="mutedText smallText">Threshold:</span>
                            <span className="pill pillWarning">
                              {thresholdDb.toFixed(1)} dB ({threshold})
                            </span>
                          </div>
                        )}
                        {/* Dynamic Range Utilization */}
                        {(averageDynamicRange !== undefined && averageDynamicRange !== null) && (
                          <div className="row">
                            <span className="mutedText smallText">Dynamic Range:</span>
                            <span className="pill pillAccent">
                              {averageDynamicRange.toFixed(0)}%{dynamicRangeRating ? ` (${dynamicRangeRating})` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Device Status Info - Compact Grid */}
                  {(status.recorded !== undefined || status.uploaded !== undefined) && (
                    <div >
                      <div className="gridTwo">
                        {status.recorded !== undefined && (
                          <div className="row">
                            <span>💾</span>
                            <span>Recorded:</span>
                            <span className="pill pillAccent">{status.recorded}</span>
                          </div>
                        )}
                        {status.uploaded !== undefined && (
                          <div className="row">
                            <span>☁️</span>
                            <span>Uploaded:</span>
                            <span className="pill pillAccent">{status.uploaded}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Connectivity & Resources - Compact */}
                      <div className="stack">
                        
                        {status.sdFree !== undefined && status.sdFree !== null && typeof status.sdFree === 'number' && (
                          <div className="row">
                            <span>💿</span>
                            <span>SD Free:</span>
                            <span className="pill pillSuccess">
                              {status.sdFree.toFixed(1)}%
                            </span>
                          </div>
                        )}
                        
                        {status.heap && status.heap.free !== undefined && status.heap.free !== null && status.heap.total !== undefined && status.heap.total !== null && typeof status.heap.free === 'number' && typeof status.heap.total === 'number' && status.heap.total > 0 && (
                          <div className="row">
                            <span>🧠</span>
                            <span>Heap:</span>
                            <span className="pill pillAccent">
                              {(status.heap.free / 1024).toFixed(0)}KB / {(status.heap.total / 1024).toFixed(0)}KB
                            </span>
                            <div className={cardStyles.card}>
                              <div 
                                
                                style={{ width: `${(status.heap.free / status.heap.total) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}
                        
                        {status.recordings && (
                          <div className="row">
                            <span>📼</span>
                            <span>Recordings:</span>
                            <span className="pill pillAccent">{status.recordings.total}</span>
                            {(status.recordings.error || 0) > 0 && (
                              <span className="pill pillDanger">
                                ({status.recordings.error} errors ⚠️)
                              </span>
                            )}
                          </div>
                        )}
                        
                        {status.api && (
                          <div className="row">
                            <span>{status.api.dead ? '💀' : '✅'}</span>
                            <span>API:</span>
                            <span className="pill pillSuccess">
                              {status.api.dead ? 'Dead' : 'Alive'}
                            </span>
                            <span className="mutedText smallText">
                              ({status.api.Events || 0} events, {status.api.Uploads || 0} uploads)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Controls - Compact */}
                  <div className="rowBetween">
                    <button
                      onClick={() => {
                        const isExpanding = !expandedDevices[device.port];
                        setExpandedDevices(prev => ({
                          ...prev,
                          [device.port]: isExpanding
                        }));
                        // Fetch reboot history and serial data when expanding
                        if (isExpanding) {
                          const macAddress = status.mac || status.config?.mac;
                          fetchRebootHistory(device.port, macAddress);
                          fetchSerialData(device.port);
                        }
                      }}
                      className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
                    >
                      <Info className="iconSmall" />
                      More
                      {expandedDevices[device.port] ? (
                        <ChevronUp className="iconSmall" />
                      ) : (
                        <ChevronDown className="iconSmall" />
                      )}
                    </button>
                    <button
                      onClick={() => setFlashModal({ open: true, port: device.port, firmwareId: '', flashing: false, error: null })}
                      disabled={disableActions || firmwares.length === 0}
                      className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
                    >
                      <Zap className="iconSmall" />
                      {busyStatus === 'flash' ? 'Flashing…' : 'Flash Firmware'}
                    </button>
                  </div>
                  
                  {/* Expanded Details Section */}
                  {expandedDevices[device.port] && (
                    <div >
                      <div className={`${cardStyles.card} ${cardStyles.compact}`}>
                        <h4 className={cardStyles.title}>Device Details</h4>
                        
                        {/* Storage Information */}
                        {(status.storage || status.sd !== undefined || status.sdUsed !== undefined || status.sdTotal !== undefined) && (
                          <div >
                            <h5 className={cardStyles.title}>
                              <span>💿</span> Storage
                            </h5>
                            <div className="gridTwo">
                              {typeof status.storage === 'string' && status.storage && (
                                <div>
                                  <span className="mutedText smallText">Type:</span>
                                  <span>{status.storage}</span>
                                </div>
                              )}
                              {status.sd !== undefined && (
                                <div>
                                  <span className="mutedText smallText">SD Available:</span>
                                  <span className="pill pillSuccess">
                                    {status.sd ? 'Yes' : 'No'}
                                  </span>
                                </div>
                              )}
                              {status.sdTotal !== undefined && (
                                <div>
                                  <span className="mutedText smallText">SD Size:</span>
                                  <span>{status.sdTotal}</span>
                                </div>
                              )}
                              {status.sdUsed !== undefined && (
                                <div>
                                  <span className="mutedText smallText">SD Used:</span>
                                  <span>{status.sdUsed}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Memory Information */}
                        {(status.heapTotal !== undefined || status.heapUsed !== undefined || status.heapMin !== undefined || status.heapBlock !== undefined || status.psramTotal !== undefined || status.psramUsed !== undefined) && (
                          <div >
                            <h5 className={cardStyles.title}>
                              <span>🧠</span> Memory
                            </h5>
                            <div className="gridTwo">
                              {status.heapTotal !== undefined && (
                                <div>
                                  <span className="mutedText smallText">Heap Total:</span>
                                  <span>{status.heapTotal}</span>
                                </div>
                              )}
                              {status.heapUsed !== undefined && (
                                <div>
                                  <span className="mutedText smallText">Heap Used:</span>
                                  <span>{status.heapUsed}</span>
                                </div>
                              )}
                              {status.heapMin !== undefined && (
                                <div>
                                  <span className="mutedText smallText">Heap Min Free:</span>
                                  <span>{status.heapMin}</span>
                                </div>
                              )}
                              {status.heapBlock !== undefined && (
                                <div>
                                  <span className="mutedText smallText">Largest Heap Block:</span>
                                  <span>{status.heapBlock}</span>
                                </div>
                              )}
                              {status.psramTotal !== undefined && (
                                <div>
                                  <span className="mutedText smallText">PSRAM Total:</span>
                                  <span>{status.psramTotal}</span>
                                </div>
                              )}
                              {status.psramUsed !== undefined && (
                                <div>
                                  <span className="mutedText smallText">PSRAM Used:</span>
                                  <span>{status.psramUsed}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* System Information */}
                        {(status.timeSet !== undefined || status.rtcEnabled !== undefined || status.currentTime || status.epochTime !== undefined || status.lastRecordingTime !== undefined || status.lastRecordingStart) && (
                          <div >
                            <h5 className={cardStyles.title}>
                              <span>⏰</span> System
                            </h5>
                            <div className="gridTwo">
                              {status.timeSet !== undefined && (
                                <div>
                                  <span className="mutedText smallText">Time Set:</span>
                                  <span className="pill pillSuccess">
                                    {status.timeSet ? 'Yes' : 'No'}
                                  </span>
                                </div>
                              )}
                              {status.rtcEnabled !== undefined && (
                                <div>
                                  <span className="mutedText smallText">RTC Enabled:</span>
                                  <span className="pill pillSuccess">
                                    {status.rtcEnabled ? 'Yes' : 'No'}
                                  </span>
                                </div>
                              )}
                              {status.currentTime && (
                                <div>
                                  <span className="mutedText smallText">Current Time:</span>
                                  <span>{new Date(status.currentTime).toLocaleString()}</span>
                                </div>
                              )}
                              {status.epochTime !== undefined && (
                                <div>
                                  <span className="mutedText smallText">Epoch Time:</span>
                                  <span>{status.epochTime}</span>
                                </div>
                              )}
                              {status.lastRecordingTime !== undefined && (
                                <div>
                                  <span className="mutedText smallText">Last Recording:</span>
                                  <span>{status.lastRecordingTime}s ago</span>
                                </div>
                              )}
                              {status.lastRecordingStart && (
                                <div>
                                  <span className="mutedText smallText">Last Recording Start:</span>
                                  <span>{new Date(status.lastRecordingStart).toLocaleString()}</span>
                                </div>
                              )}
                              {status.lastRecordingDuration !== undefined && (
                                <div>
                                  <span className="mutedText smallText">Last Recording Duration:</span>
                                  <span>{status.lastRecordingDuration}s</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Configuration Settings - Using Serial Data */}
                        {(() => {
                          const configData = serialData[device.port]?.config;
                          const wifiConfig = configData?.wifi?.data;
                          const audioConfig = configData?.audio?.data;
                          const otherConfig = configData?.other?.data;
                          const mergedConfig = configData?.data || {};
                          const m = mergedConfig;
                          const ss = wifiConfig?.ss ?? m.ss;
                          const ho = wifiConfig?.ho ?? m.ho;
                          const po = wifiConfig?.po ?? m.po;
                          const ath = m.ath ?? audioConfig?.se;
                          const mrm = m.mrm ?? audioConfig?.mi;
                          const xrm = m.xrm ?? audioConfig?.mx;
                          const stm = m.stm ?? audioConfig?.sth;
                          const prm = m.prm ?? audioConfig?.pr;
                          const cg = m.cg ?? audioConfig?.gn;
                          const usc = otherConfig?.usc ?? m.usc;
                          const rsc = otherConfig?.rsc ?? m.rsc;
                          const rte = otherConfig?.rte ?? m.rte;
                          const oh = otherConfig?.oh ?? m.oh;
                          const wtp = wifiConfig?.tx ?? m.wtp;
                          const hasConfig =
                            wifiConfig ||
                            audioConfig ||
                            otherConfig ||
                            configData?.recorder ||
                            configData?.general ||
                            Object.keys(mergedConfig).length > 0;
                          if (!hasConfig) return null;
                          return (
                            <div >
                              <h5 className={cardStyles.title}>
                                <span>⚙️</span> Configuration Settings
                              </h5>
                              <div className="stack">
                                {(wifiConfig ||
                                  ss ||
                                  ho ||
                                  po !== undefined ||
                                  m.sie !== undefined ||
                                  wtp !== undefined ||
                                  m.we !== undefined ||
                                  m.ue !== undefined ||
                                  m.ste !== undefined ||
                                  m.sp !== undefined ||
                                  wifiConfig?.ip ||
                                  m.ip ||
                                  wifiConfig?.gw ||
                                  m.gw) && (
                                  <div className={cardStyles.card}>
                                    <div >📶 WiFi & Network</div>
                                    <div className="gridTwo">
                                      {ss && <div>SSID: {ss}</div>}
                                      {wifiConfig?.pw && <div>Password: {wifiConfig.pw === '***' ? '*** (hidden)' : 'Set'}</div>}
                                      {wifiConfig?.ct !== undefined && <div>Connect Timeout: {wifiConfig.ct} ms</div>}
                                      {wifiConfig?.sip && <div>Saved Static IP: {wifiConfig.sip}</div>}
                                      {ho && <div>API Host: {ho}</div>}
                                      {po !== undefined && po !== null && <div>API Port: {po}</div>}
                                      {m.sie !== undefined && <div>Static IP enabled: {m.sie ? 'Yes' : 'No'}</div>}
                                      {wtp !== undefined && <div>WiFi TX power: {wtp}/10</div>}
                                      {wifiConfig?.we !== undefined && <div>WiFi Enabled: {wifiConfig.we ? 'Yes' : 'No'}</div>}
                                      {wifiConfig?.ue !== undefined && <div>Upload Enabled: {wifiConfig.ue ? 'Yes' : 'No'}</div>}
                                      {wifiConfig?.ste !== undefined && <div>Stream Enabled: {wifiConfig.ste ? 'Yes' : 'No'}</div>}
                                      {wifiConfig?.sp !== undefined && <div>Stream Port: {wifiConfig.sp}</div>}
                                      {(wifiConfig?.ip || m.ip) && <div>Current IP: {wifiConfig?.ip || m.ip}</div>}
                                      {(wifiConfig?.gw || m.gw) && <div>Gateway: {wifiConfig?.gw || m.gw}</div>}
                                      {(wifiConfig?.sn || m.sn) && <div>Subnet: {wifiConfig?.sn || m.sn}</div>}
                                      {(wifiConfig?.dn1 || m.dn1) && <div>DNS1: {wifiConfig?.dn1 || m.dn1}</div>}
                                      {(wifiConfig?.dn2 || m.dn2) && <div>DNS2: {wifiConfig?.dn2 || m.dn2}</div>}
                                    </div>
                                  </div>
                                )}
                                {(audioConfig ||
                                  m.is !== undefined ||
                                  m.bs !== undefined ||
                                  ath !== undefined ||
                                  prm !== undefined ||
                                  mrm !== undefined ||
                                  xrm !== undefined ||
                                  stm !== undefined ||
                                  m.ds !== undefined ||
                                  m.dsm !== undefined ||
                                  cg !== undefined) && (
                                  <div className={cardStyles.card}>
                                    <div >🔊 Audio / Recorder</div>
                                    <div className="gridTwo">
                                      {(audioConfig?.is ?? m.is) !== undefined && (
                                        <div>Sample Rate: {audioConfig?.is ?? m.is} Hz</div>
                                      )}
                                      {audioConfig?.bs !== undefined && <div>Buffer Samples: {audioConfig.bs}</div>}
                                      {ath !== undefined && (
                                        <div>
                                          Audio threshold:{' '}
                                          {typeof ath === 'number' ? ath.toFixed(1) : ath} dB
                                        </div>
                                      )}
                                      {prm !== undefined && <div>Pre-record: {prm} ms</div>}
                                      {mrm !== undefined && <div>Min recording: {mrm} ms</div>}
                                      {xrm !== undefined && <div>Max recording: {xrm} ms</div>}
                                      {stm !== undefined && <div>Silence threshold: {stm} ms</div>}
                                      {cg !== undefined && <div>Codec gain: {cg} dB</div>}
                                      {audioConfig?.ds !== undefined && (
                                        <div>Discard Small Files: {audioConfig.ds ? 'Yes' : 'No'}</div>
                                      )}
                                      {audioConfig?.dsm !== undefined && (
                                        <div>Min File Size: {audioConfig.dsm} ms</div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {(usc !== undefined ||
                                  rsc !== undefined ||
                                  otherConfig?.scm !== undefined ||
                                  otherConfig?.scf !== undefined ||
                                  otherConfig?.scff !== undefined) && (
                                  <div className={cardStyles.card}>
                                    <div >💿 Storage & SD Card</div>
                                    <div className="gridTwo">
                                      {usc !== undefined && <div>Use SD Card: {usc ? 'Yes' : 'No'}</div>}
                                      {rsc !== undefined && <div>Record to SD: {rsc ? 'Yes' : 'No'}</div>}
                                      {otherConfig?.scm !== undefined && (
                                        <div>SD Mode: {otherConfig.scm ? '1-bit' : '4-bit'}</div>
                                      )}
                                      {otherConfig?.scf !== undefined && (
                                        <div>SD Frequency: {(otherConfig.scf / 1000000).toFixed(1)} MHz</div>
                                      )}
                                      {otherConfig?.scff !== undefined && (
                                        <div>Format on Fail: {otherConfig.scff ? 'Yes' : 'No'}</div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {(otherConfig?.rts !== undefined ||
                                  otherConfig?.rtc !== undefined ||
                                  rte !== undefined ||
                                  oh !== undefined ||
                                  otherConfig?.tmh !== undefined ||
                                  otherConfig?.tmm !== undefined) && (
                                  <div className={cardStyles.card}>
                                    <div >⏰ RTC & Timezone</div>
                                    <div className="gridTwo">
                                      {rte !== undefined && <div>RTC Enabled: {rte ? 'Yes' : 'No'}</div>}
                                      {otherConfig?.rts !== undefined && (
                                        <div>RTC SDA Pin: {otherConfig.rts}</div>
                                      )}
                                      {otherConfig?.rtc !== undefined && (
                                        <div>RTC SCL Pin: {otherConfig.rtc}</div>
                                      )}
                                      {oh !== undefined && (
                                        <div>
                                          UTC Offset: {oh >= 0 ? '+' : ''}
                                          {oh} hours
                                        </div>
                                      )}
                                      {otherConfig?.tmh !== undefined && otherConfig?.tmm !== undefined && (
                                        <div>
                                          Maintenance: {String(otherConfig.tmh).padStart(2, '0')}:
                                          {String(otherConfig.tmm).padStart(2, '0')}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {/* System & Firmware */}
                                {(otherConfig?.fw || mergedConfig.fw) && (
                                  <div className={cardStyles.card}>
                                    <div >🔧 System</div>
                                    <div className="gridTwo">
                                      {(otherConfig?.fw || mergedConfig.fw) && <div>Firmware: {otherConfig?.fw || mergedConfig.fw}</div>}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Logging Settings */}
                                {(otherConfig?.lsf !== undefined || otherConfig?.lse !== undefined || otherConfig?.lsw !== undefined || otherConfig?.lsi !== undefined || otherConfig?.lsd !== undefined || otherConfig?.lsev !== undefined || otherConfig?.lff !== undefined || otherConfig?.lfe !== undefined || otherConfig?.lfw !== undefined || otherConfig?.lfi !== undefined || otherConfig?.lfd !== undefined || otherConfig?.lfev !== undefined) && (
                                  <div className={cardStyles.card}>
                                    <div >📝 Logging Settings</div>
                                    <div className="stack">
                                      <div className="gridTwo">
                                        <div >Serial Logging:</div>
                                        <div></div>
                                        {otherConfig?.lsf !== undefined && <div>Fatal: {otherConfig.lsf ? 'On' : 'Off'}</div>}
                                        {otherConfig?.lse !== undefined && <div>Error: {otherConfig.lse ? 'On' : 'Off'}</div>}
                                        {otherConfig?.lsw !== undefined && <div>Warning: {otherConfig.lsw ? 'On' : 'Off'}</div>}
                                        {otherConfig?.lsi !== undefined && <div>Info: {otherConfig.lsi ? 'On' : 'Off'}</div>}
                                        {otherConfig?.lsd !== undefined && <div>Debug: {otherConfig.lsd ? 'On' : 'Off'}</div>}
                                        {otherConfig?.lsev !== undefined && <div>Event: {otherConfig.lsev ? 'On' : 'Off'}</div>}
                                      </div>
                                      <div className="gridTwo">
                                        <div >File Logging:</div>
                                        <div></div>
                                        {otherConfig?.lff !== undefined && <div>Fatal: {otherConfig.lff ? 'On' : 'Off'}</div>}
                                        {otherConfig?.lfe !== undefined && <div>Error: {otherConfig.lfe ? 'On' : 'Off'}</div>}
                                        {otherConfig?.lfw !== undefined && <div>Warning: {otherConfig.lfw ? 'On' : 'Off'}</div>}
                                        {otherConfig?.lfi !== undefined && <div>Info: {otherConfig.lfi ? 'On' : 'Off'}</div>}
                                        {otherConfig?.lfd !== undefined && <div>Debug: {otherConfig.lfd ? 'On' : 'Off'}</div>}
                                        {otherConfig?.lfev !== undefined && <div>Event: {otherConfig.lfev ? 'On' : 'Off'}</div>}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                        
                        {/* Short Status Message */}
                        {serialData[device.port]?.short?.data && (() => {
                          const shortData = serialData[device.port].short.data;
                          return (
                            <div >
                              <h5 className={cardStyles.title}>
                                <span>📡</span> Short Status (Latest)
                              </h5>
                              <div className={cardStyles.card}>
                                <div className="gridTwo">
                                  {shortData.tm && <div>Timestamp: {shortData.tm}</div>}
                                  {shortData.mc && <div>MAC: {shortData.mc}</div>}
                                  {shortData.si && <div>Session ID: {shortData.si}</div>}
                                  {shortData.rg !== undefined && <div>Recording: {shortData.rg ? 'Active' : 'Inactive'}</div>}
                                  {shortData.ug !== undefined && <div>Uploading: {shortData.ug ? 'Yes' : 'No'}</div>}
                                  {shortData.cd !== undefined && (
                                    <div>Current dB: {Number(shortData.cd).toFixed(1)}</div>
                                  )}
                                  {shortData.mi !== undefined && <div>Min dB: {shortData.mi.toFixed(1)}</div>}
                                  {shortData.mx !== undefined && <div>Max dB: {shortData.mx.toFixed(1)}</div>}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                        
                        {/* Audio Details */}
                        {status.audio && Object.keys(status.audio).length > 0 && (
                          <div >
                            <h5 className={cardStyles.title}>
                              <span>🔊</span> Audio Details
                            </h5>
                            <div className="gridTwo">
                              {status.audio.currentDb !== undefined && (
                                <div>
                                  <span className="mutedText smallText">Current dB:</span>
                                  <span>{status.audio.currentDb.toFixed(2)} dB</span>
                                </div>
                              )}
                              {status.audio.minDb !== undefined && (
                                <div>
                                  <span className="mutedText smallText">Min dB:</span>
                                  <span>{status.audio.minDb.toFixed(2)} dB</span>
                                </div>
                              )}
                              {status.audio.maxDb !== undefined && (
                                <div>
                                  <span className="mutedText smallText">Max dB:</span>
                                  <span>{status.audio.maxDb.toFixed(2)} dB</span>
                                </div>
                              )}
                              {status.audio.avgDb !== undefined && (
                                <div>
                                  <span className="mutedText smallText">Avg dB:</span>
                                  <span>{status.audio.avgDb.toFixed(2)} dB</span>
                                </div>
                              )}
                              {status.audio.currentDynamic !== undefined && (
                                <div>
                                  <span className="mutedText smallText">Dynamic Range:</span>
                                  <span>{status.audio.currentDynamic.toFixed(2)}%</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Health Metrics — DEVICE_SERIAL: system + recording objects; legacy flat fallback */}
                        {serialData[device.port]?.health && (() => {
                          const blk = serialData[device.port];
                          const sys = getSystemHealthBlock(blk);
                          const recH = getRecordingHealthBlock(blk);
                          const raw = blk.health?.data && typeof blk.health.data === 'object' ? blk.health.data : {};
                          const health = recH || raw;
                          const r = recH || (!sys ? health : {});
                          const fmtUptime = (sec) =>
                            sec == null
                              ? null
                              : `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m ${sec % 60}s`;
                          return (
                          <div >
                            <h5 className={cardStyles.title}>
                              <span>📊</span> Health Metrics
                            </h5>
                            <div className="stack">
                              {sys && (
                                <div className={cardStyles.card}>
                                  <div >System health</div>
                                  <div className="gridTwo">
                                    {typeof sys.st === 'string' && <div>Storage: {sys.st}</div>}
                                    {sys.sd !== undefined && <div>SD in use: {sys.sd ? 'Yes' : 'No'}</div>}
                                    {sys.ht && <div>Heap total: {sys.ht}</div>}
                                    {sys.hf && <div>Heap free: {sys.hf}</div>}
                                    {sys.tv !== undefined && <div>Time valid: {sys.tv ? 'Yes' : 'No'}</div>}
                                    {sys.wi !== undefined && <div>WiFi: {sys.wi ? 'Connected' : 'No'}</div>}
                                    {sys.ip !== undefined && sys.ip !== '' && <div>IP: {sys.ip}</div>}
                                    {sys.ri !== undefined && <div>RSSI: {sys.ri} dBm</div>}
                                    {sys.ut !== undefined && <div>Uptime: {fmtUptime(sys.ut)}</div>}
                                  </div>
                                </div>
                              )}
                              {(r.rc != null ||
                                r.uc != null ||
                                r.pq != null ||
                                r.td != null ||
                                r.tr != null ||
                                r.tu != null) && (
                                <div className={cardStyles.card}>
                                  <div >Recording session</div>
                                  <div className="gridTwo">
                                    {r.rc != null && <div>Recording count: {r.rc}</div>}
                                    {r.uc != null && <div>Uploaded: {r.uc}</div>}
                                    {r.pq != null && <div>Pending queue: {r.pq}</div>}
                                    {r.tr != null && r.rc == null && <div>Recordings (legacy): {r.tr}</div>}
                                    {r.tu != null && r.uc == null && <div>Uploaded (legacy): {r.tu}</div>}
                                    {r.td != null && (
                                      <div>
                                        Session duration: {fmtUptime(r.td) || `${r.td}s`}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              {(r.am != null || r.ax != null || r.aa != null) && (
                                <div className={cardStyles.card}>
                                  <div >API response (ms)</div>
                                  <div className="gridTwo">
                                    {r.am != null && <div>Min: {r.am}</div>}
                                    {r.ax != null && <div>Max: {r.ax}</div>}
                                    {r.aa != null && <div>Avg: {typeof r.aa === 'number' ? r.aa.toFixed(1) : r.aa}</div>}
                                  </div>
                                </div>
                              )}
                              {Array.isArray(r.st) && r.st.length > 0 && (
                                <div className={cardStyles.card}>
                                  <div >Task stacks</div>
                                  <div className="stack">
                                    {r.st.map((t, idx) => {
                                      const name = typeof t.n === 'object' ? JSON.stringify(t.n) : (t.n ?? '');
                                      const alloc = typeof t.a === 'object' ? JSON.stringify(t.a) : (t.a ?? '');
                                      const free = typeof t.f === 'object' ? JSON.stringify(t.f) : (t.f ?? '');
                                      const util = typeof t.u === 'object' ? JSON.stringify(t.u) : (t.u ?? '');
                                      return (
                                        <div key={idx}>
                                          {name}: alloc {alloc}, free {free}, util {util}%
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              {!sys && (health.ht || health.hf) && (
                                <div className={cardStyles.card}>
                                  <div >Memory</div>
                                  <div className="gridTwo">
                                    {health.ht && <div>Heap Total: {health.ht}</div>}
                                    {health.hf && <div>Heap Free: {health.hf}</div>}
                                  </div>
                                </div>
                              )}
                              {(health.tv !== undefined || health.rt || (health.ut && !sys) || health.rs !== undefined || health.rd !== undefined) && (
                                      <div className={cardStyles.card}>
                                        <div >System Time & Recent Activity</div>
                                        <div className="gridTwo">
                                          {health.tv !== undefined && <div>Time Valid: {health.tv ? 'Yes' : 'No'}</div>}
                                          {health.rt && <div>Recent Recording: {health.rt}</div>}
                                          {health.ut && !sys && typeof health.ut === 'string' && <div>Recent Upload: {health.ut}</div>}
                                          {health.rs !== undefined && <div>Last Recording Size: {(health.rs / 1024).toFixed(1)} KB</div>}
                                          {health.rd !== undefined && <div>Last Recording Duration: {health.rd}s</div>}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Queue Metrics */}
                                    {health.qm && (
                                      <div className={cardStyles.card}>
                                        <div >Queue</div>
                                        <div className="gridTwo">
                                          {health.qm.mx !== undefined && <div>Max: {health.qm.mx}</div>}
                                          {health.qm.av !== undefined && <div>Avg: {health.qm.av.toFixed(2)}</div>}
                                          {health.qm.fl !== undefined && <div>Full: {health.qm.fl}</div>}
                                          {health.qm.rq !== undefined && <div>Requeue: {health.qm.rq}</div>}
                                        </div>
                                      </div>
                                    )}
                                    {/* Network Quality */}
                                    {health.nq && (
                                      <div className={cardStyles.card}>
                                        <div >Network Quality</div>
                                        <div className="gridTwo">
                                          {health.nq.ar !== undefined && <div>Avg RSSI: {health.nq.ar.toFixed(1)} dBm</div>}
                                          {health.nq.mr !== undefined && <div>Min RSSI: {health.nq.mr} dBm</div>}
                                          {health.nq.xr !== undefined && <div>Max RSSI: {health.nq.xr} dBm</div>}
                                          {health.nq.pl !== undefined && <div>Packet Loss: {health.nq.pl.toFixed(1)}%</div>}
                                        </div>
                                      </div>
                                    )}
                                    {/* Storage Health */}
                                    {health.sh && (
                                      <div className={cardStyles.card}>
                                        <div >Storage Health</div>
                                        <div className="gridTwo">
                                          {health.sh.ut !== undefined && <div>Utilization: {health.sh.ut.toFixed(2)}%</div>}
                                          {health.sh.we !== undefined && <div>Write Errors: {health.sh.we}</div>}
                                          {health.sh.re !== undefined && <div>Read Errors: {health.sh.re}</div>}
                                          {health.sh.ms !== undefined && <div>Mount Stable: {health.sh.ms ? 'Yes' : 'No'}</div>}
                                        </div>
                                      </div>
                                    )}
                                    {/* Mutex Metrics */}
                                    {health.mm && (
                                      <div className={cardStyles.card}>
                                        <div >Mutex Metrics</div>
                                        <div className="gridTwo">
                                          {health.mm.at !== undefined && <div>Attempts: {health.mm.at}</div>}
                                          {health.mm.to !== undefined && <div>Timeouts: {health.mm.to}</div>}
                                          {health.mm.rt !== undefined && <div>Timeout Rate: {health.mm.rt.toFixed(2)}%</div>}
                                          {health.mm.cs !== undefined && <div>Consecutive: {health.mm.cs}</div>}
                                        </div>
                                      </div>
                                    )}
                                    {/* NVS Health */}
                                    {health.nv && (
                                      <div className={cardStyles.card}>
                                        <div >NVS Health</div>
                                        <div className="gridTwo">
                                          {health.nv.rd !== undefined && <div>Reads: {health.nv.rd}</div>}
                                          {health.nv.wr !== undefined && <div>Writes: {health.nv.wr}</div>}
                                          {health.nv.re !== undefined && <div>Read Errors: {health.nv.re}</div>}
                                          {health.nv.we !== undefined && <div>Write Errors: {health.nv.we}</div>}
                                          {health.nv.mt !== undefined && <div>Mutex Timeouts: {health.nv.mt}</div>}
                                        </div>
                                      </div>
                                    )}
                                    {/* Upload Queue Health */}
                                    {health.uq && (
                                      <div className={cardStyles.card}>
                                        <div >Upload Queue Health</div>
                                        <div className="gridTwo">
                                          {health.uq.ad !== undefined && <div>Adds: {health.uq.ad}</div>}
                                          {health.uq.rm !== undefined && <div>Removes: {health.uq.rm}</div>}
                                          {health.uq.fa !== undefined && <div>Failed Adds: {health.uq.fa}</div>}
                                          {health.uq.fr !== undefined && <div>Failed Removes: {health.uq.fr}</div>}
                                          {health.uq.we !== undefined && <div>Write Errors: {health.uq.we}</div>}
                                          {health.uq.re !== undefined && <div>Read Errors: {health.uq.re}</div>}
                                        </div>
                                      </div>
                                    )}
                                    {/* Upload Rate */}
                                    {health.ur && (
                                      <div className={cardStyles.card}>
                                        <div >Upload Rate</div>
                                        <div className="gridTwo">
                                          {health.ur.ov !== undefined && health.ur.ov >= 0 && <div>Success Rate: {health.ur.ov.toFixed(1)}%</div>}
                                          {health.ur.at !== undefined && <div>Attempts: {health.ur.at}</div>}
                                          {health.ur.sc !== undefined && <div>Success: {health.ur.sc}</div>}
                                        </div>
                                      </div>
                                    )}
                                    {/* Endpoint Health */}
                                    {health.endpoints && Array.isArray(health.endpoints) && health.endpoints.length > 0 && (
                                      <div className={cardStyles.card}>
                                        <div >Endpoint Health</div>
                                        <div className="stack">
                                          {health.endpoints.map((endpoint, idx) => (
                                            <div key={idx} >
                                              <div >{endpoint.ho || 'Unknown'}</div>
                                              <div className="gridTwo">
                                                {endpoint.sr !== undefined && endpoint.sr >= 0 && (
                                                  <div>Success Rate: {endpoint.sr.toFixed(1)}%</div>
                                                )}
                                                {endpoint.sc !== undefined && <div>Success: {endpoint.sc}</div>}
                                                {endpoint.tt !== undefined && <div>Total: {endpoint.tt}</div>}
                                                {endpoint.hs !== undefined && <div>Health Score: {endpoint.hs.toFixed(2)}</div>}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {/* Task Health */}
                                    {health.th && (
                                      <div className={cardStyles.card}>
                                        <div >Task Health</div>
                                        <div className="stack">
                                          {Object.entries(health.th).map(([taskName, taskData]) => (
                                            <div key={taskName} >
                                              <span>{taskName}:</span>
                                              {' '}
                                              {taskData.rn ? 'Running' : 'Stopped'}
                                              {taskData.ut !== undefined && ` (${taskData.ut.toFixed(1)}% stack)`}
                                              {taskData.rs !== undefined && taskData.rs > 0 && ` - ${taskData.rs} restarts`}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {/* Upload Pending Metrics */}
                                    {health.up && (
                                      <div className={cardStyles.card}>
                                        <div >Upload Pending</div>
                                        <div className="gridTwo">
                                          {health.up.tp !== undefined && <div>Total Pending: <span className={health.up.tp > 0 ? 'pill pillWarning' : ''}>{health.up.tp}</span></div>}
                                          {health.up.fq !== undefined && <div>FreeRTOS Queue: {health.up.fq}</div>}
                                          {health.up.nq !== undefined && <div>NVS Queue: {health.up.nq}</div>}
                                          {health.up.mf !== undefined && <div>Missed Files: <span className="pill pillDanger">{health.up.mf}</span></div>}
                                          {health.up.fs !== undefined && <div>Folder Scan: {health.up.fs ? '✓' : '⏳'}</div>}
                                          {health.up.os !== undefined && <div>Overnight Scan: {health.up.os ? '✓' : '⏳'}</div>}
                                          {health.up.nr !== undefined && <div>NVS Restore: {health.up.nr ? '✓' : '⏳'}</div>}
                                          {health.up.lf !== undefined && <div>Last Found: {health.up.lf}</div>}
                                          {health.up.lq !== undefined && <div>Last Queued: {health.up.lq}</div>}
                                          {health.up.nt !== undefined && <div>NVS Total Restored: {health.up.nt}</div>}
                                        </div>
                                      </div>
                                    )}
                                    {/* Yearly Summary - SD Card Recording Statistics */}
                                    {health.yr !== undefined && (
                                      <div className={cardStyles.card}>
                                        <div >📅 {health.yr} Recording Summary</div>
                                        <div className="gridTwo">
                                          {health.yf !== undefined && <div>Total Files: {health.yf.toLocaleString()}</div>}
                                          {health.ys && <div>Total Size: {health.ys}</div>}
                                          {health.yh !== undefined && <div>Total Hours: {health.yh.toLocaleString()}</div>}
                                          {health.ym !== undefined && <div>Months: {health.ym}</div>}
                                          {health.yd !== undefined && <div>Days: {health.yd}</div>}
                                        </div>
                                      </div>
                                    )}
                            </div>
                          </div>
                          );
                        })()}
                        
                        {/* Error/Warning/Fatal Logs */}
                        {serialData[device.port]?.errorLogs && serialData[device.port].errorLogs.length > 0 && (
                          <div >
                            <h5 className={cardStyles.title}>
                              <span>⚠️</span> Last {serialData[device.port].errorLogs.length} Errors/Warnings
                            </h5>
                            <div className="stack">
                              {serialData[device.port].errorLogs.map((log, index) => (
                                <div 
                                  key={index} 
                                  
                                >
                                  <div className="rowBetween">
                                    <span className="pill pillDanger">
                                      {log.type}
                                    </span>
                                    <span className="mutedText smallText">
                                      {new Date(log.timestamp).toLocaleString()}
                                    </span>
                                  </div>
                                  <div >
                                    {log.message}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Reboot History */}
                        {rebootHistory[device.port] && rebootHistory[device.port].length > 0 && (
                          <div >
                            <h5 className={cardStyles.title}>
                              <span>🔄</span> Last 5 Reboots
                            </h5>
                            <div className="stack">
                              {rebootHistory[device.port].map((reboot, index) => (
                                <div key={index} className={cardStyles.card}>
                                  <div className="rowBetween">
                                    <span className="mutedText smallText">Reboot #{rebootHistory[device.port].length - index}:</span>
                                    <span className="mutedText smallText">
                                      {new Date(reboot.timestamp).toLocaleString()}
                                    </span>
                                  </div>
                                  {reboot.mac_address && (
                                    <div >
                                      MAC: {reboot.mac_address}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Firmware Management Section - At the bottom */}
      <div >
        <div className="rowBetween">
          <div className="row">
            <div className={`${cardStyles.card} ${cardStyles.compact}`}>
              <Package size={24} />
            </div>
            <div>
              <h2 className="pageTitle">Firmware Management</h2>
              <p className="mutedText smallText">
                Upload and manage ESP32 firmware files.
              </p>
            </div>
          </div>
          <button
            onClick={() => setFirmwareUploadModal({ open: true, name: '', files: {}, uploading: false, error: null })}
            className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
          >
            <Upload className="iconSmall" />
            Upload Firmware
          </button>
        </div>

        {firmwares.length === 0 ? (
          <div className={cardStyles.card}>
            No firmware uploaded yet. Click "Upload Firmware" to add a firmware group.
          </div>
        ) : (
          <div className={cardStyles.card}>
            <table className={tableStyles.table}>
              <thead >
                <tr>
                  <th className={tableStyles.header}>
                    Name
                  </th>
                  <th className={tableStyles.header}>
                    Description
                  </th>
                  <th className={tableStyles.header}>
                    Files
                  </th>
                  <th className={tableStyles.header}>
                    Created
                  </th>
                  <th className={tableStyles.header}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody >
                {firmwares.map((firmware) => (
                  <tr key={firmware.id} className={tableStyles.rowInteractive}>
                    <td className={tableStyles.cellMuted}>
                      <div >{firmware.name}</div>
                      <div >{firmware.id}</div>
                    </td>
                    <td className={tableStyles.cellMuted}>
                      <div >
                        {firmware.description || <span className="mutedText smallText">No description</span>}
                      </div>
                    </td>
                    <td className={tableStyles.cellMuted}>
                      <div className="rowWrap">
                        {Object.entries(firmware.files).map(([file, exists]) => (
                          <div key={file} className="row">
                            <span className="pill pillDanger">
                              {exists ? '✓' : '✗'}
                            </span>
                            <span className="mutedText smallText">{file}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className={tableStyles.cellMuted}>
                      {firmware.created_at ? new Date(firmware.created_at).toLocaleDateString() : 'Unknown'}
                    </td>
                    <td className={tableStyles.cellMuted}>
                      <div className="row">
                        <button
                          onClick={() => handleEditFirmware(firmware)}
                          className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
                        >
                          <Edit3 className="iconSmall" />
                          Modify
                        </button>
                        <button
                          onClick={() => handleDeleteFirmware(firmware.id)}
                          className={`${buttonStyles.button} ${buttonStyles.danger} ${buttonStyles.medium}`}
                        >
                          <Trash2 className="iconSmall" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Firmware Upload Modal */}
      {firmwareUploadModal.open && (
        <dialog
          ref={firmwareUploadDialogRef}
          className={modalStyles.dialog}
          onCancel={(event) => { event.preventDefault(); if (!firmwareUploadModal.uploading) setFirmwareUploadModal({ open: false, name: '', files: {}, uploading: false, error: null }); }}
        >
          <div className={modalStyles.body}>
            <div className="rowBetween">
              <h3 className={cardStyles.title}>Upload Firmware</h3>
              <button
                onClick={() => setFirmwareUploadModal({ open: false, name: '', files: {}, uploading: false, error: null })}
                className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
              >
                Close
              </button>
            </div>
            <div className="stack">
              <div>
                <label className={formStyles.label}>Firmware Name</label>
                <input
                  type="text"
                  value={firmwareUploadModal.name}
                  onChange={(e) => setFirmwareUploadModal((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Production v1.0"
                  className={formStyles.input}
                />
              </div>
              {['bootloader.bin', 'partitions.bin', 'firmware.bin'].map((fileType) => (
                <div key={fileType}>
                  <label className={formStyles.label}>{fileType}</label>
                  <input
                    type="file"
                    accept=".bin"
                    onChange={(e) => handleFirmwareFileChange(fileType, e.target.files[0])}
                    className={formStyles.file}
                  />
                </div>
              ))}
              {firmwareUploadModal.error && (
                <div className={`${noticeStyles.notice} ${noticeStyles.error}`}>
                  {firmwareUploadModal.error}
                </div>
              )}
              <div className="rowWrap">
                <button
                  onClick={() => setFirmwareUploadModal({ open: false, name: '', files: {}, uploading: false, error: null })}
                  className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUploadFirmware}
                  disabled={firmwareUploadModal.uploading}
                  className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
                >
                  <Upload className="iconSmall" />
                  {firmwareUploadModal.uploading ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        </dialog>
      )}

      {/* Flash Firmware Modal */}
      {flashModal.open && (
        <dialog
          ref={flashDialogRef}
          className={modalStyles.dialog}
          onCancel={(event) => { event.preventDefault(); if (!(flashModal.flashing && flashProgress.status === 'running')) handleCloseFlashModal(); }}
        >
          <div className={modalStyles.body}>
            <div className="rowBetween">
              <h3 className={cardStyles.title}>Flash Firmware</h3>
              <button
                onClick={handleCloseFlashModal}
                disabled={flashModal.flashing && flashProgress.status === 'running'}
                className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
              >
                {flashModal.flashing && flashProgress.status === 'running' ? 'Flashing...' : 'Close'}
              </button>
            </div>
            <div className="stack">
              <div>
                <label className={formStyles.label}>Port</label>
                <input
                  type="text"
                  value={flashModal.port || ''}
                  disabled
                  className={formStyles.input}
                />
              </div>
              <div>
                <label className={formStyles.label}>Firmware</label>
                <select
                  value={flashModal.firmwareId}
                  onChange={(e) => setFlashModal((prev) => ({ ...prev, firmwareId: e.target.value }))}
                  disabled={flashModal.flashing}
                  className={formStyles.select}
                >
                  <option value="">Select firmware...</option>
                  {firmwares.map((fw) => (
                    <option key={fw.id} value={fw.id}>
                      {fw.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Progress Section */}
              {flashModal.flashing && (
                <div className="stack">
                  <div>
                    <div className="rowBetween">
                      <span className="mutedText smallText">Progress</span>
                      <span className="mutedText smallText">{flashProgress.progress}%</span>
                    </div>
                    <progress className="fullWidth" max="100" value={flashProgress.progress}>
                      {flashProgress.progress}%
                    </progress>
                  </div>
                  {flashProgress.message && (
                    <div className={`${noticeStyles.notice} ${noticeStyles.error}`}>
                      {flashProgress.message}
                    </div>
                  )}
                  {flashProgress.output && (
                    <div className="scrollPanel">
                      <pre className="codeBlock">{flashProgress.output}</pre>
                    </div>
                  )}
                </div>
              )}

              {flashModal.error && (
                <div className={`${noticeStyles.notice} ${noticeStyles.error}`}>
                  {flashModal.error}
                </div>
              )}
              <div className="rowWrap">
                <button
                  onClick={handleCloseFlashModal}
                  disabled={flashModal.flashing && flashProgress.status === 'running'}
                  className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
                >
                  {flashProgress.status === 'completed' || flashProgress.status === 'failed' ? 'Close' : 'Cancel'}
                </button>
                {flashProgress.status !== 'running' && (
                  <button
                    onClick={handleFlashFirmware}
                    disabled={flashModal.flashing || !flashModal.firmwareId}
                    className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
                  >
                    <Zap className="iconSmall" />
                    {flashProgress.status === 'completed' ? 'Flash Again' : 'Flash'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </dialog>
      )}

      {/* Firmware Edit Modal */}
      {firmwareEditModal.open && (
        <dialog
          ref={firmwareEditDialogRef}
          className={modalStyles.dialog}
          onCancel={(event) => { event.preventDefault(); if (!firmwareEditModal.saving) setFirmwareEditModal({ open: false, firmware: null, name: '', description: '', saving: false, error: null }); }}
        >
          <div className={modalStyles.body}>
            <div className="rowBetween">
              <h3 className={cardStyles.title}>Edit Firmware</h3>
              <button
                onClick={() => setFirmwareEditModal({ open: false, firmware: null, name: '', description: '', saving: false, error: null })}
                className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
              >
                Close
              </button>
            </div>
            <div className="stack">
              <div>
                <label className={formStyles.label}>Firmware Name</label>
                <input
                  type="text"
                  value={firmwareEditModal.name}
                  onChange={(e) => setFirmwareEditModal((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Production v1.0"
                  className={formStyles.input}
                />
              </div>
              <div>
                <label className={formStyles.label}>Description</label>
                <textarea
                  value={firmwareEditModal.description}
                  onChange={(e) => setFirmwareEditModal((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter firmware description..."
                  rows={4}
                  className={formStyles.textarea}
                />
              </div>
              {firmwareEditModal.error && (
                <div className={`${noticeStyles.notice} ${noticeStyles.error}`}>
                  {firmwareEditModal.error}
                </div>
              )}
              <div className="rowWrap">
                <button
                  onClick={() => setFirmwareEditModal({ open: false, firmware: null, name: '', description: '', saving: false, error: null })}
                  className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveFirmwareEdit}
                  disabled={firmwareEditModal.saving}
                  className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
                >
                  <SaveIcon className="iconSmall" />
                  {firmwareEditModal.saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
};

export default RecorderDevices;
