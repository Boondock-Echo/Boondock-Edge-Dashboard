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
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import listStyles from '../ui/List.module.css';
import noticeStyles from '../ui/Notice.module.css';

const USBRecorders = ({ globalSettings }) => {
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

  if (loading) {
    return (
      <div className={`${cardStyles.card} centeredContent`}>
        <div className="row">
          <RefreshCw className="spin iconMedium" />
          <span className="smallText">Loading USB audio devices and recorders...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${cardStyles.card} stack`}>
      {/* Header */}
      <div className="rowBetweenStart">
        <div className="row grow">
          <div className="iconTile iconTileAccent"><Usb /></div>
          <div className="grow">
            <h3 className={cardStyles.title}>USB Audio Recorders</h3>
            <p className={cardStyles.description}>
              Configure and monitor USB audio input devices (microphones,
              interfaces, and other USB audio sources).
            </p>
          </div>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} size="small">
          <RefreshCw className={refreshing ? 'spin' : ''} />
          Refresh
        </Button>
      </div>

      {/* Warnings */}
      {!sounddeviceAvailable && (
        <div className={`${noticeStyles.notice} ${noticeStyles.warning}`}>
          <AlertCircle className={noticeStyles.icon} />
          <div className={noticeStyles.body}>
            <p><strong>USB audio library not available</strong></p>
            <p>
              The `sounddevice` library is not available on the server. USB
              audio devices cannot be enumerated or recorded until it is
              installed.
            </p>
          </div>
        </div>
      )}

      {globalSettings?.global_enable_usb_audio_devices && (
        <div className={`${noticeStyles.notice} ${noticeStyles.info}`}>
          <AlertCircle className={noticeStyles.icon} />
          <div className={noticeStyles.body}>
            <p><strong>USB audio devices are disabled</strong></p>
            <p>
              Enable &ldquo;USB Audio Device Auto-Detection&rdquo; in the
              System settings to start using USB audio
              recorders.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className={`${noticeStyles.notice} ${noticeStyles.error}`}>
          <AlertCircle className={noticeStyles.icon} />
          <div className={noticeStyles.body}>
            <p><strong>Error loading USB recorders</strong></p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Devices and recorders */}
      <div className="gridTwo">
        {/* Available devices */}
        <section className={`${cardStyles.card} ${cardStyles.compact}`}>
          <div className={cardStyles.header}>
            <h4 className={cardStyles.title}><Volume2 className="iconSmall" />Available USB audio devices</h4>
            <span className="pill">{devices.length} found</span>
          </div>

          {devices.length === 0 ? (
            <p className={cardStyles.description}>
              No USB audio input devices were detected. Connect a USB microphone
              or audio interface and click Refresh.
            </p>
          ) : (
            <ul className={`${listStyles.list} scrollPanel`}>
              {devices.map((device) => {
                const rec = recorderByDeviceId[device.device_id];
                const isBusy = busyDeviceId === device.device_id;
                return (
                  <li key={device.device_id} className={listStyles.item}>
                    <div className={`${listStyles.content} grow`}>
                      <p className={listStyles.title}>{device.name}</p>
                      <p className={`${listStyles.meta} ${listStyles.metaSmall}`}>
                        ID {device.device_id} &middot; Host API:{' '}
                        {device.hostapi || 'Unknown'} &middot; Channels:{' '}
                        {device.max_input_channels ?? 'N/A'}
                      </p>
                    </div>
                    <div className="stackCompact noShrink">
                      <span className={`pill ${rec?.monitoring ? 'pillSuccess' : rec ? '' : 'pillAccent'}`}>
                        {rec ? (rec.monitoring ? 'Monitoring' : 'Configured') : 'Not configured'}
                      </span>
                      {!rec && (
                        <Button onClick={() => handleCreateRecorder(device.device_id)} disabled={isBusy} size="small" variant="primary">
                          <PlayCircle />
                          {isBusy ? 'Creating…' : 'Enable recording'}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Configured USB recorders */}
        <section className={`${cardStyles.card} ${cardStyles.compact}`}>
          <div className={cardStyles.header}>
            <h4 className={cardStyles.title}><Usb className="iconSmall" />Configured USB recorders</h4>
            <span className="pill">{recorders.length} configured</span>
          </div>

          {recorders.length === 0 ? (
            <p className={cardStyles.description}>
              No USB recorder configurations found. Select a device on the left
              and click &ldquo;Enable recording&rdquo; to create one.
            </p>
          ) : (
            <ul className={`${listStyles.list} scrollPanel`}>
              {recorders.map((rec) => {
                const isBusy = busyDeviceId === rec.device_id;
                return (
                  <li key={rec.device_id} className={listStyles.item}>
                    <div className={`${listStyles.content} grow`}>
                      <div className="rowBetweenStart">
                        <div className="grow">
                          <p className={listStyles.title}>{rec.name || `Device ${rec.device_id}`}</p>
                          <p className={`${listStyles.meta} ${listStyles.metaSmall}`}>
                            Channel ID: {rec.config?.channel_id ?? 'auto'} &middot; Host API: {rec.hostapi || 'Unknown'}
                          </p>
                        </div>
                        <div className="row noShrink">
                          <Button
                            onClick={() => rec.monitoring ? handleStop(rec.device_id) : handleStart(rec.device_id)}
                            disabled={isBusy}
                            size="small"
                            variant={rec.monitoring ? 'danger' : 'success'}
                          >
                            {rec.monitoring ? <PauseCircle /> : <PlayCircle />}
                            {rec.monitoring ? 'Stop' : 'Start'}
                          </Button>
                          <Button
                            onClick={() => handleDelete(rec.device_id)}
                            disabled={isBusy}
                            size="icon"
                            variant="ghost"
                            title="Delete configuration"
                            aria-label={`Delete ${rec.name || `Device ${rec.device_id}`}`}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>

                      <div className="gridTwo smallText mutedText">
                        <div><strong>Threshold:</strong> {rec.config?.audio_threshold ?? 50}</div>
                        <div><strong>Gain:</strong> {rec.config?.audio_gain ?? 3} dB</div>
                        <div><strong>Min Rec:</strong> {rec.config?.min_recording ?? 1000} ms</div>
                        <div><strong>Max Rec:</strong> {rec.config?.max_recording ?? 30000} ms</div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );

};

export default USBRecorders;
