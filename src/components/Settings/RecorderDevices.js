import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../utils/apiClient';
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

const RecorderDevices = ({ isDarkMode, enabled }) => {
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
        global_timezone: settings.global_timezone || 'Etc/UTC'
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

  // Calculate timezone offset in hours (for autoconfig command)
  const getTimezoneOffsetHours = useCallback((timezone) => {
    try {
      if (!timezone) return 0;
      const now = new Date();
      const utcTime = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
      const tzTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      const offsetMinutes = (tzTime.getTime() - utcTime.getTime()) / (1000 * 60);
      const offsetHours = offsetMinutes / 60;
      return Math.round(offsetHours);
    } catch (err) {
      console.warn('Failed to calculate timezone offset:', err);
      return 0;
    }
  }, []);

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


  const containerClasses = isDarkMode
    ? 'bg-gray-900 text-gray-100'
    : 'bg-white text-gray-900';

  const cardClasses = isDarkMode
    ? 'bg-gray-800 border border-gray-700'
    : 'bg-white border border-gray-200';

  const badgeClasses = (status) => {
    if (status === 'available') {
      return isDarkMode
        ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50'
        : 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    }
    return isDarkMode
      ? 'bg-amber-900/40 text-amber-300 border border-amber-700/50'
      : 'bg-amber-100 text-amber-700 border border-amber-200';
  };

  return (
    <div className={`rounded-2xl shadow-lg p-4 md:p-6 transition-colors duration-300 ${containerClasses}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl shadow-md ${isDarkMode ? 'bg-blue-600' : 'bg-blue-500'}`}>
            <Cpu size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Boondock Edge Recorders</h2>
            <p className={`mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Enumerate Boondock Edge Devices over Serial Port.
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-300 ${
            refreshing || loading
              ? 'opacity-70 cursor-not-allowed'
              : isDarkMode
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Scanning…' : 'Refresh'}
        </button>
      </div>

      {!enabled && (
        <div className={`rounded-xl border p-5 flex items-start gap-3 ${
          isDarkMode ? 'border-amber-500/40 bg-amber-900/20 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-700'
        }`}>
          <AlertCircle className="w-5 h-5 mt-0.5" />
          <div>
            <h3 className="font-semibold">Discovery Disabled</h3>
            <p className="text-sm">
              Toggle <strong>Enable Boondock Edge devices</strong> in Global settings to enumerate ESP32 recorders.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className={`mt-4 rounded-xl border p-4 ${
          isDarkMode ? 'border-red-600/60 bg-red-900/30 text-red-200' : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          {typeof error === 'string' ? error : (error?.message || String(error))}
        </div>
      )}

      {notification && (
        <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
          notification.type === 'error'
            ? isDarkMode
              ? 'border-red-600/60 bg-red-900/40 text-red-200'
              : 'border-red-200 bg-red-50 text-red-700'
            : isDarkMode
              ? 'border-emerald-600/50 bg-emerald-900/30 text-emerald-200'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
        }`}>
          {notification.text}
        </div>
      )}

      {/* Monitor Messages Display */}
      {enabled && (
        <div className={`mt-6 rounded-2xl border overflow-hidden ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className={`px-4 py-3 border-b ${
            isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                  Serial Messages
                </h3>
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Real-time messages from monitored devices
                </p>
              </div>
              {monitoredPorts.length > 0 && (
                <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <span className="font-medium">Monitoring:</span> {monitoredPorts.join(', ')}
                </div>
              )}
            </div>
          </div>
          
          {/* Command Buttons */}
          <div className={`px-4 py-3 border-b ${
            isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
          }`}>
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={handleRefreshDeviceData}
                disabled={sendingCommand || selectedPorts.length === 0}
                title="Fetch latest config and health data from selected devices (sends 'config ?' then 'health ?' after 5 seconds)"
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  sendingCommand || selectedPorts.length === 0
                    ? 'opacity-50 cursor-not-allowed bg-gray-500 text-white'
                    : isDarkMode
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${sendingCommand ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={handleReset}
                disabled={resetting || monitoredPorts.length === 0}
                title="Reconnect serial monitoring for all monitored devices (useful if connection is stuck)"
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  resetting || monitoredPorts.length === 0
                    ? 'opacity-50 cursor-not-allowed bg-gray-500 text-white'
                    : isDarkMode
                      ? 'bg-orange-600 hover:bg-orange-700 text-white'
                      : 'bg-orange-500 hover:bg-orange-600 text-white'
                }`}
              >
                <Usb className={`w-4 h-4 ${resetting ? 'animate-spin' : ''}`} />
                Reset
              </button>
              <button
                onClick={handleAutoConfig}
                disabled={sendingCommand || selectedPorts.length === 0}
                title="Set WiFi SSID/password, custom upload host/port, save, and reboot on selected devices (waits for device response after each command)"
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  sendingCommand || selectedPorts.length === 0
                    ? 'opacity-50 cursor-not-allowed bg-gray-500 text-white'
                    : isDarkMode
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                <Zap className="w-4 h-4" />
                Auto Config
              </button>
              <button
                onClick={handleReboot}
                disabled={sendingCommand || selectedPorts.length === 0}
                title="Restart selected devices (sends 'reboot' command to trigger a full device restart)"
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  sendingCommand || selectedPorts.length === 0
                    ? 'opacity-50 cursor-not-allowed bg-gray-500 text-white'
                    : isDarkMode
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                <Power className="w-4 h-4" />
                Reboot
              </button>
            </div>
            
            {/* Command Input */}
            <div className="flex gap-2">
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
                className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                  isDarkMode
                    ? 'bg-gray-900 text-gray-100 border-gray-600'
                    : 'bg-white text-gray-900 border-gray-300'
                } ${sendingCommand || selectedPorts.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
              <button
                onClick={handleSendCommand}
                disabled={sendingCommand || !commandInput.trim() || selectedPorts.length === 0}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  sendingCommand || !commandInput.trim() || selectedPorts.length === 0
                    ? 'opacity-50 cursor-not-allowed bg-gray-500 text-white'
                    : isDarkMode
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {sendingCommand ? 'Sending...' : 'Send'}
              </button>
            </div>
            
            {/* Port Filter */}
            {monitoredPorts.length > 0 && (
              <div>
                <label className={`text-sm font-medium block mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Filter Ports (select ports to display messages):
                </label>
                <div className="flex flex-wrap gap-3">
                  {monitoredPorts.map((port) => (
                    <label key={port} className="flex items-center gap-2 cursor-pointer">
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
                        className={`w-4 h-4 rounded border-2 ${
                          isDarkMode
                            ? 'border-gray-600 bg-gray-700 text-blue-500'
                            : 'border-gray-300 bg-white text-blue-600'
                        }`}
                      />
                      <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {port}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Messages Display - Terminal Style */}
          <div className="bg-black text-green-400 font-mono text-sm p-4 max-h-96 overflow-y-auto overflow-x-auto">
            {monitorMessages
              .filter(msg => selectedPorts.length === 0 || selectedPorts.includes(msg.port))
              .slice()
              .reverse()
              .slice(0, 5)  // Show only latest 5 messages
              .map((msg, idx) => (
                <div
                  key={`${msg.port}-${msg.timestamp}-${idx}`}
                  className="whitespace-nowrap"
                >
                  <span className="text-cyan-400 font-semibold">{msg.port}</span>
                  <span className="text-gray-500 mx-2">::</span>
                  <span className="text-yellow-400">{msg.local_time}</span>
                  <span className="text-gray-500 mx-2">::</span>
                  <span className="text-green-400">{msg.message}</span>
                </div>
              ))}
            {monitorMessages.filter(msg => selectedPorts.length === 0 || selectedPorts.includes(msg.port)).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No messages to display. {selectedPorts.length === 0 ? 'Select ports to filter messages.' : 'Waiting for messages...'}
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {devices.length === 0 ? (
            <div className={`col-span-full rounded-xl border-dashed border-2 p-10 text-center ${
              isDarkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-600'
            }`}>
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
                <div key={device.port} className={`rounded-xl p-3 transition-all duration-300 hover:shadow-lg ${cardClasses}`}>
                {/* Compact Header with Uptime */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-50'} text-blue-500`}>
                      <Usb className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{device.port}</h3>
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
                      <div className="flex flex-col items-center justify-center flex-1">
                        <div className={`text-xs font-medium mb-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          ⏱️ Uptime
                        </div>
                        <div className={`text-2xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                          {formattedTime}
                        </div>
                      </div>
                    );
                  })()}
                  
                  <div className="flex items-center gap-1">
                    {/* Permanent Recording Icon */}
                    <div className="flex items-center justify-center">
                      <Mic className={`w-3.5 h-3.5 ${isRecording ? 'text-red-500 animate-flash' : 'text-gray-400'}`} />
                    </div>
                    {/* Permanent Uploading Icon */}
                    <div className="flex items-center justify-center">
                      <UploadCloud className={`w-3.5 h-3.5 ${isUploading ? 'text-blue-500 animate-flash' : 'text-gray-400'}`} />
                    </div>
                    {device.status && (
                      <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${badgeClasses(device.status)}`}>
                        {device.status === 'available' ? '✅' : '⚠️'}
                      </span>
                    )}
                    {/* Delete Button */}
                    <button
                      onClick={() => handleDeleteRecorder(device.port)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isDarkMode 
                          ? 'hover:bg-red-500/20 text-red-400 hover:text-red-300' 
                          : 'hover:bg-red-50 text-red-500 hover:text-red-600'
                      }`}
                      title={`Delete recorder on port ${device.port}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
                    <div className="flex items-center justify-center gap-4 mb-1 flex-wrap">
                      <div className="flex flex-col items-center">
                        <div className={`text-xs font-medium mb-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Recordings
                        </div>
                        <div className={`text-3xl font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                          {recordingCount !== undefined ? recordingCount : '-'}
                        </div>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className={`text-xs font-medium mb-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Uploaded
                        </div>
                        <div className={`text-3xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                          {uploadedCount !== undefined ? uploadedCount : '-'}
                        </div>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className={`text-xs font-medium mb-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Recording time
                        </div>
                        <div className={`text-3xl font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
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
                    <div className="flex items-center justify-center gap-4 mb-2">
                      {totalPending !== undefined && (
                        <div className="flex items-center gap-1">
                          <span className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Pending:</span>
                          <span className={`text-sm font-semibold ${totalPending > 0 ? (isDarkMode ? 'text-orange-400' : 'text-orange-600') : (isDarkMode ? 'text-green-400' : 'text-green-600')}`}>
                            {totalPending}
                          </span>
                        </div>
                      )}
                      {missedFiles !== undefined && missedFiles > 0 && (
                        <div className="flex items-center gap-1">
                          <span className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Missed:</span>
                          <span className={`text-sm font-semibold ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                            {missedFiles}
                          </span>
                        </div>
                      )}
                      {nvsQueue !== undefined && nvsQueue > 0 && (
                        <div className="flex items-center gap-1">
                          <span className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>NVS:</span>
                          <span className={`text-sm font-semibold ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>
                            {nvsQueue}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Device Identity - Compact */}
                {(status.firmware || macAddress || ipAddress || wifiStatus !== undefined || matchedChannel || lastUpdate || rebootCounts[device.port] !== undefined) && (
                  <div className={`p-1.5 rounded-lg mb-2 text-xs ${isDarkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
                    <div className="grid grid-cols-2 gap-1">
                      {status.firmware && (
                        <div className="flex items-center gap-1">
                          <span>🔧</span>
                          <span className="font-medium">Firmware:</span>
                          <span className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>{status.firmware}</span>
                        </div>
                      )}
                      {macAddress && (
                        <div className="flex items-center gap-1">
                          <span>🆔</span>
                          <span className="font-medium">MAC:</span>
                          <span className={isDarkMode ? 'text-purple-400' : 'text-purple-600'}>{macAddress}</span>
                        </div>
                      )}
                      {ipAddress && (
                        <div className="flex items-center gap-1">
                          <span>🌐</span>
                          <span className="font-medium">IP:</span>
                          <span className={isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}>{ipAddress}</span>
                        </div>
                      )}
                      {wifiStatus !== undefined && (
                        <div className="flex items-center gap-1">
                          <span>📶</span>
                          <span className="font-medium">WiFi:</span>
                          {wifiStatus ? (
                            <span className={isDarkMode ? 'text-green-400' : 'text-green-600'}>
                              {rssiRating || 'Connected'}
                            </span>
                          ) : (
                            <span className={isDarkMode ? 'text-red-400' : 'text-red-600'}>
                              Disconnected
                            </span>
                          )}
                        </div>
                      )}
                      {matchedChannel && (
                        <div className="flex items-center gap-1">
                          <span>📻</span>
                          <span className="font-medium">Channel:</span>
                          <span className={isDarkMode ? 'text-green-400' : 'text-green-600'}>{matchedChannel.name}</span>
                        </div>
                      )}
                      {rebootCounts[device.port] !== undefined && (
                        <div className="flex items-center gap-1">
                          <span>🔄</span>
                          <span className="font-medium">Reboots:</span>
                          <span className={isDarkMode ? 'text-orange-400' : 'text-orange-600'}>{rebootCounts[device.port]}</span>
                        </div>
                      )}
                      {lastUpdate && (
                        <div className="flex items-center gap-1">
                          <span>🕐</span>
                          <span className="font-medium">Refreshed:</span>
                          <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>{getTimeAgo(lastUpdate)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className={`space-y-1.5 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {/* Audio Level Bar - Compact */}
                  {status.audio && Object.keys(status.audio).length > 0 && (minDb !== -80 || maxDb !== 0 || currentDb !== -80) && (
                    <div className="mb-1.5">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium">🔊 Audio Level</span>
                        <span className="text-xs">
                          {typeof currentDb === 'number' ? currentDb.toFixed(1) : 'N/A'} dB <span className="text-gray-500">(min: {typeof minDb === 'number' ? minDb.toFixed(1) : 'N/A'}, max: {typeof maxDb === 'number' ? maxDb.toFixed(1) : 'N/A'})</span>
                        </span>
                      </div>
                      <div className="relative mb-1">
                        <div className={`relative h-3 rounded-full overflow-hidden ${
                          isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                        }`}>
                          {/* Bar below threshold (gray) */}
                          {thresholdPercent !== null && (
                            <div
                              className="absolute left-0 top-0 h-full bg-gray-500 transition-all duration-300"
                              style={{ width: `${Math.min(thresholdPercent, currentPercent)}%` }}
                            />
                          )}
                          {/* Bar above threshold (orange) */}
                          {thresholdPercent !== null && currentPercent > thresholdPercent ? (
                            <div
                              className="absolute top-0 h-full bg-orange-500 transition-all duration-300"
                              style={{ 
                                left: `${thresholdPercent}%`,
                                width: `${currentPercent - thresholdPercent}%`
                              }}
                            />
                          ) : thresholdPercent === null ? (
                            // Fallback if no threshold: use old color logic
                            <div
                              className={`absolute left-0 top-0 h-full transition-all duration-300 ${
                                currentDb > -20 ? 'bg-red-500' : currentDb > -40 ? 'bg-orange-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${currentPercent}%` }}
                            />
                          ) : (
                            // Current dB is below threshold, show gray
                            <div
                              className="absolute left-0 top-0 h-full bg-gray-500 transition-all duration-300"
                              style={{ width: `${currentPercent}%` }}
                            />
                          )}
                          {/* Threshold marker */}
                          {thresholdPercent !== null && (
                            <div
                              className={`absolute top-0 h-full w-0.5 ${
                                isDarkMode ? 'bg-yellow-400' : 'bg-yellow-600'
                              }`}
                              style={{ left: `${thresholdPercent}%` }}
                            />
                          )}
                          {/* Current audio level marker */}
                          <div
                            className={`absolute top-0 h-full w-0.5 ${
                              isDarkMode ? 'bg-white' : 'bg-gray-900'
                            }`}
                            style={{ left: `${currentPercent}%` }}
                          />
                        </div>
                      </div>
                      {/* Threshold and Dynamic Range in one row */}
                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        {/* Threshold Setting */}
                        {threshold !== undefined && thresholdDb !== null && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">Threshold:</span>
                            <span className={isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}>
                              {thresholdDb.toFixed(1)} dB ({threshold})
                            </span>
                          </div>
                        )}
                        {/* Dynamic Range Utilization */}
                        {(averageDynamicRange !== undefined && averageDynamicRange !== null) && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">Dynamic Range:</span>
                            <span className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>
                              {averageDynamicRange.toFixed(0)}%{dynamicRangeRating ? ` (${dynamicRangeRating})` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Device Status Info - Compact Grid */}
                  {(status.recorded !== undefined || status.uploaded !== undefined) && (
                    <div className="mb-1.5">
                      <div className={`grid grid-cols-2 gap-1 ${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50'} p-1.5 rounded-lg text-xs`}>
                        {status.recorded !== undefined && (
                          <div className="flex items-center gap-1">
                            <span>💾</span>
                            <span className="font-medium">Recorded:</span>
                            <span className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>{status.recorded}</span>
                          </div>
                        )}
                        {status.uploaded !== undefined && (
                          <div className="flex items-center gap-1">
                            <span>☁️</span>
                            <span className="font-medium">Uploaded:</span>
                            <span className={isDarkMode ? 'text-purple-400' : 'text-purple-600'}>{status.uploaded}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Connectivity & Resources - Compact */}
                      <div className="space-y-1">
                        
                        {status.sdFree !== undefined && status.sdFree !== null && typeof status.sdFree === 'number' && (
                          <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                            status.sdFree > 20 
                              ? (isDarkMode ? 'bg-green-900/20 border border-green-700/30' : 'bg-green-50 border border-green-200')
                              : (isDarkMode ? 'bg-red-900/20 border border-red-700/30' : 'bg-red-50 border border-red-200')
                          }`}>
                            <span>💿</span>
                            <span className="font-medium">SD Free:</span>
                            <span className={
                              status.sdFree > 20 
                                ? (isDarkMode ? 'text-green-400' : 'text-green-600')
                                : (isDarkMode ? 'text-red-400' : 'text-red-600')
                            }>
                              {status.sdFree.toFixed(1)}%
                            </span>
                          </div>
                        )}
                        
                        {status.heap && status.heap.free !== undefined && status.heap.free !== null && status.heap.total !== undefined && status.heap.total !== null && typeof status.heap.free === 'number' && typeof status.heap.total === 'number' && status.heap.total > 0 && (
                          <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                            isDarkMode ? 'bg-blue-900/20 border border-blue-700/30' : 'bg-blue-50 border border-blue-200'
                          }`}>
                            <span>🧠</span>
                            <span className="font-medium">Heap:</span>
                            <span className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>
                              {(status.heap.free / 1024).toFixed(0)}KB / {(status.heap.total / 1024).toFixed(0)}KB
                            </span>
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-gray-700/50 ml-1">
                              <div 
                                className={`h-full ${
                                  (status.heap.free / status.heap.total) > 0.5 
                                    ? 'bg-green-500' 
                                    : (status.heap.free / status.heap.total) > 0.2 
                                      ? 'bg-yellow-500' 
                                      : 'bg-red-500'
                                }`}
                                style={{ width: `${(status.heap.free / status.heap.total) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}
                        
                        {status.recordings && (
                          <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                            (status.recordings.error || 0) === 0
                              ? (isDarkMode ? 'bg-green-900/20 border border-green-700/30' : 'bg-green-50 border border-green-200')
                              : (isDarkMode ? 'bg-red-900/20 border border-red-700/30' : 'bg-red-50 border border-red-200')
                          }`}>
                            <span>📼</span>
                            <span className="font-medium">Recordings:</span>
                            <span className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>{status.recordings.total}</span>
                            {(status.recordings.error || 0) > 0 && (
                              <span className={`ml-1 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                                ({status.recordings.error} errors ⚠️)
                              </span>
                            )}
                          </div>
                        )}
                        
                        {status.api && (
                          <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                            status.api.dead
                              ? (isDarkMode ? 'bg-red-900/20 border border-red-700/30' : 'bg-red-50 border border-red-200')
                              : (isDarkMode ? 'bg-green-900/20 border border-green-700/30' : 'bg-green-50 border border-green-200')
                          }`}>
                            <span>{status.api.dead ? '💀' : '✅'}</span>
                            <span className="font-medium">API:</span>
                            <span className={status.api.dead ? (isDarkMode ? 'text-red-400' : 'text-red-600') : (isDarkMode ? 'text-green-400' : 'text-green-600')}>
                              {status.api.dead ? 'Dead' : 'Alive'}
                            </span>
                            <span className="text-gray-500 ml-1">
                              ({status.api.Events || 0} events, {status.api.Uploads || 0} uploads)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Controls - Compact */}
                  <div className="mt-1.5 pt-1.5 border-t border-gray-600/30 flex items-center justify-between">
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
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition ${
                        isDarkMode
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      }`}
                    >
                      <Info className="w-3.5 h-3.5" />
                      More
                      {expandedDevices[device.port] ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => setFlashModal({ open: true, port: device.port, firmwareId: '', flashing: false, error: null })}
                      disabled={disableActions || firmwares.length === 0}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition ${
                        disableActions || firmwares.length === 0
                          ? 'opacity-70 cursor-not-allowed'
                          : isDarkMode
                            ? 'bg-purple-600 hover:bg-purple-500 text-white'
                            : 'bg-purple-500 hover:bg-purple-600 text-white'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      {busyStatus === 'flash' ? 'Flashing…' : 'Flash Firmware'}
                    </button>
                  </div>
                  
                  {/* Expanded Details Section */}
                  {expandedDevices[device.port] && (
                    <div className={`mt-3 pt-3 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-300'}`}>
                      <div className={`p-3 rounded-lg text-xs ${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
                        <h4 className="font-semibold mb-3 text-sm">Device Details</h4>
                        
                        {/* Storage Information */}
                        {(status.storage || status.sd !== undefined || status.sdUsed !== undefined || status.sdTotal !== undefined) && (
                          <div className="mb-3">
                            <h5 className="font-medium mb-2 flex items-center gap-1">
                              <span>💿</span> Storage
                            </h5>
                            <div className="grid grid-cols-2 gap-2 ml-5">
                              {typeof status.storage === 'string' && status.storage && (
                                <div>
                                  <span className="text-gray-500">Type:</span>
                                  <span className="ml-1">{status.storage}</span>
                                </div>
                              )}
                              {status.sd !== undefined && (
                                <div>
                                  <span className="text-gray-500">SD Available:</span>
                                  <span className={`ml-1 ${status.sd ? 'text-green-500' : 'text-red-500'}`}>
                                    {status.sd ? 'Yes' : 'No'}
                                  </span>
                                </div>
                              )}
                              {status.sdTotal !== undefined && (
                                <div>
                                  <span className="text-gray-500">SD Size:</span>
                                  <span className="ml-1">{status.sdTotal}</span>
                                </div>
                              )}
                              {status.sdUsed !== undefined && (
                                <div>
                                  <span className="text-gray-500">SD Used:</span>
                                  <span className="ml-1">{status.sdUsed}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Memory Information */}
                        {(status.heapTotal !== undefined || status.heapUsed !== undefined || status.heapMin !== undefined || status.heapBlock !== undefined || status.psramTotal !== undefined || status.psramUsed !== undefined) && (
                          <div className="mb-3">
                            <h5 className="font-medium mb-2 flex items-center gap-1">
                              <span>🧠</span> Memory
                            </h5>
                            <div className="grid grid-cols-2 gap-2 ml-5">
                              {status.heapTotal !== undefined && (
                                <div>
                                  <span className="text-gray-500">Heap Total:</span>
                                  <span className="ml-1">{status.heapTotal}</span>
                                </div>
                              )}
                              {status.heapUsed !== undefined && (
                                <div>
                                  <span className="text-gray-500">Heap Used:</span>
                                  <span className="ml-1">{status.heapUsed}</span>
                                </div>
                              )}
                              {status.heapMin !== undefined && (
                                <div>
                                  <span className="text-gray-500">Heap Min Free:</span>
                                  <span className="ml-1">{status.heapMin}</span>
                                </div>
                              )}
                              {status.heapBlock !== undefined && (
                                <div>
                                  <span className="text-gray-500">Largest Heap Block:</span>
                                  <span className="ml-1">{status.heapBlock}</span>
                                </div>
                              )}
                              {status.psramTotal !== undefined && (
                                <div>
                                  <span className="text-gray-500">PSRAM Total:</span>
                                  <span className="ml-1">{status.psramTotal}</span>
                                </div>
                              )}
                              {status.psramUsed !== undefined && (
                                <div>
                                  <span className="text-gray-500">PSRAM Used:</span>
                                  <span className="ml-1">{status.psramUsed}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* System Information */}
                        {(status.timeSet !== undefined || status.rtcEnabled !== undefined || status.currentTime || status.epochTime !== undefined || status.lastRecordingTime !== undefined || status.lastRecordingStart) && (
                          <div className="mb-3">
                            <h5 className="font-medium mb-2 flex items-center gap-1">
                              <span>⏰</span> System
                            </h5>
                            <div className="grid grid-cols-2 gap-2 ml-5">
                              {status.timeSet !== undefined && (
                                <div>
                                  <span className="text-gray-500">Time Set:</span>
                                  <span className={`ml-1 ${status.timeSet ? 'text-green-500' : 'text-red-500'}`}>
                                    {status.timeSet ? 'Yes' : 'No'}
                                  </span>
                                </div>
                              )}
                              {status.rtcEnabled !== undefined && (
                                <div>
                                  <span className="text-gray-500">RTC Enabled:</span>
                                  <span className={`ml-1 ${status.rtcEnabled ? 'text-green-500' : 'text-red-500'}`}>
                                    {status.rtcEnabled ? 'Yes' : 'No'}
                                  </span>
                                </div>
                              )}
                              {status.currentTime && (
                                <div>
                                  <span className="text-gray-500">Current Time:</span>
                                  <span className="ml-1">{new Date(status.currentTime).toLocaleString()}</span>
                                </div>
                              )}
                              {status.epochTime !== undefined && (
                                <div>
                                  <span className="text-gray-500">Epoch Time:</span>
                                  <span className="ml-1">{status.epochTime}</span>
                                </div>
                              )}
                              {status.lastRecordingTime !== undefined && (
                                <div>
                                  <span className="text-gray-500">Last Recording:</span>
                                  <span className="ml-1">{status.lastRecordingTime}s ago</span>
                                </div>
                              )}
                              {status.lastRecordingStart && (
                                <div>
                                  <span className="text-gray-500">Last Recording Start:</span>
                                  <span className="ml-1">{new Date(status.lastRecordingStart).toLocaleString()}</span>
                                </div>
                              )}
                              {status.lastRecordingDuration !== undefined && (
                                <div>
                                  <span className="text-gray-500">Last Recording Duration:</span>
                                  <span className="ml-1">{status.lastRecordingDuration}s</span>
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
                            <div className="mb-3">
                              <h5 className="font-medium mb-2 flex items-center gap-1">
                                <span>⚙️</span> Configuration Settings
                              </h5>
                              <div className="space-y-3 ml-5">
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
                                  <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                    <div className="font-semibold mb-1">📶 WiFi & Network</div>
                                    <div className="grid grid-cols-2 gap-1 text-gray-500">
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
                                  <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                    <div className="font-semibold mb-1">🔊 Audio / Recorder</div>
                                    <div className="grid grid-cols-2 gap-1 text-gray-500">
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
                                  <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                    <div className="font-semibold mb-1">💿 Storage & SD Card</div>
                                    <div className="grid grid-cols-2 gap-1 text-gray-500">
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
                                  <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                    <div className="font-semibold mb-1">⏰ RTC & Timezone</div>
                                    <div className="grid grid-cols-2 gap-1 text-gray-500">
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
                                  <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                    <div className="font-semibold mb-1">🔧 System</div>
                                    <div className="grid grid-cols-2 gap-1 text-gray-500">
                                      {(otherConfig?.fw || mergedConfig.fw) && <div>Firmware: {otherConfig?.fw || mergedConfig.fw}</div>}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Logging Settings */}
                                {(otherConfig?.lsf !== undefined || otherConfig?.lse !== undefined || otherConfig?.lsw !== undefined || otherConfig?.lsi !== undefined || otherConfig?.lsd !== undefined || otherConfig?.lsev !== undefined || otherConfig?.lff !== undefined || otherConfig?.lfe !== undefined || otherConfig?.lfw !== undefined || otherConfig?.lfi !== undefined || otherConfig?.lfd !== undefined || otherConfig?.lfev !== undefined) && (
                                  <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                    <div className="font-semibold mb-1">📝 Logging Settings</div>
                                    <div className="space-y-1">
                                      <div className="grid grid-cols-2 gap-1 text-gray-500">
                                        <div className="font-medium text-xs mb-1">Serial Logging:</div>
                                        <div></div>
                                        {otherConfig?.lsf !== undefined && <div>Fatal: {otherConfig.lsf ? 'On' : 'Off'}</div>}
                                        {otherConfig?.lse !== undefined && <div>Error: {otherConfig.lse ? 'On' : 'Off'}</div>}
                                        {otherConfig?.lsw !== undefined && <div>Warning: {otherConfig.lsw ? 'On' : 'Off'}</div>}
                                        {otherConfig?.lsi !== undefined && <div>Info: {otherConfig.lsi ? 'On' : 'Off'}</div>}
                                        {otherConfig?.lsd !== undefined && <div>Debug: {otherConfig.lsd ? 'On' : 'Off'}</div>}
                                        {otherConfig?.lsev !== undefined && <div>Event: {otherConfig.lsev ? 'On' : 'Off'}</div>}
                                      </div>
                                      <div className="grid grid-cols-2 gap-1 text-gray-500 mt-2">
                                        <div className="font-medium text-xs mb-1">File Logging:</div>
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
                            <div className="mb-3">
                              <h5 className="font-medium mb-2 flex items-center gap-1">
                                <span>📡</span> Short Status (Latest)
                              </h5>
                              <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                <div className="grid grid-cols-2 gap-1 text-gray-500">
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
                          <div className="mb-3">
                            <h5 className="font-medium mb-2 flex items-center gap-1">
                              <span>🔊</span> Audio Details
                            </h5>
                            <div className="grid grid-cols-2 gap-2 ml-5">
                              {status.audio.currentDb !== undefined && (
                                <div>
                                  <span className="text-gray-500">Current dB:</span>
                                  <span className="ml-1">{status.audio.currentDb.toFixed(2)} dB</span>
                                </div>
                              )}
                              {status.audio.minDb !== undefined && (
                                <div>
                                  <span className="text-gray-500">Min dB:</span>
                                  <span className="ml-1">{status.audio.minDb.toFixed(2)} dB</span>
                                </div>
                              )}
                              {status.audio.maxDb !== undefined && (
                                <div>
                                  <span className="text-gray-500">Max dB:</span>
                                  <span className="ml-1">{status.audio.maxDb.toFixed(2)} dB</span>
                                </div>
                              )}
                              {status.audio.avgDb !== undefined && (
                                <div>
                                  <span className="text-gray-500">Avg dB:</span>
                                  <span className="ml-1">{status.audio.avgDb.toFixed(2)} dB</span>
                                </div>
                              )}
                              {status.audio.currentDynamic !== undefined && (
                                <div>
                                  <span className="text-gray-500">Dynamic Range:</span>
                                  <span className="ml-1">{status.audio.currentDynamic.toFixed(2)}%</span>
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
                          <div className="mb-3">
                            <h5 className="font-medium mb-2 flex items-center gap-1">
                              <span>📊</span> Health Metrics
                            </h5>
                            <div className="ml-5 space-y-2">
                              {sys && (
                                <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                  <div className="font-semibold mb-1">System health</div>
                                  <div className="grid grid-cols-2 gap-1 text-gray-500">
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
                                <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                  <div className="font-semibold mb-1">Recording session</div>
                                  <div className="grid grid-cols-2 gap-1 text-gray-500">
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
                                <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                  <div className="font-semibold mb-1">API response (ms)</div>
                                  <div className="grid grid-cols-2 gap-1 text-gray-500">
                                    {r.am != null && <div>Min: {r.am}</div>}
                                    {r.ax != null && <div>Max: {r.ax}</div>}
                                    {r.aa != null && <div>Avg: {typeof r.aa === 'number' ? r.aa.toFixed(1) : r.aa}</div>}
                                  </div>
                                </div>
                              )}
                              {Array.isArray(r.st) && r.st.length > 0 && (
                                <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                  <div className="font-semibold mb-1">Task stacks</div>
                                  <div className="space-y-1 text-gray-500">
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
                                <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                  <div className="font-semibold mb-1">Memory</div>
                                  <div className="grid grid-cols-2 gap-1 text-gray-500">
                                    {health.ht && <div>Heap Total: {health.ht}</div>}
                                    {health.hf && <div>Heap Free: {health.hf}</div>}
                                  </div>
                                </div>
                              )}
                              {(health.tv !== undefined || health.rt || (health.ut && !sys) || health.rs !== undefined || health.rd !== undefined) && (
                                      <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                        <div className="font-semibold mb-1">System Time & Recent Activity</div>
                                        <div className="grid grid-cols-2 gap-1 text-gray-500">
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
                                      <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                        <div className="font-semibold mb-1">Queue</div>
                                        <div className="grid grid-cols-2 gap-1 text-gray-500">
                                          {health.qm.mx !== undefined && <div>Max: {health.qm.mx}</div>}
                                          {health.qm.av !== undefined && <div>Avg: {health.qm.av.toFixed(2)}</div>}
                                          {health.qm.fl !== undefined && <div>Full: {health.qm.fl}</div>}
                                          {health.qm.rq !== undefined && <div>Requeue: {health.qm.rq}</div>}
                                        </div>
                                      </div>
                                    )}
                                    {/* Network Quality */}
                                    {health.nq && (
                                      <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                        <div className="font-semibold mb-1">Network Quality</div>
                                        <div className="grid grid-cols-2 gap-1 text-gray-500">
                                          {health.nq.ar !== undefined && <div>Avg RSSI: {health.nq.ar.toFixed(1)} dBm</div>}
                                          {health.nq.mr !== undefined && <div>Min RSSI: {health.nq.mr} dBm</div>}
                                          {health.nq.xr !== undefined && <div>Max RSSI: {health.nq.xr} dBm</div>}
                                          {health.nq.pl !== undefined && <div>Packet Loss: {health.nq.pl.toFixed(1)}%</div>}
                                        </div>
                                      </div>
                                    )}
                                    {/* Storage Health */}
                                    {health.sh && (
                                      <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                        <div className="font-semibold mb-1">Storage Health</div>
                                        <div className="grid grid-cols-2 gap-1 text-gray-500">
                                          {health.sh.ut !== undefined && <div>Utilization: {health.sh.ut.toFixed(2)}%</div>}
                                          {health.sh.we !== undefined && <div>Write Errors: {health.sh.we}</div>}
                                          {health.sh.re !== undefined && <div>Read Errors: {health.sh.re}</div>}
                                          {health.sh.ms !== undefined && <div>Mount Stable: {health.sh.ms ? 'Yes' : 'No'}</div>}
                                        </div>
                                      </div>
                                    )}
                                    {/* Mutex Metrics */}
                                    {health.mm && (
                                      <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                        <div className="font-semibold mb-1">Mutex Metrics</div>
                                        <div className="grid grid-cols-2 gap-1 text-gray-500">
                                          {health.mm.at !== undefined && <div>Attempts: {health.mm.at}</div>}
                                          {health.mm.to !== undefined && <div>Timeouts: {health.mm.to}</div>}
                                          {health.mm.rt !== undefined && <div>Timeout Rate: {health.mm.rt.toFixed(2)}%</div>}
                                          {health.mm.cs !== undefined && <div>Consecutive: {health.mm.cs}</div>}
                                        </div>
                                      </div>
                                    )}
                                    {/* NVS Health */}
                                    {health.nv && (
                                      <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                        <div className="font-semibold mb-1">NVS Health</div>
                                        <div className="grid grid-cols-2 gap-1 text-gray-500">
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
                                      <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                        <div className="font-semibold mb-1">Upload Queue Health</div>
                                        <div className="grid grid-cols-2 gap-1 text-gray-500">
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
                                      <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                        <div className="font-semibold mb-1">Upload Rate</div>
                                        <div className="grid grid-cols-2 gap-1 text-gray-500">
                                          {health.ur.ov !== undefined && health.ur.ov >= 0 && <div>Success Rate: {health.ur.ov.toFixed(1)}%</div>}
                                          {health.ur.at !== undefined && <div>Attempts: {health.ur.at}</div>}
                                          {health.ur.sc !== undefined && <div>Success: {health.ur.sc}</div>}
                                        </div>
                                      </div>
                                    )}
                                    {/* Endpoint Health */}
                                    {health.endpoints && Array.isArray(health.endpoints) && health.endpoints.length > 0 && (
                                      <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                        <div className="font-semibold mb-1">Endpoint Health</div>
                                        <div className="space-y-1">
                                          {health.endpoints.map((endpoint, idx) => (
                                            <div key={idx} className="text-gray-500">
                                              <div className="font-medium">{endpoint.ho || 'Unknown'}</div>
                                              <div className="grid grid-cols-2 gap-1 text-xs mt-1">
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
                                      <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                        <div className="font-semibold mb-1">Task Health</div>
                                        <div className="space-y-1">
                                          {Object.entries(health.th).map(([taskName, taskData]) => (
                                            <div key={taskName} className="text-gray-500">
                                              <span className="font-medium capitalize">{taskName}:</span>
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
                                      <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                        <div className="font-semibold mb-1">Upload Pending</div>
                                        <div className="grid grid-cols-2 gap-1 text-gray-500">
                                          {health.up.tp !== undefined && <div>Total Pending: <span className={health.up.tp > 0 ? 'text-orange-500 font-semibold' : ''}>{health.up.tp}</span></div>}
                                          {health.up.fq !== undefined && <div>FreeRTOS Queue: {health.up.fq}</div>}
                                          {health.up.nq !== undefined && <div>NVS Queue: {health.up.nq}</div>}
                                          {health.up.mf !== undefined && <div>Missed Files: <span className={health.up.mf > 0 ? 'text-red-500 font-semibold' : ''}>{health.up.mf}</span></div>}
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
                                      <div className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                        <div className="font-semibold mb-1">📅 {health.yr} Recording Summary</div>
                                        <div className="grid grid-cols-2 gap-1 text-gray-500">
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
                          <div className="mb-3">
                            <h5 className="font-medium mb-2 flex items-center gap-1">
                              <span>⚠️</span> Last {serialData[device.port].errorLogs.length} Errors/Warnings
                            </h5>
                            <div className="ml-5 space-y-1">
                              {serialData[device.port].errorLogs.map((log, index) => (
                                <div 
                                  key={index} 
                                  className={`text-xs p-2 rounded ${
                                    log.type === 'fatal' 
                                      ? (isDarkMode ? 'bg-red-900/30 border border-red-700/50' : 'bg-red-50 border border-red-200')
                                      : log.type === 'error'
                                      ? (isDarkMode ? 'bg-orange-900/20 border border-orange-700/30' : 'bg-orange-50 border border-orange-200')
                                      : (isDarkMode ? 'bg-yellow-900/20 border border-yellow-700/30' : 'bg-yellow-50 border border-yellow-200')
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className={`font-semibold uppercase ${
                                      log.type === 'fatal' 
                                        ? (isDarkMode ? 'text-red-400' : 'text-red-600')
                                        : log.type === 'error'
                                        ? (isDarkMode ? 'text-orange-400' : 'text-orange-600')
                                        : (isDarkMode ? 'text-yellow-400' : 'text-yellow-600')
                                    }`}>
                                      {log.type}
                                    </span>
                                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                                      {new Date(log.timestamp).toLocaleString()}
                                    </span>
                                  </div>
                                  <div className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                                    {log.message}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Reboot History */}
                        {rebootHistory[device.port] && rebootHistory[device.port].length > 0 && (
                          <div className="mb-3">
                            <h5 className="font-medium mb-2 flex items-center gap-1">
                              <span>🔄</span> Last 5 Reboots
                            </h5>
                            <div className="ml-5 space-y-1">
                              {rebootHistory[device.port].map((reboot, index) => (
                                <div key={index} className={`text-xs p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-500">Reboot #{rebootHistory[device.port].length - index}:</span>
                                    <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                                      {new Date(reboot.timestamp).toLocaleString()}
                                    </span>
                                  </div>
                                  {reboot.mac_address && (
                                    <div className="text-xs mt-1 text-gray-400">
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
      <div className="mt-12">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl shadow-md ${isDarkMode ? 'bg-purple-600' : 'bg-purple-500'}`}>
              <Package size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Firmware Management</h2>
              <p className={`mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Upload and manage ESP32 firmware files.
              </p>
            </div>
          </div>
          <button
            onClick={() => setFirmwareUploadModal({ open: true, name: '', files: {}, uploading: false, error: null })}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-300 ${
              isDarkMode
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-purple-500 hover:bg-purple-600 text-white'
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload Firmware
          </button>
        </div>

        {firmwares.length === 0 ? (
          <div className={`rounded-xl border-dashed border-2 p-10 text-center ${
            isDarkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-600'
          }`}>
            No firmware uploaded yet. Click "Upload Firmware" to add a firmware group.
          </div>
        ) : (
          <div className={`rounded-2xl border overflow-hidden ${cardClasses}`}>
            <table className="w-full">
              <thead className={`${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Name
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Description
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Files
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Created
                  </th>
                  <th className={`px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                {firmwares.map((firmware) => (
                  <tr key={firmware.id} className={`${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}>
                    <td className={`px-6 py-4 whitespace-nowrap ${
                      isDarkMode ? 'text-gray-200' : 'text-gray-900'
                    }`}>
                      <div className="font-medium">{firmware.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{firmware.id}</div>
                    </td>
                    <td className={`px-6 py-4 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      <div className="text-sm max-w-md">
                        {firmware.description || <span className="text-gray-500 italic">No description</span>}
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      <div className="flex flex-col gap-1 text-sm">
                        {Object.entries(firmware.files).map(([file, exists]) => (
                          <div key={file} className="flex items-center gap-2">
                            <span className={exists ? 'text-emerald-500' : 'text-red-500'}>
                              {exists ? '✓' : '✗'}
                            </span>
                            <span className={exists ? '' : 'text-gray-500'}>{file}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {firmware.created_at ? new Date(firmware.created_at).toLocaleDateString() : 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditFirmware(firmware)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
                            isDarkMode
                              ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                              : 'bg-indigo-500 hover:bg-indigo-600 text-white'
                          }`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Modify
                        </button>
                        <button
                          onClick={() => handleDeleteFirmware(firmware.id)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
                            isDarkMode
                              ? 'bg-red-600 hover:bg-red-500 text-white'
                              : 'bg-red-500 hover:bg-red-600 text-white'
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className={`w-full max-w-2xl rounded-2xl shadow-2xl border ${
            isDarkMode ? 'border-gray-700 bg-gray-900 text-gray-100' : 'border-gray-200 bg-white text-gray-900'
          }`}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/60">
              <h3 className="text-xl font-semibold">Upload Firmware</h3>
              <button
                onClick={() => setFirmwareUploadModal({ open: false, name: '', files: {}, uploading: false, error: null })}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                Close
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Firmware Name</label>
                <input
                  type="text"
                  value={firmwareUploadModal.name}
                  onChange={(e) => setFirmwareUploadModal((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Production v1.0"
                  className={`w-full rounded-lg border px-3 py-2 ${
                    isDarkMode
                      ? 'bg-gray-950 text-gray-100 border-gray-700'
                      : 'bg-gray-50 text-gray-900 border-gray-300'
                  }`}
                />
              </div>
              {['bootloader.bin', 'partitions.bin', 'firmware.bin'].map((fileType) => (
                <div key={fileType}>
                  <label className="block text-sm font-medium mb-2">{fileType}</label>
                  <input
                    type="file"
                    accept=".bin"
                    onChange={(e) => handleFirmwareFileChange(fileType, e.target.files[0])}
                    className={`w-full rounded-lg border px-3 py-2 text-sm ${
                      isDarkMode
                        ? 'bg-gray-950 text-gray-100 border-gray-700'
                        : 'bg-gray-50 text-gray-900 border-gray-300'
                    }`}
                  />
                </div>
              ))}
              {firmwareUploadModal.error && (
                <div className={`rounded-lg border px-3 py-2 text-sm ${
                  isDarkMode
                    ? 'border-red-600/60 bg-red-900/40 text-red-200'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}>
                  {firmwareUploadModal.error}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setFirmwareUploadModal({ open: false, name: '', files: {}, uploading: false, error: null })}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUploadFirmware}
                  disabled={firmwareUploadModal.uploading}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                    firmwareUploadModal.uploading
                      ? 'bg-purple-700/70 text-white cursor-not-allowed'
                      : isDarkMode
                        ? 'bg-purple-600 hover:bg-purple-500 text-white'
                        : 'bg-purple-500 hover:bg-purple-600 text-white'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  {firmwareUploadModal.uploading ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Flash Firmware Modal */}
      {flashModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className={`w-full max-w-2xl rounded-2xl shadow-2xl border ${
            isDarkMode ? 'border-gray-700 bg-gray-900 text-gray-100' : 'border-gray-200 bg-white text-gray-900'
          }`}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/60">
              <h3 className="text-xl font-semibold">Flash Firmware</h3>
              <button
                onClick={handleCloseFlashModal}
                disabled={flashModal.flashing && flashProgress.status === 'running'}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                } ${flashModal.flashing && flashProgress.status === 'running' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {flashModal.flashing && flashProgress.status === 'running' ? 'Flashing...' : 'Close'}
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Port</label>
                <input
                  type="text"
                  value={flashModal.port || ''}
                  disabled
                  className={`w-full rounded-lg border px-3 py-2 ${
                    isDarkMode
                      ? 'bg-gray-950 text-gray-400 border-gray-700'
                      : 'bg-gray-50 text-gray-500 border-gray-300'
                  }`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Firmware</label>
                <select
                  value={flashModal.firmwareId}
                  onChange={(e) => setFlashModal((prev) => ({ ...prev, firmwareId: e.target.value }))}
                  disabled={flashModal.flashing}
                  className={`w-full rounded-lg border px-3 py-2 ${
                    isDarkMode
                      ? 'bg-gray-950 text-gray-100 border-gray-700'
                      : 'bg-gray-50 text-gray-900 border-gray-300'
                  } ${flashModal.flashing ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Progress</span>
                      <span className="text-sm text-gray-500">{flashProgress.progress}%</span>
                    </div>
                    <div className={`w-full h-3 rounded-full overflow-hidden ${
                      isDarkMode ? 'bg-gray-800' : 'bg-gray-200'
                    }`}>
                      <div
                        className={`h-full transition-all duration-300 ${
                          flashProgress.status === 'completed'
                            ? 'bg-emerald-500'
                            : flashProgress.status === 'failed'
                            ? 'bg-red-500'
                            : 'bg-purple-500'
                        }`}
                        style={{ width: `${flashProgress.progress}%` }}
                      />
                    </div>
                  </div>
                  {flashProgress.message && (
                    <div className={`rounded-lg border px-3 py-2 text-sm ${
                      flashProgress.status === 'completed'
                        ? isDarkMode
                          ? 'border-emerald-600/60 bg-emerald-900/40 text-emerald-200'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : flashProgress.status === 'failed'
                        ? isDarkMode
                          ? 'border-red-600/60 bg-red-900/40 text-red-200'
                          : 'border-red-200 bg-red-50 text-red-700'
                        : isDarkMode
                        ? 'border-blue-600/60 bg-blue-900/40 text-blue-200'
                        : 'border-blue-200 bg-blue-50 text-blue-700'
                    }`}>
                      {flashProgress.message}
                    </div>
                  )}
                  {flashProgress.output && (
                    <div className={`rounded-lg border p-3 text-xs font-mono max-h-40 overflow-y-auto ${
                      isDarkMode
                        ? 'bg-gray-950 text-gray-300 border-gray-700'
                        : 'bg-gray-50 text-gray-800 border-gray-300'
                    }`}>
                      <pre className="whitespace-pre-wrap">{flashProgress.output}</pre>
                    </div>
                  )}
                </div>
              )}

              {flashModal.error && (
                <div className={`rounded-lg border px-3 py-2 text-sm ${
                  isDarkMode
                    ? 'border-red-600/60 bg-red-900/40 text-red-200'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}>
                  {flashModal.error}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={handleCloseFlashModal}
                  disabled={flashModal.flashing && flashProgress.status === 'running'}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  } ${flashModal.flashing && flashProgress.status === 'running' ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {flashProgress.status === 'completed' || flashProgress.status === 'failed' ? 'Close' : 'Cancel'}
                </button>
                {flashProgress.status !== 'running' && (
                  <button
                    onClick={handleFlashFirmware}
                    disabled={flashModal.flashing || !flashModal.firmwareId}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                      flashModal.flashing || !flashModal.firmwareId
                        ? 'bg-purple-700/70 text-white cursor-not-allowed'
                        : isDarkMode
                          ? 'bg-purple-600 hover:bg-purple-500 text-white'
                          : 'bg-purple-500 hover:bg-purple-600 text-white'
                    }`}
                  >
                    <Zap className="w-4 h-4" />
                    {flashProgress.status === 'completed' ? 'Flash Again' : 'Flash'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Firmware Edit Modal */}
      {firmwareEditModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className={`w-full max-w-2xl rounded-2xl shadow-2xl border ${
            isDarkMode ? 'border-gray-700 bg-gray-900 text-gray-100' : 'border-gray-200 bg-white text-gray-900'
          }`}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/60">
              <h3 className="text-xl font-semibold">Edit Firmware</h3>
              <button
                onClick={() => setFirmwareEditModal({ open: false, firmware: null, name: '', description: '', saving: false, error: null })}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                Close
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Firmware Name</label>
                <input
                  type="text"
                  value={firmwareEditModal.name}
                  onChange={(e) => setFirmwareEditModal((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Production v1.0"
                  className={`w-full rounded-lg border px-3 py-2 ${
                    isDarkMode
                      ? 'bg-gray-950 text-gray-100 border-gray-700'
                      : 'bg-gray-50 text-gray-900 border-gray-300'
                  }`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={firmwareEditModal.description}
                  onChange={(e) => setFirmwareEditModal((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter firmware description..."
                  rows={4}
                  className={`w-full rounded-lg border px-3 py-2 ${
                    isDarkMode
                      ? 'bg-gray-950 text-gray-100 border-gray-700'
                      : 'bg-gray-50 text-gray-900 border-gray-300'
                  }`}
                />
              </div>
              {firmwareEditModal.error && (
                <div className={`rounded-lg border px-3 py-2 text-sm ${
                  isDarkMode
                    ? 'border-red-600/60 bg-red-900/40 text-red-200'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}>
                  {firmwareEditModal.error}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setFirmwareEditModal({ open: false, firmware: null, name: '', description: '', saving: false, error: null })}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveFirmwareEdit}
                  disabled={firmwareEditModal.saving}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                    firmwareEditModal.saving
                      ? 'bg-purple-700/70 text-white cursor-not-allowed'
                      : isDarkMode
                        ? 'bg-purple-600 hover:bg-purple-500 text-white'
                        : 'bg-purple-500 hover:bg-purple-600 text-white'
                  }`}
                >
                  <SaveIcon className="w-4 h-4" />
                  {firmwareEditModal.saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecorderDevices;
