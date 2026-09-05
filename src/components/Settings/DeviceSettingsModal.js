import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/apiClient';
import { X, Settings2, Mic, Wifi, FileText, Sliders, RefreshCw } from 'lucide-react';

const DeviceSettingsModal = ({ 
  isOpen, 
  onClose, 
  devicePort, 
  isDarkMode,
  monitorMessages = [],
  deviceStatus = {},
  serialData = {}
}) => {
  const [activeTab, setActiveTab] = useState('recorder');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Recorder Settings
  const [recorderSettings, setRecorderSettings] = useState({
    audioThreshold: 50.0, // threshold (0.0 to 100.0)
    minRecording: 1000,
    maxRecording: 30000,
    silenceThreshold: 1000,
    preRecord: 200,
    gain: 3
  });

  // Network Settings
  const [networkSettings, setNetworkSettings] = useState({
    wifiEnabled: true,
    ssid0: '',
    pass0: '',
    ssid1: '',
    pass1: '',
    ssid2: '',
    pass2: '',
    staticIpEnabled: false,
    staticIp: '',
    staticSubnet: '',
    staticGateway: '',
    staticDns1: '',
    staticDns2: '',
    wifiTxPower: 8,
    apiHost0: '',
    apiHost1: '',
    apiHost2: '',
    apiPort0: '',
    apiPort1: '',
    apiPort2: '',
    apiEnabled0: false,
    apiEnabled1: false,
    apiEnabled2: false
  });

  // Logging Settings
  const [loggingSettings, setLoggingSettings] = useState({
    debug: false,
    info: false,
    warn: false,
    error: false,
    fatal: false,
    event: false
  });

  // Advanced Settings
  const [advancedSettings, setAdvancedSettings] = useState({
    useSdCard: '',
    recordToSdCard: '',
    timezoneOffset: '',
    rtcEnabled: ''
  });

  const responseTimeoutRef = useRef(null);
  const lastCommandRef = useRef(null);

  // Watch for responses in monitor messages
  useEffect(() => {
    if (!isOpen || !lastCommandRef.current) return;

    const checkForResponse = () => {
      const recentMessages = monitorMessages
        .filter(msg => msg.port === devicePort)
        .slice(-20); // Check last 20 messages for export JSON

      for (const msg of recentMessages) {
        const messageText = msg.message || '';
        
        // Check if this is an export command response (JSON)
        if (lastCommandRef.current === 'export') {
          // Try to parse JSON from the message
          // The export command returns JSON, which might be on a single line or multiple lines
          try {
            // Try to extract JSON from the message
            // JSON might start with { and end with }
            const jsonMatch = messageText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const jsonStr = jsonMatch[0];
              const settings = JSON.parse(jsonStr);
              
              // Populate recorder settings from 'a' (audio) object
              // Field codes per CLI.md: ath=threshold, mi=minRecording, mx=maxRecording, etc.
              if (settings.a) {
                if (settings.a.ath !== undefined) {
                  // Clamp threshold to valid range (0.0 to 100.0)
                  const clampedThreshold = Math.max(0.0, Math.min(100.0, settings.a.ath));
                  setRecorderSettings(prev => ({ ...prev, audioThreshold: clampedThreshold }));
                }
                // Field codes per CLI.md: mi=minRecording, mx=maxRecording, sth=silenceThreshold, pr=preRecord, gn=gain
                if (settings.a.mi !== undefined) {
                  setRecorderSettings(prev => ({ ...prev, minRecording: settings.a.mi }));
                } else if (settings.a.mrm !== undefined) {
                  // Legacy support
                  setRecorderSettings(prev => ({ ...prev, minRecording: settings.a.mrm }));
                }
                if (settings.a.mx !== undefined) {
                  setRecorderSettings(prev => ({ ...prev, maxRecording: settings.a.mx }));
                } else if (settings.a.xrm !== undefined) {
                  // Legacy support
                  setRecorderSettings(prev => ({ ...prev, maxRecording: settings.a.xrm }));
                }
                if (settings.a.sth !== undefined) {
                  setRecorderSettings(prev => ({ ...prev, silenceThreshold: settings.a.sth }));
                } else if (settings.a.stm !== undefined) {
                  // Legacy support
                  setRecorderSettings(prev => ({ ...prev, silenceThreshold: settings.a.stm }));
                }
                if (settings.a.pr !== undefined) {
                  setRecorderSettings(prev => ({ ...prev, preRecord: settings.a.pr }));
                } else if (settings.a.prm !== undefined) {
                  // Legacy support
                  setRecorderSettings(prev => ({ ...prev, preRecord: settings.a.prm }));
                }
                if (settings.a.gn !== undefined) {
                  setRecorderSettings(prev => ({ ...prev, gain: settings.a.gn }));
                } else if (settings.a.cg !== undefined) {
                  // Legacy support
                  setRecorderSettings(prev => ({ ...prev, gain: settings.a.cg }));
                }
              }
              
              // Populate network settings from 'w' (wifi) array
              // Using short keys: ss (ssid), pw (password), sie, sip, ssn, sgt, sd1, sd2
              if (settings.w && Array.isArray(settings.w) && settings.w[0]) {
                const wifi0 = settings.w[0];
                if (wifi0.ss !== undefined) {
                  setNetworkSettings(prev => ({ ...prev, ssid0: wifi0.ss || '' }));
                }
                if (wifi0.pw !== undefined) {
                  setNetworkSettings(prev => ({ ...prev, pass0: wifi0.pw || '' }));
                }
                if (wifi0.sie !== undefined) {
                  setNetworkSettings(prev => ({ ...prev, staticIpEnabled: wifi0.sie || false }));
                }
                if (wifi0.sip !== undefined) {
                  setNetworkSettings(prev => ({ ...prev, staticIp: wifi0.sip || '' }));
                }
                if (wifi0.ssn !== undefined) {
                  setNetworkSettings(prev => ({ ...prev, staticSubnet: wifi0.ssn || '' }));
                }
                if (wifi0.sgt !== undefined) {
                  setNetworkSettings(prev => ({ ...prev, staticGateway: wifi0.sgt || '' }));
                }
                if (wifi0.sd1 !== undefined) {
                  setNetworkSettings(prev => ({ ...prev, staticDns1: wifi0.sd1 || '' }));
                }
                if (wifi0.sd2 !== undefined) {
                  setNetworkSettings(prev => ({ ...prev, staticDns2: wifi0.sd2 || '' }));
                }
              }
              
              // WiFi TX Power from top-level 'wtp' key
              if (settings.wtp !== undefined) {
                setNetworkSettings(prev => ({ ...prev, wifiTxPower: settings.wtp || 8 }));
              }
              
              // Populate API host settings from 'u' (upload) object
              // Using short keys: ah (apiHosts array), ap (apiPorts array), en (enabled array)
              if (settings.u) {
                if (settings.u.ah && Array.isArray(settings.u.ah)) {
                  if (settings.u.ah[0] !== undefined && settings.u.ah[0] !== null && settings.u.ah[0] !== '') {
                    setNetworkSettings(prev => ({ ...prev, apiHost0: settings.u.ah[0] || '' }));
                  }
                  if (settings.u.ah[1] !== undefined && settings.u.ah[1] !== null && settings.u.ah[1] !== '') {
                    setNetworkSettings(prev => ({ ...prev, apiHost1: settings.u.ah[1] || '' }));
                  }
                  if (settings.u.ah[2] !== undefined && settings.u.ah[2] !== null && settings.u.ah[2] !== '') {
                    setNetworkSettings(prev => ({ ...prev, apiHost2: settings.u.ah[2] || '' }));
                  }
                }
                if (settings.u.ap && Array.isArray(settings.u.ap)) {
                  if (settings.u.ap[0] !== undefined && settings.u.ap[0] !== null) {
                    setNetworkSettings(prev => ({ ...prev, apiPort0: settings.u.ap[0].toString() || '' }));
                  }
                  if (settings.u.ap[1] !== undefined && settings.u.ap[1] !== null) {
                    setNetworkSettings(prev => ({ ...prev, apiPort1: settings.u.ap[1].toString() || '' }));
                  }
                  if (settings.u.ap[2] !== undefined && settings.u.ap[2] !== null) {
                    setNetworkSettings(prev => ({ ...prev, apiPort2: settings.u.ap[2].toString() || '' }));
                  }
                }
                if (settings.u.en && Array.isArray(settings.u.en)) {
                  if (settings.u.en[0] !== undefined) {
                    setNetworkSettings(prev => ({ ...prev, apiEnabled0: settings.u.en[0] || false }));
                  }
                  if (settings.u.en[1] !== undefined) {
                    setNetworkSettings(prev => ({ ...prev, apiEnabled1: settings.u.en[1] || false }));
                  }
                  if (settings.u.en[2] !== undefined) {
                    setNetworkSettings(prev => ({ ...prev, apiEnabled2: settings.u.en[2] || false }));
                  }
                }
              }
              
              // Populate advanced settings from 's' (SD card), 't' (timezone), 'r' (RTC)
              // Using short keys: usc, rsc, oh, en
              if (settings.s) {
                if (settings.s.usc !== undefined) {
                  setAdvancedSettings(prev => ({ ...prev, useSdCard: settings.s.usc ? 'true' : 'false' }));
                }
                if (settings.s.rsc !== undefined) {
                  setAdvancedSettings(prev => ({ ...prev, recordToSdCard: settings.s.rsc ? 'true' : 'false' }));
                }
              }
              if (settings.t) {
                if (settings.t.oh !== undefined) {
                  setAdvancedSettings(prev => ({ ...prev, timezoneOffset: settings.t.oh }));
                }
              }
              if (settings.r) {
                if (settings.r.en !== undefined) {
                  setAdvancedSettings(prev => ({ ...prev, rtcEnabled: settings.r.en ? 'true' : 'false' }));
                }
              }
              
              // Populate logging settings from 'l' (log) object
              // Using short keys: sf, se, sw, si, sd, sev for serial logging
              if (settings.l) {
                if (settings.l.sf !== undefined) {
                  setLoggingSettings(prev => ({ ...prev, fatal: settings.l.sf || false }));
                }
                if (settings.l.se !== undefined) {
                  setLoggingSettings(prev => ({ ...prev, error: settings.l.se || false }));
                }
                if (settings.l.sw !== undefined) {
                  setLoggingSettings(prev => ({ ...prev, warn: settings.l.sw || false }));
                }
                if (settings.l.si !== undefined) {
                  setLoggingSettings(prev => ({ ...prev, info: settings.l.si || false }));
                }
                if (settings.l.sd !== undefined) {
                  setLoggingSettings(prev => ({ ...prev, debug: settings.l.sd || false }));
                }
                if (settings.l.sev !== undefined) {
                  setLoggingSettings(prev => ({ ...prev, event: settings.l.sev || false }));
                }
              }
              
              // Clear loading and reset command tracking
              setLoading(false);
              lastCommandRef.current = null;
              if (responseTimeoutRef.current) {
                clearTimeout(responseTimeoutRef.current);
                responseTimeoutRef.current = null;
              }
              return;
            }
          } catch (err) {
            // Not a valid JSON, continue checking
          }
        }
        
        // Check for import command responses
        if (lastCommandRef.current && lastCommandRef.current.startsWith('import')) {
          const messageLower = messageText.toLowerCase();
          
          // Check for settings_begin failure or other critical errors
          if (messageLower.includes('settings_begin failed') || 
              (messageLower.includes('settings_begin') && messageLower.includes('failed')) ||
              (messageLower.includes('nvs') && messageLower.includes('error')) ||
              (messageLower.includes('psram') && messageLower.includes('error'))) {
            setError('Device storage error: settings_begin failed. The device may need to be reset or the NVS partition may be corrupted.');
            setSuccess(null);
            setSaving(false);
            lastCommandRef.current = null;
            if (responseTimeoutRef.current) {
              clearTimeout(responseTimeoutRef.current);
              responseTimeoutRef.current = null;
            }
            return;
          }
          
          // Check for general import errors
          if (messageLower.includes('import') && (messageLower.includes('failed') || messageLower.includes('error'))) {
            setError('Failed to import settings. Please check the device logs.');
            setSuccess(null);
            setSaving(false);
            lastCommandRef.current = null;
            if (responseTimeoutRef.current) {
              clearTimeout(responseTimeoutRef.current);
              responseTimeoutRef.current = null;
            }
            return;
          }
          
          // Check for OK/success response
          if (messageLower.includes('ok') && !messageLower.includes('error') && !messageLower.includes('failed')) {
            setSuccess('Settings updated successfully');
            setError(null);
            setSaving(false);
            lastCommandRef.current = null;
            if (responseTimeoutRef.current) {
              clearTimeout(responseTimeoutRef.current);
              responseTimeoutRef.current = null;
            }
            // Refresh settings after a delay
            setTimeout(() => {
              fetchCurrentSettings();
            }, 1000);
            return;
          }
        }
        
        // Check for OK response (for set commands)
        if (lastCommandRef.current && lastCommandRef.current.startsWith('set')) {
          const messageLower = messageText.toLowerCase();
          if (messageLower.includes('ok') && !messageLower.includes('error')) {
            setSuccess('Setting updated successfully');
            setError(null);
            lastCommandRef.current = null;
            if (responseTimeoutRef.current) {
              clearTimeout(responseTimeoutRef.current);
              responseTimeoutRef.current = null;
            }
            // Refresh settings after a delay
            setTimeout(() => {
              fetchCurrentSettings();
            }, 1000);
            return;
          }
          
          // Check for FAILED response
          if (messageLower.includes('failed') || messageLower.includes('error')) {
            setError('Failed to update setting');
            setSuccess(null);
            lastCommandRef.current = null;
            if (responseTimeoutRef.current) {
              clearTimeout(responseTimeoutRef.current);
              responseTimeoutRef.current = null;
            }
            return;
          }
        }
      }
    };

    const interval = setInterval(checkForResponse, 500);
    return () => clearInterval(interval);
  }, [isOpen, devicePort, monitorMessages]);

  // Initialize settings from device status/config when modal opens
  useEffect(() => {
    if (isOpen && devicePort) {
      // Try to get settings from device status/config
      const config = serialData[devicePort]?.config?.data || {};
      const status = deviceStatus || {};
      const ath = config.ath;
      const mrm = config.mrm ?? config.mi;
      const xrm = config.xrm ?? config.mx;
      const stm = config.stm ?? config.sth;
      const prm = config.prm ?? config.pr;
      const cg = config.cg ?? config.gn;

      // Populate recorder settings (DEVICE_SERIAL.md: ath, mrm, xrm, stm, prm, cg)
      if (ath !== undefined || config.ath !== undefined || status.threshold !== undefined) {
        const threshold =
          ath !== undefined ? ath : config.ath !== undefined ? config.ath : status.threshold !== undefined ? status.threshold : 50.0;
        const clampedThreshold = Math.max(0.0, Math.min(100.0, threshold));
        setRecorderSettings(prev => ({ ...prev, audioThreshold: clampedThreshold }));
      }
      if (mrm !== undefined || status.minRecording !== undefined) {
        setRecorderSettings(prev => ({
          ...prev,
          minRecording: mrm !== undefined ? mrm : status.minRecording !== undefined ? status.minRecording : 1000
        }));
      }
      if (xrm !== undefined || status.maxRecording !== undefined) {
        setRecorderSettings(prev => ({
          ...prev,
          maxRecording: xrm !== undefined ? xrm : status.maxRecording !== undefined ? status.maxRecording : 30000
        }));
      }
      if (stm !== undefined || status.silenceThreshold !== undefined) {
        setRecorderSettings(prev => ({
          ...prev,
          silenceThreshold: stm !== undefined ? stm : status.silenceThreshold !== undefined ? status.silenceThreshold : 1000
        }));
      }
      if (prm !== undefined || status.prerecording !== undefined) {
        setRecorderSettings(prev => ({
          ...prev,
          preRecord: prm !== undefined ? prm : status.prerecording !== undefined ? status.prerecording : 200
        }));
      }
      if (cg !== undefined || status.gain !== undefined) {
        setRecorderSettings(prev => ({ ...prev, gain: cg !== undefined ? cg : status.gain !== undefined ? status.gain : 3 }));
      }
      
      // Populate network settings
      if (config.ss !== undefined || status.ssid !== undefined) {
        setNetworkSettings(prev => ({ ...prev, ssid0: config.ss || status.ssid || '' }));
      }
      if (config.sie !== undefined || status.staticIpEnabled !== undefined) {
        setNetworkSettings(prev => ({ ...prev, staticIpEnabled: config.sie || status.staticIpEnabled || false }));
      }
      if (status.staticIp) {
        setNetworkSettings(prev => ({ ...prev, staticIp: status.staticIp || '' }));
      }
      if (status.staticSubnet) {
        setNetworkSettings(prev => ({ ...prev, staticSubnet: status.staticSubnet || '' }));
      }
      if (status.staticGateway) {
        setNetworkSettings(prev => ({ ...prev, staticGateway: status.staticGateway || '' }));
      }
      if (status.staticDns1) {
        setNetworkSettings(prev => ({ ...prev, staticDns1: status.staticDns1 || '' }));
      }
      if (status.staticDns2) {
        setNetworkSettings(prev => ({ ...prev, staticDns2: status.staticDns2 || '' }));
      }
      if (config.wtp !== undefined || status.wifiTxPower !== undefined) {
        setNetworkSettings(prev => ({ ...prev, wifiTxPower: config.wtp || status.wifiTxPower || 8 }));
      }
      
      // Populate advanced settings
      if (config.usc !== undefined || status.useSdCard !== undefined) {
        setAdvancedSettings(prev => ({ ...prev, useSdCard: config.usc || status.useSdCard ? 'true' : 'false' }));
      }
      if (config.rsc !== undefined || status.recordToSdCard !== undefined) {
        setAdvancedSettings(prev => ({ ...prev, recordToSdCard: config.rsc || status.recordToSdCard ? 'true' : 'false' }));
      }
      if (config.oh !== undefined || status.offsetHours !== undefined) {
        setAdvancedSettings(prev => ({ ...prev, timezoneOffset: config.oh || status.offsetHours || '' }));
      }
      if (config.rte !== undefined || status.rtcEnabled !== undefined) {
        setAdvancedSettings(prev => ({ ...prev, rtcEnabled: config.rte || status.rtcEnabled ? 'true' : 'false' }));
      }
      
      // Also fetch current settings via export command to ensure we have the latest
      // Use a small delay to let the modal render first
      setTimeout(() => {
        fetchCurrentSettings();
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, devicePort]);

  const fetchCurrentSettings = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Send single export command to get all settings as JSON
      lastCommandRef.current = 'export';
      
      // Set timeout for response
      if (responseTimeoutRef.current) {
        clearTimeout(responseTimeoutRef.current);
      }
      
      responseTimeoutRef.current = setTimeout(() => {
        setError('Timeout waiting for export response');
        setLoading(false);
        lastCommandRef.current = null;
      }, 10000); // 10 second timeout for export

      // Send export command
      await api.post(`/recorders/monitor/send`, {
        command: 'export',
        ports: [devicePort]
      });

      // Response will be handled by the useEffect watching monitor messages
    } catch (err) {
      setError('Failed to send export command');
      setLoading(false);
      lastCommandRef.current = null;
      if (responseTimeoutRef.current) {
        clearTimeout(responseTimeoutRef.current);
        responseTimeoutRef.current = null;
      }
    }
  };

  const sendCommand = async (command, showFeedback = true) => {
    if (!devicePort) return;

    try {
      lastCommandRef.current = command;
      setError(null);
      setSuccess(null);

      if (showFeedback) {
        setSaving(true);
      }

      // Set timeout for response
      if (responseTimeoutRef.current) {
        clearTimeout(responseTimeoutRef.current);
      }
      
      responseTimeoutRef.current = setTimeout(() => {
        setError('No response received from device');
        setSaving(false);
        lastCommandRef.current = null;
      }, 5000);

      // Send command via monitor endpoint
      await api.post(`/recorders/monitor/send`, {
        command: command,
        ports: [devicePort]
      });

      if (!showFeedback) {
        // For show commands, don't wait for response
        return;
      }

      // Response will be handled by the useEffect watching monitor messages
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send command');
      setSaving(false);
      lastCommandRef.current = null;
      if (responseTimeoutRef.current) {
        clearTimeout(responseTimeoutRef.current);
        responseTimeoutRef.current = null;
      }
    }
  };

  const handleRecorderSettingChange = (field, value) => {
    setRecorderSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSetRecorderDefaults = () => {
    setRecorderSettings({
      audioThreshold: 50.0, // Threshold (0.0 to 100.0)
      minRecording: 1000,
      maxRecording: 30000,
      silenceThreshold: 1000,
      preRecord: 200,
      gain: 3
    });
  };

  const handleNetworkSettingChange = (field, value) => {
    setNetworkSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleLoggingSettingChange = (field, value) => {
    setLoggingSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleAdvancedSettingChange = (field, value) => {
    setAdvancedSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveRecorderSettings = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Build JSON object with short keys for audio settings
      // Field codes per CLI.md: ath=Threshold, mi=minRecording, mx=maxRecording, etc.
      const audioObj = {};
      
      if (recorderSettings.audioThreshold !== undefined && recorderSettings.audioThreshold !== '') {
        // Clamp threshold to valid range (0.0 to 100.0) and use 'ath' field code
        const clampedThreshold = Math.max(0.0, Math.min(100.0, recorderSettings.audioThreshold));
        audioObj.ath = clampedThreshold;
      }
      // Field codes per CLI.md: mi=minRecording, mx=maxRecording, sth=silenceThreshold, pr=preRecord, gn=gain
      if (recorderSettings.minRecording !== undefined && recorderSettings.minRecording !== '') {
        audioObj.mi = recorderSettings.minRecording;
      }
      if (recorderSettings.maxRecording !== undefined && recorderSettings.maxRecording !== '') {
        audioObj.mx = recorderSettings.maxRecording;
      }
      if (recorderSettings.silenceThreshold !== undefined && recorderSettings.silenceThreshold !== '') {
        audioObj.sth = recorderSettings.silenceThreshold;
      }
      if (recorderSettings.preRecord !== undefined && recorderSettings.preRecord !== '') {
        audioObj.pr = recorderSettings.preRecord;
      }
      if (recorderSettings.gain !== undefined && recorderSettings.gain !== '') {
        audioObj.gn = recorderSettings.gain;
      }

      // Build JSON payload
      const jsonPayload = { a: audioObj };
      
      // Validate that we have at least one setting to save
      if (Object.keys(audioObj).length === 0) {
        setError('No settings to save');
        setSaving(false);
        return;
      }
      
      const importCommand = `import ${JSON.stringify(jsonPayload)}`;

      // Send import command
      lastCommandRef.current = importCommand;
      await api.post(`/recorders/monitor/send`, {
        command: importCommand,
        ports: [devicePort]
      });

      setSuccess('Recorder settings updated');
      setTimeout(() => {
        setSuccess(null);
        setSaving(false);
        lastCommandRef.current = null;
      }, 2000);
    } catch (err) {
      setError('Failed to save recorder settings');
      setSaving(false);
      lastCommandRef.current = null;
    }
  };

  const handleSaveNetworkSettings = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Build JSON object with short keys
      const jsonPayload = {};
      
      // WiFi settings array (w[0])
      const wifi0 = {};
      if (networkSettings.ssid0) {
        wifi0.ss = networkSettings.ssid0;
      }
      if (networkSettings.pass0) {
        wifi0.pw = networkSettings.pass0;
      }
      if (networkSettings.staticIpEnabled !== undefined) {
        wifi0.sie = networkSettings.staticIpEnabled;
      }
      if (networkSettings.staticIp) {
        wifi0.sip = networkSettings.staticIp;
      }
      if (networkSettings.staticSubnet) {
        wifi0.ssn = networkSettings.staticSubnet;
      }
      if (networkSettings.staticGateway) {
        wifi0.sgt = networkSettings.staticGateway;
      }
      if (networkSettings.staticDns1) {
        wifi0.sd1 = networkSettings.staticDns1;
      }
      if (networkSettings.staticDns2) {
        wifi0.sd2 = networkSettings.staticDns2;
      }
      
      // Only add wifi array if there are settings
      if (Object.keys(wifi0).length > 0) {
        jsonPayload.w = [wifi0];
      }
      
      // WiFi TX Power (top-level)
      if (networkSettings.wifiTxPower !== undefined && networkSettings.wifiTxPower !== '') {
        jsonPayload.wtp = networkSettings.wifiTxPower;
      }
      
      // API Host settings (upload object)
      const uploadObj = {};
      const apiHosts = [];
      const apiPorts = [];
      const apiEnabled = [];
      
      // Build arrays - only include non-empty values
      if (networkSettings.apiHost0 && networkSettings.apiHost0.trim() !== '') {
        apiHosts[0] = networkSettings.apiHost0;
      }
      if (networkSettings.apiHost1 && networkSettings.apiHost1.trim() !== '') {
        apiHosts[1] = networkSettings.apiHost1;
      }
      if (networkSettings.apiHost2 && networkSettings.apiHost2.trim() !== '') {
        apiHosts[2] = networkSettings.apiHost2;
      }
      
      if (networkSettings.apiPort0 && networkSettings.apiPort0.trim() !== '') {
        const port = parseInt(networkSettings.apiPort0, 10);
        if (!isNaN(port)) {
          apiPorts[0] = port;
        }
      }
      if (networkSettings.apiPort1 && networkSettings.apiPort1.trim() !== '') {
        const port = parseInt(networkSettings.apiPort1, 10);
        if (!isNaN(port)) {
          apiPorts[1] = port;
        }
      }
      if (networkSettings.apiPort2 && networkSettings.apiPort2.trim() !== '') {
        const port = parseInt(networkSettings.apiPort2, 10);
        if (!isNaN(port)) {
          apiPorts[2] = port;
        }
      }
      
      if (networkSettings.apiEnabled0 !== undefined) {
        apiEnabled[0] = networkSettings.apiEnabled0;
      }
      if (networkSettings.apiEnabled1 !== undefined) {
        apiEnabled[1] = networkSettings.apiEnabled1;
      }
      if (networkSettings.apiEnabled2 !== undefined) {
        apiEnabled[2] = networkSettings.apiEnabled2;
      }
      
      // Only add arrays if they have at least one element
      if (apiHosts[0] !== undefined || apiHosts[1] !== undefined || apiHosts[2] !== undefined) {
        uploadObj.ah = apiHosts;
      }
      if (apiPorts[0] !== undefined || apiPorts[1] !== undefined || apiPorts[2] !== undefined) {
        uploadObj.ap = apiPorts;
      }
      if (apiEnabled[0] !== undefined || apiEnabled[1] !== undefined || apiEnabled[2] !== undefined) {
        uploadObj.en = apiEnabled;
      }
      
      // Only add upload object if there are settings
      if (Object.keys(uploadObj).length > 0) {
        jsonPayload.u = uploadObj;
      }

      // Validate that we have at least one setting to save
      if (Object.keys(jsonPayload).length === 0) {
        setError('No settings to save');
        setSaving(false);
        return;
      }

      // Send import command
      const importCommand = `import ${JSON.stringify(jsonPayload)}`;
      lastCommandRef.current = importCommand;
      await api.post(`/recorders/monitor/send`, {
        command: importCommand,
        ports: [devicePort]
      });

      setSuccess('Network settings updated');
      setTimeout(() => {
        setSuccess(null);
        setSaving(false);
        lastCommandRef.current = null;
      }, 2000);
    } catch (err) {
      setError('Failed to save network settings');
      setSaving(false);
      lastCommandRef.current = null;
    }
  };

  const handleSaveLoggingSettings = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Build JSON object with short keys for logging settings
      const logObj = {};
      
      if (loggingSettings.fatal !== undefined) {
        logObj.sf = loggingSettings.fatal;
      }
      if (loggingSettings.error !== undefined) {
        logObj.se = loggingSettings.error;
      }
      if (loggingSettings.warn !== undefined) {
        logObj.sw = loggingSettings.warn;
      }
      if (loggingSettings.info !== undefined) {
        logObj.si = loggingSettings.info;
      }
      if (loggingSettings.debug !== undefined) {
        logObj.sd = loggingSettings.debug;
      }
      if (loggingSettings.event !== undefined) {
        logObj.sev = loggingSettings.event;
      }

      // Build JSON payload
      const jsonPayload = { l: logObj };
      
      // Validate that we have at least one setting to save
      if (Object.keys(logObj).length === 0) {
        setError('No settings to save');
        setSaving(false);
        return;
      }
      
      const importCommand = `import ${JSON.stringify(jsonPayload)}`;

      // Send import command
      lastCommandRef.current = importCommand;
      await api.post(`/recorders/monitor/send`, {
        command: importCommand,
        ports: [devicePort]
      });

      setSuccess('Logging settings updated');
      setTimeout(() => {
        setSuccess(null);
        setSaving(false);
        lastCommandRef.current = null;
      }, 2000);
    } catch (err) {
      setError('Failed to save logging settings');
      setSaving(false);
      lastCommandRef.current = null;
    }
  };

  const handleSaveAdvancedSettings = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Build JSON object with short keys
      const jsonPayload = {};
      
      // SD Card settings
      const sdObj = {};
      if (advancedSettings.useSdCard !== undefined && advancedSettings.useSdCard !== '') {
        sdObj.usc = advancedSettings.useSdCard === 'true' || advancedSettings.useSdCard === true;
      }
      if (advancedSettings.recordToSdCard !== undefined && advancedSettings.recordToSdCard !== '') {
        sdObj.rsc = advancedSettings.recordToSdCard === 'true' || advancedSettings.recordToSdCard === true;
      }
      if (Object.keys(sdObj).length > 0) {
        jsonPayload.s = sdObj;
      }
      
      // Timezone settings
      if (advancedSettings.timezoneOffset !== undefined && advancedSettings.timezoneOffset !== '') {
        jsonPayload.t = { oh: parseInt(advancedSettings.timezoneOffset, 10) };
      }
      
      // RTC settings
      if (advancedSettings.rtcEnabled !== undefined && advancedSettings.rtcEnabled !== '') {
        jsonPayload.r = { en: advancedSettings.rtcEnabled === 'true' || advancedSettings.rtcEnabled === true };
      }

      // Validate that we have at least one setting to save
      if (Object.keys(jsonPayload).length === 0) {
        setError('No settings to save');
        setSaving(false);
        return;
      }

      // Send import command
      const importCommand = `import ${JSON.stringify(jsonPayload)}`;
      lastCommandRef.current = importCommand;
      await api.post(`/recorders/monitor/send`, {
        command: importCommand,
        ports: [devicePort]
      });

      setSuccess('Advanced settings updated');
      setTimeout(() => {
        setSuccess(null);
        setSaving(false);
        lastCommandRef.current = null;
      }, 2000);
    } catch (err) {
      setError('Failed to save advanced settings');
      setSaving(false);
      lastCommandRef.current = null;
    }
  };

  if (!isOpen) return null;

  const modalClasses = isDarkMode 
    ? 'bg-gray-900 border-gray-700 text-gray-100'
    : 'bg-white border-gray-200 text-gray-900';

  const inputClasses = isDarkMode
    ? 'bg-gray-800 border-gray-700 text-gray-100 focus:border-blue-500 focus:ring-blue-500'
    : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500';

  const buttonClasses = isDarkMode
    ? 'bg-blue-600 hover:bg-blue-700 text-white'
    : 'bg-blue-500 hover:bg-blue-600 text-white';

  const tabButtonClasses = (isActive) => isDarkMode
    ? isActive 
      ? 'bg-blue-600 text-white border-blue-500'
      : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
    : isActive
      ? 'bg-blue-500 text-white border-blue-400'
      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className={`w-full max-w-4xl max-h-[90vh] rounded-xl border shadow-2xl ${modalClasses} flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Settings2 className="w-6 h-6 text-blue-500" />
            <div>
              <h2 className="text-2xl font-bold">Device Settings</h2>
              <p className="text-sm text-gray-400">{devicePort}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchCurrentSettings}
              disabled={loading}
              className={`p-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2 ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Refresh Settings"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg hover:bg-gray-700 transition-colors ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 overflow-x-auto">
          <button
            onClick={() => setActiveTab('recorder')}
            className={`px-6 py-3 border-b-2 transition-colors flex items-center gap-2 ${tabButtonClasses(activeTab === 'recorder')}`}
          >
            <Mic className="w-4 h-4" />
            Recorder
          </button>
          <button
            onClick={() => setActiveTab('network')}
            className={`px-6 py-3 border-b-2 transition-colors flex items-center gap-2 ${tabButtonClasses(activeTab === 'network')}`}
          >
            <Wifi className="w-4 h-4" />
            Network
          </button>
          <button
            onClick={() => setActiveTab('logging')}
            className={`px-6 py-3 border-b-2 transition-colors flex items-center gap-2 ${tabButtonClasses(activeTab === 'logging')}`}
          >
            <FileText className="w-4 h-4" />
            Logging
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={`px-6 py-3 border-b-2 transition-colors flex items-center gap-2 ${tabButtonClasses(activeTab === 'advanced')}`}
          >
            <Sliders className="w-4 h-4" />
            Advanced
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex justify-center items-center py-8">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-700 text-red-400 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 rounded-lg bg-green-900/20 border border-green-700 text-green-400 text-sm">
              {success}
            </div>
          )}

          {/* Recorder Settings Tab */}
          {activeTab === 'recorder' && !loading && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium">Audio Threshold</label>
                    <span className="text-sm font-semibold">{recorderSettings.audioThreshold?.toFixed(1) || '50.0'}</span>
                  </div>
                  
                  {/* Visual slider matching audio level bar */}
                  <div className="mb-2">
                    <div className={`relative h-6 rounded-full overflow-hidden mb-2 ${
                      isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                    }`}>
                      {/* Background gradient showing dB range */}
                      <div className="absolute inset-0 flex">
                        <div className="flex-1 bg-gray-500"></div>
                        <div className="flex-1 bg-blue-500"></div>
                        <div className="flex-1 bg-orange-500"></div>
                        <div className="flex-1 bg-red-500"></div>
                      </div>
                      {/* Threshold threshold marker */}
                      {(() => {
                        const threshold = recorderSettings.audioThreshold || 50.0;
                        // const audioRange = 70; // -80 to -10 dB range
                        // const thresholdPercent = Math.max(0, Math.min(100, ((threshold + 80) / audioRange) * 100));
                        const thresholdPercent = Math.max(0, Math.min(100, threshold * 100));
                        return (
                          <div
                            className={`absolute top-0 h-full w-1 ${
                              isDarkMode ? 'bg-yellow-400' : 'bg-yellow-600'
                            } z-10 shadow-lg`}
                            style={{ left: `${thresholdPercent}%` }}
                          />
                        );
                      })()}
                    </div>
                    
                    {/* Slider input */}
                    <input
                      type="range"
                      min="-80"
                      max="-10"
                      step="0.5"
                      value={recorderSettings.audioThreshold || -45.0}
                      onChange={(e) => handleRecorderSettingChange('audioThreshold', parseFloat(e.target.value))}
                      className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
                        isDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                      } accent-blue-500`}
                      style={{
                        background: `linear-gradient(to right, 
                          ${isDarkMode ? '#374151' : '#d1d5db'} 0%, 
                          ${isDarkMode ? '#374151' : '#d1d5db'} 20%,
                          #3b82f6 20%,
                          #3b82f6 50%,
                          #f97316 50%,
                          #f97316 80%,
                          #ef4444 80%,
                          #ef4444 100%)`
                      }}
                    />
                  </div>
                  
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>-80 dB</span>
                    <span>-45 dB</span>
                    <span>-10 dB</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Lower values = more sensitive (triggers on quieter sounds)
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium">Min Recording (ms)</label>
                    <span className="text-sm font-semibold">{recorderSettings.minRecording || 1000}</span>
                  </div>
                  <input
                    type="range"
                    min="1000"
                    max="10000"
                    step="100"
                    value={recorderSettings.minRecording || 1000}
                    onChange={(e) => handleRecorderSettingChange('minRecording', parseInt(e.target.value, 10))}
                    className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'} accent-blue-500`}
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>1000</span>
                    <span>5500</span>
                    <span>10000</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium">Max Recording (ms)</label>
                    <span className="text-sm font-semibold">{recorderSettings.maxRecording || 30000}</span>
                  </div>
                  <input
                    type="range"
                    min="5000"
                    max="60000"
                    step="1000"
                    value={recorderSettings.maxRecording || 30000}
                    onChange={(e) => handleRecorderSettingChange('maxRecording', parseInt(e.target.value, 10))}
                    className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'} accent-blue-500`}
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>5000</span>
                    <span>32500</span>
                    <span>60000</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium">Silence Threshold (ms)</label>
                    <span className="text-sm font-semibold">{recorderSettings.silenceThreshold || 1000}</span>
                  </div>
                  <input
                    type="range"
                    min="1000"
                    max="5000"
                    step="100"
                    value={recorderSettings.silenceThreshold || 1000}
                    onChange={(e) => handleRecorderSettingChange('silenceThreshold', parseInt(e.target.value, 10))}
                    className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'} accent-blue-500`}
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>1000</span>
                    <span>3000</span>
                    <span>5000</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium">Pre-Record (ms)</label>
                    <span className="text-sm font-semibold">{recorderSettings.preRecord || 200}</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="500"
                    step="10"
                    value={recorderSettings.preRecord || 200}
                    onChange={(e) => handleRecorderSettingChange('preRecord', parseInt(e.target.value, 10))}
                    className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'} accent-blue-500`}
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>100</span>
                    <span>300</span>
                    <span>500</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Gain (dB)</label>
                  <select
                    value={recorderSettings.gain !== undefined ? recorderSettings.gain : 3}
                    onChange={(e) => handleRecorderSettingChange('gain', parseInt(e.target.value, 10))}
                    className={`w-full px-3 py-2 rounded-lg border ${inputClasses}`}
                  >
                    <option value="-3">-3 dB</option>
                    <option value="0">0 dB</option>
                    <option value="3">+3 dB</option>
                    <option value="6">+6 dB</option>
                    <option value="9">+9 dB</option>
                    <option value="12">+12 dB</option>
                    <option value="15">+15 dB</option>
                    <option value="18">+18 dB</option>
                    <option value="19">+19 dB</option>
                    <option value="21">+21 dB</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-between items-center mt-6">
                <button
                  onClick={handleSetRecorderDefaults}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    isDarkMode
                      ? 'bg-amber-700 hover:bg-amber-600 text-white'
                      : 'bg-amber-500 hover:bg-amber-600 text-white'
                  }`}
                >
                  Set Defaults
                </button>
                <button
                  onClick={handleSaveRecorderSettings}
                  disabled={saving}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${buttonClasses} ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          )}

          {/* Network Settings Tab */}
          {activeTab === 'network' && !loading && (
            <div className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-3">WiFi Network 1</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">SSID</label>
                      <input
                        type="text"
                        value={networkSettings.ssid0}
                        onChange={(e) => handleNetworkSettingChange('ssid0', e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border ${inputClasses}`}
                        placeholder="Network Name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Password</label>
                      <input
                        type="password"
                        value={networkSettings.pass0}
                        onChange={(e) => handleNetworkSettingChange('pass0', e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border ${inputClasses}`}
                        placeholder="Password"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Static IP Configuration</h3>
                  <div className="mb-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={networkSettings.staticIpEnabled}
                        onChange={(e) => handleNetworkSettingChange('staticIpEnabled', e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">Enable Static IP</span>
                    </label>
                  </div>
                  {networkSettings.staticIpEnabled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">IP Address</label>
                        <input
                          type="text"
                          value={networkSettings.staticIp}
                          onChange={(e) => handleNetworkSettingChange('staticIp', e.target.value)}
                          className={`w-full px-3 py-2 rounded-lg border ${inputClasses}`}
                          placeholder="192.168.1.100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Subnet Mask</label>
                        <input
                          type="text"
                          value={networkSettings.staticSubnet}
                          onChange={(e) => handleNetworkSettingChange('staticSubnet', e.target.value)}
                          className={`w-full px-3 py-2 rounded-lg border ${inputClasses}`}
                          placeholder="255.255.255.0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Gateway</label>
                        <input
                          type="text"
                          value={networkSettings.staticGateway}
                          onChange={(e) => handleNetworkSettingChange('staticGateway', e.target.value)}
                          className={`w-full px-3 py-2 rounded-lg border ${inputClasses}`}
                          placeholder="192.168.1.1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">DNS 1</label>
                        <input
                          type="text"
                          value={networkSettings.staticDns1}
                          onChange={(e) => handleNetworkSettingChange('staticDns1', e.target.value)}
                          className={`w-full px-3 py-2 rounded-lg border ${inputClasses}`}
                          placeholder="8.8.8.8"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">DNS 2</label>
                        <input
                          type="text"
                          value={networkSettings.staticDns2}
                          onChange={(e) => handleNetworkSettingChange('staticDns2', e.target.value)}
                          className={`w-full px-3 py-2 rounded-lg border ${inputClasses}`}
                          placeholder="8.8.4.4"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium">WiFi TX Power</label>
                    <span className="text-sm font-semibold">{networkSettings.wifiTxPower || 8}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={networkSettings.wifiTxPower || 8}
                    onChange={(e) => handleNetworkSettingChange('wifiTxPower', parseInt(e.target.value, 10))}
                    className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'} accent-blue-500`}
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>1</span>
                    <span>5.5</span>
                    <span>10</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">API Hosts</h3>
                  <div className="space-y-4">
                    {/* API Host 0 */}
                    <div className={`p-4 rounded-lg border ${isDarkMode ? 'border-gray-700 bg-gray-800/30' : 'border-gray-300 bg-gray-50'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold">API Host 1</h4>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={networkSettings.apiEnabled0 || false}
                            onChange={(e) => handleNetworkSettingChange('apiEnabled0', e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span className="text-xs font-medium">Enabled</span>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">Host</label>
                          <input
                            type="text"
                            value={networkSettings.apiHost0 || ''}
                            onChange={(e) => handleNetworkSettingChange('apiHost0', e.target.value)}
                            className={`w-full px-2 py-1.5 text-sm rounded border ${inputClasses}`}
                            placeholder="api.example.com"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Port</label>
                          <input
                            type="number"
                            value={networkSettings.apiPort0 || ''}
                            onChange={(e) => handleNetworkSettingChange('apiPort0', e.target.value)}
                            className={`w-full px-2 py-1.5 text-sm rounded border ${inputClasses}`}
                            placeholder="7001"
                          />
                        </div>
                      </div>
                    </div>

                    {/* API Host 1 */}
                    <div className={`p-4 rounded-lg border ${isDarkMode ? 'border-gray-700 bg-gray-800/30' : 'border-gray-300 bg-gray-50'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold">API Host 2</h4>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={networkSettings.apiEnabled1 || false}
                            onChange={(e) => handleNetworkSettingChange('apiEnabled1', e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span className="text-xs font-medium">Enabled</span>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">Host</label>
                          <input
                            type="text"
                            value={networkSettings.apiHost1 || ''}
                            onChange={(e) => handleNetworkSettingChange('apiHost1', e.target.value)}
                            className={`w-full px-2 py-1.5 text-sm rounded border ${inputClasses}`}
                            placeholder="api.example.com"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Port</label>
                          <input
                            type="number"
                            value={networkSettings.apiPort1 || ''}
                            onChange={(e) => handleNetworkSettingChange('apiPort1', e.target.value)}
                            className={`w-full px-2 py-1.5 text-sm rounded border ${inputClasses}`}
                            placeholder="7001"
                          />
                        </div>
                      </div>
                    </div>

                    {/* API Host 2 */}
                    <div className={`p-4 rounded-lg border ${isDarkMode ? 'border-gray-700 bg-gray-800/30' : 'border-gray-300 bg-gray-50'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold">API Host 3</h4>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={networkSettings.apiEnabled2 || false}
                            onChange={(e) => handleNetworkSettingChange('apiEnabled2', e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span className="text-xs font-medium">Enabled</span>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">Host</label>
                          <input
                            type="text"
                            value={networkSettings.apiHost2 || ''}
                            onChange={(e) => handleNetworkSettingChange('apiHost2', e.target.value)}
                            className={`w-full px-2 py-1.5 text-sm rounded border ${inputClasses}`}
                            placeholder="api.example.com"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Port</label>
                          <input
                            type="number"
                            value={networkSettings.apiPort2 || ''}
                            onChange={(e) => handleNetworkSettingChange('apiPort2', e.target.value)}
                            className={`w-full px-2 py-1.5 text-sm rounded border ${inputClasses}`}
                            placeholder="7001"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={handleSaveNetworkSettings}
                  disabled={saving}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${buttonClasses} ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          )}

          {/* Logging Settings Tab */}
          {activeTab === 'logging' && !loading && (
            <div className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-700 hover:bg-gray-800/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={loggingSettings.debug || false}
                    onChange={(e) => handleLoggingSettingChange('debug', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Debug</span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-700 hover:bg-gray-800/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={loggingSettings.info || false}
                    onChange={(e) => handleLoggingSettingChange('info', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Info</span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-700 hover:bg-gray-800/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={loggingSettings.warn || false}
                    onChange={(e) => handleLoggingSettingChange('warn', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Warning</span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-700 hover:bg-gray-800/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={loggingSettings.error || false}
                    onChange={(e) => handleLoggingSettingChange('error', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Error</span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-700 hover:bg-gray-800/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={loggingSettings.fatal || false}
                    onChange={(e) => handleLoggingSettingChange('fatal', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Fatal</span>
                </label>
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={handleSaveLoggingSettings}
                  disabled={saving}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${buttonClasses} ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          )}

          {/* Advanced Settings Tab */}
          {activeTab === 'advanced' && !loading && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Use SD Card</label>
                  <select
                    value={advancedSettings.useSdCard}
                    onChange={(e) => handleAdvancedSettingChange('useSdCard', e.target.value === 'true')}
                    className={`w-full px-3 py-2 rounded-lg border ${inputClasses}`}
                  >
                    <option value="">-- Select --</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Record to SD Card</label>
                  <select
                    value={advancedSettings.recordToSdCard}
                    onChange={(e) => handleAdvancedSettingChange('recordToSdCard', e.target.value === 'true')}
                    className={`w-full px-3 py-2 rounded-lg border ${inputClasses}`}
                  >
                    <option value="">-- Select --</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Timezone Offset (hours)</label>
                  <input
                    type="number"
                    min="-12"
                    max="14"
                    value={advancedSettings.timezoneOffset}
                    onChange={(e) => handleAdvancedSettingChange('timezoneOffset', e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border ${inputClasses}`}
                    placeholder="-5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">RTC Enabled</label>
                  <select
                    value={advancedSettings.rtcEnabled}
                    onChange={(e) => handleAdvancedSettingChange('rtcEnabled', e.target.value === 'true')}
                    className={`w-full px-3 py-2 rounded-lg border ${inputClasses}`}
                  >
                    <option value="">-- Select --</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={handleSaveAdvancedSettings}
                  disabled={saving}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${buttonClasses} ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeviceSettingsModal;

