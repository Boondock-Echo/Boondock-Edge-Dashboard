import React, { useEffect, useState, useCallback } from 'react';
import api from '../../utils/apiClient';
import {
  Usb,
  RefreshCw,
  AlertCircle,
  PlayCircle,
  PauseCircle,
  Trash2,
  Volume2,
} from 'lucide-react';

const USBRecorders = ({ isDarkMode, globalSettings }) => {
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState([]);
  const [recorders, setRecorders] = useState([]);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sounddeviceAvailable, setSounddeviceAvailable] = useState(true);
  const [busyDeviceId, setBusyDeviceId] = useState(null);


  const fetchUsbState = useCallback(async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
      setError(null);
    }

    try {
      // Fetch available USB audio devices
      const devicesRes = await api.get(`/usb-recorders/devices`);
      const devData = devicesRes.data || {};
      setDevices(Array.isArray(devData.devices) ? devData.devices : []);
      setSounddeviceAvailable(
        typeof devData.sounddevice_available === 'boolean'
          ? devData.sounddevice_available
          : true
      );

      // Fetch existing recorder configurations
      const recordersRes = await api.get(`/usb-recorders`);
      const recData = recordersRes.data || {};
      setRecorders(Array.isArray(recData.recorders) ? recData.recorders : []);
      setError(null);
    } catch (err) {
      console.error('Failed to load USB recorders:', err);
      setError(
        err.response?.data?.error ||
          'Unable to load USB audio devices. Please check the server logs.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsbState(true);
  }, [fetchUsbState]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUsbState(false);
  };

  const handleCreateRecorder = async (deviceId) => {
    try {
      setBusyDeviceId(deviceId);
      await api.post(`/usb-recorders`, {
        device_id: deviceId,
      });
      await fetchUsbState(false);
    } catch (err) {
      console.error('Failed to create USB recorder:', err);
      alert(
        err.response?.data?.error ||
          'Failed to create USB recorder configuration.'
      );
    } finally {
      setBusyDeviceId(null);
    }
  };

  const handleStart = async (deviceId) => {
    try {
      setBusyDeviceId(deviceId);
      await api.post(`/usb-recorders/${deviceId}/start`);
      await fetchUsbState(false);
    } catch (err) {
      console.error('Failed to start USB recorder:', err);
      alert(
        err.response?.data?.error ||
          'Failed to start USB recorder. Check server logs for details.'
      );
    } finally {
      setBusyDeviceId(null);
    }
  };

  const handleStop = async (deviceId) => {
    try {
      setBusyDeviceId(deviceId);
      await api.post(`/usb-recorders/${deviceId}/stop`);
      await fetchUsbState(false);
    } catch (err) {
      console.error('Failed to stop USB recorder:', err);
      alert(
        err.response?.data?.error ||
          'Failed to stop USB recorder. Check server logs for details.'
      );
    } finally {
      setBusyDeviceId(null);
    }
  };

  const handleDelete = async (deviceId) => {
    if (
      !window.confirm(
        'Are you sure you want to delete this USB recorder configuration?'
      )
    ) {
      return;
    }

    try {
      setBusyDeviceId(deviceId);
      await api.delete(`/usb-recorders/${deviceId}`);
      await fetchUsbState(false);
    } catch (err) {
      console.error('Failed to delete USB recorder:', err);
      alert(
        err.response?.data?.error ||
          'Failed to delete USB recorder configuration.'
      );
    } finally {
      setBusyDeviceId(null);
    }
  };

  const recorderByDeviceId = recorders.reduce((acc, rec) => {
    if (rec && typeof rec.device_id === 'number') {
      acc[rec.device_id] = rec;
    }
    return acc;
  }, {});

  const containerClasses = isDarkMode
    ? 'bg-gray-900/60 border-gray-800'
    : 'bg-white border-gray-200';

  if (loading) {
    return (
      <div
        className={`rounded-2xl shadow-lg p-6 border ${containerClasses} flex items-center justify-center min-h-[200px]`}
      >
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
          <span className="text-sm">
            Loading USB audio devices and recorders...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl shadow-lg p-4 md:p-6 border ${containerClasses}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-3 rounded-2xl shadow-md ${
              isDarkMode ? 'bg-blue-600' : 'bg-blue-500'
            }`}
          >
            <Usb className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">USB Audio Recorders</h3>
            <p
              className={`text-xs md:text-sm ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Configure and monitor USB audio input devices (microphones,
              interfaces, and other USB audio sources).
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium border ${
            isDarkMode
              ? 'border-gray-700 text-gray-200 hover:bg-gray-800'
              : 'border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <RefreshCw
            className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      </div>

      {/* Warnings */}
      {!sounddeviceAvailable && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs md:text-sm ${
            isDarkMode
              ? 'border-yellow-600 bg-yellow-900/30 text-yellow-200'
              : 'border-yellow-300 bg-yellow-50 text-yellow-800'
          }`}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">USB audio library not available</p>
            <p>
              The `sounddevice` library is not available on the server. USB
              audio devices cannot be enumerated or recorded until it is
              installed.
            </p>
          </div>
        </div>
      )}

      {globalSettings?.global_enable_usb_audio_devices && (
          <div
            className={`mb-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs md:text-sm ${
              isDarkMode
                ? 'border-blue-700 bg-blue-900/30 text-blue-200'
                : 'border-blue-200 bg-blue-50 text-blue-800'
            }`}
          >
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">USB audio devices are disabled</p>
              <p>
                Enable &ldquo;USB Audio Device Auto-Detection&rdquo; in the
                System settings to start using USB audio
                recorders.
              </p>
            </div>
          </div>
        )}

      {error && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs md:text-sm ${
            isDarkMode
              ? 'border-red-700 bg-red-900/30 text-red-200'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Error loading USB recorders</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Devices and recorders */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Available devices */}
        <div
          className={`rounded-xl border p-3 md:p-4 ${
            isDarkMode ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Available USB audio devices
            </h4>
            <span
              className={`text-xs ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              {devices.length} found
            </span>
          </div>

          {devices.length === 0 ? (
            <p
              className={`text-xs md:text-sm ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              No USB audio input devices were detected. Connect a USB microphone
              or audio interface and click Refresh.
            </p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {devices.map((device) => {
                const rec = recorderByDeviceId[device.device_id];
                const isBusy = busyDeviceId === device.device_id;
                return (
                  <li
                    key={device.device_id}
                    className={`rounded-lg border px-3 py-2 text-xs md:text-sm flex flex-col gap-1 ${
                      isDarkMode
                        ? 'border-gray-800 bg-gray-900'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">{device.name}</div>
                        <div
                          className={`text-[11px] ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}
                        >
                          ID {device.device_id} &middot; Host API:{' '}
                          {device.hostapi || 'Unknown'} &middot; Channels:{' '}
                          {device.max_input_channels ?? 'N/A'}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {rec ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] ${
                              rec.monitoring
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {rec.monitoring ? 'Monitoring' : 'Configured'}
                          </span>
                        ) : (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] ${
                              isDarkMode
                                ? 'bg-blue-900/50 text-blue-200'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            Not configured
                          </span>
                        )}

                        {!rec && (
                          <button
                            onClick={() => handleCreateRecorder(device.device_id)}
                            disabled={isBusy}
                            className={`mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${
                              isDarkMode
                                ? 'bg-blue-600 text-white hover:bg-blue-500'
                                : 'bg-blue-600 text-white hover:bg-blue-500'
                            } ${isBusy ? 'opacity-70 cursor-not-allowed' : ''}`}
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            {isBusy ? 'Creating…' : 'Enable recording'}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Configured USB recorders */}
        <div
          className={`rounded-xl border p-3 md:p-4 ${
            isDarkMode ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Usb className="w-4 h-4" />
              Configured USB recorders
            </h4>
            <span
              className={`text-xs ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              {recorders.length} configured
            </span>
          </div>

          {recorders.length === 0 ? (
            <p
              className={`text-xs md:text-sm ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              No USB recorder configurations found. Select a device on the left
              and click &ldquo;Enable recording&rdquo; to create one.
            </p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {recorders.map((rec) => {
                const isBusy = busyDeviceId === rec.device_id;
                return (
                  <li
                    key={rec.device_id}
                    className={`rounded-lg border px-3 py-2 text-xs md:text-sm flex flex-col gap-2 ${
                      isDarkMode
                        ? 'border-gray-800 bg-gray-900'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">
                          {rec.name || `Device ${rec.device_id}`}
                        </div>
                        <div
                          className={`text-[11px] ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}
                        >
                          Channel ID: {rec.config?.channel_id ?? 'auto'} &middot; Host
                          API: {rec.hostapi || 'Unknown'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            rec.monitoring
                              ? handleStop(rec.device_id)
                              : handleStart(rec.device_id)
                          }
                          disabled={isBusy}
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${
                            rec.monitoring
                              ? 'bg-red-600 text-white hover:bg-red-500'
                              : 'bg-green-600 text-white hover:bg-green-500'
                          } ${isBusy ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                          {rec.monitoring ? (
                            <PauseCircle className="w-3.5 h-3.5" />
                          ) : (
                            <PlayCircle className="w-3.5 h-3.5" />
                          )}
                          {rec.monitoring ? 'Stop' : 'Start'}
                        </button>
                        <button
                          onClick={() => handleDelete(rec.device_id)}
                          disabled={isBusy}
                          className={`inline-flex items-center justify-center rounded-md p-1.5 text-[11px] ${
                            isDarkMode
                              ? 'text-gray-400 hover:text-red-400 hover:bg-gray-800'
                              : 'text-gray-500 hover:text-red-600 hover:bg-gray-100'
                          } ${isBusy ? 'opacity-70 cursor-not-allowed' : ''}`}
                          title="Delete configuration"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div
                      className={`grid grid-cols-2 gap-1 text-[11px] ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}
                    >
                      <div>
                        <span className="font-medium">Threshold:</span>{' '}
                        {rec.config?.audio_threshold ?? 50}
                      </div>
                      <div>
                        <span className="font-medium">Gain:</span>{' '}
                        {rec.config?.audio_gain ?? 3} dB
                      </div>
                      <div>
                        <span className="font-medium">Min Rec:</span>{' '}
                        {rec.config?.min_recording ?? 1000} ms
                      </div>
                      <div>
                        <span className="font-medium">Max Rec:</span>{' '}
                        {rec.config?.max_recording ?? 30000} ms
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default USBRecorders;
