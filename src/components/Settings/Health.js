import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../utils/apiClient';
import { Activity, Calendar, Cpu, HardDrive, MemoryStick, RefreshCw } from 'lucide-react';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import tableStyles from '../ui/Table.module.css';

const normalizeMac = (value) => String(value || '').toUpperCase().replace(/[:-]/g, '');
const formatBytes = (bytes) => {
  const value = Number(bytes) || 0;
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${Math.round((value / (1024 ** index)) * 100) / 100} ${units[index]}`;
};

const Health = () => {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [devices, setDevices] = useState([]);
  const [system, setSystem] = useState(null);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const channelByMac = useMemo(() => Object.fromEntries(channels.filter((channel) => channel.mac).map((channel) => [normalizeMac(channel.mac), channel.name || `Channel ${channel.id}`])), [channels]);

  const load = useCallback(async (purge = false) => {
    if (purge) setRefreshing(true); else setLoading(true);
    try {
      if (purge) await api.post('/health/purge');
      const [deviceResponse, systemResponse, channelResponse] = await Promise.all([
        api.get('/health/devices', { params: { date: selectedDate, current: true } }),
        api.get('/health/system', { params: { date: selectedDate, current: true } }),
        api.get('/channels'),
      ]);
      setDevices(Array.isArray(deviceResponse.data?.stats) ? deviceResponse.data.stats : []);
      setChannels(Array.isArray(channelResponse.data) ? channelResponse.data : []);

      const stats = systemResponse.data?.stats;
      if (stats?.current) {
        const current = stats.current;
        const peaks = stats.peaks || {};
        const averages = stats.averages || {};
        setSystem({
          cpu: { percent: current.cpu_percent || 0, count: current.cpu_count || 0, peak_percent: peaks.cpu_percent || 0, avg_percent: averages.cpu_percent || 0 },
          memory: { total_bytes: current.memory_total_bytes || 0, available_bytes: current.memory_available_bytes || 0, used_bytes: current.memory_used_bytes || 0, percent: current.memory_percent || 0, peak_percent: peaks.memory_percent || 0, avg_percent: averages.memory_percent || 0 },
          disk: { total_bytes: current.disk_total_bytes || 0, used_bytes: current.disk_used_bytes || 0, free_bytes: current.disk_free_bytes || 0, percent: current.disk_percent || 0, peak_percent: peaks.disk_percent || 0, avg_percent: averages.disk_percent || 0 },
        });
      } else {
        setSystem(stats?.cpu || stats?.memory || stats?.disk ? stats : null);
      }
    } catch (error) {
      console.error('Failed to load health data:', error);
      setDevices([]);
      setSystem(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => { load(false); }, [load]);

  if (loading) return <div className="centeredContent"><span className="spinner spinnerLarge" /></div>;

  return (
    <div className="stack stackLarge">
      <div className={`${cardStyles.card} ${cardStyles.compact} stack`}>
        <div className="rowBetween"><div className="row"><Activity /><div><h3 className={cardStyles.title}>Recorder health</h3><p className={cardStyles.description}>Device activity and connection health.</p></div></div><div className="row"><label className={formStyles.field}><span className={formStyles.srOnly}>Date</span><input type="date" className={formStyles.input} value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label><Button onClick={() => load(true)} disabled={refreshing}>{refreshing ? <RefreshCw className="spin" /> : <RefreshCw />}Refresh</Button></div></div>
        {devices.length ? <div className={tableStyles.scroll}><table className={tableStyles.table}><thead><tr><th className={tableStyles.header}>Device</th><th className={tableStyles.header}>Events</th><th className={tableStyles.header}>Uploads</th><th className={tableStyles.header}>Errors</th><th className={tableStyles.header}>Connection loss</th><th className={tableStyles.header}>Uptime</th><th className={tableStyles.header}>Last activity</th></tr></thead><tbody>{devices.map((device, index) => <tr key={device.mac_address || index} className={tableStyles.row}><td className={tableStyles.cell}><strong>{channelByMac[normalizeMac(device.mac_address)] || `Device ${device.mac_address}`}</strong><div className="tinyText mutedText">{device.mac_address}</div></td><td className={tableStyles.cell}>{device.event_count || 0}</td><td className={tableStyles.cell}>{device.file_upload_count || 0}</td><td className={tableStyles.cell}>{device.error_count || 0}</td><td className={tableStyles.cell}>{device.connection_loss_count || 0}</td><td className={tableStyles.cell}>{device.uptime_formatted || '00:00:00'}</td><td className={tableStyles.cell}>{device.last_activity ? new Date(device.last_activity).toLocaleString() : '—'}</td></tr>)}</tbody></table></div> : <p className="mutedText">No health data available.</p>}
      </div>

      <div className={`${cardStyles.card} stack`}>
        <div className="row"><Cpu /><div><h3 className={cardStyles.title}>System health</h3><p className={cardStyles.description}>CPU, memory, and disk usage.</p></div></div>
        {!system ? <p className="mutedText">No system health data available.</p> : <div className="gridThree">
          <div className={`${cardStyles.card} ${cardStyles.compact}`}><div className="row"><Cpu /><strong>CPU</strong></div><p>{Number(system.cpu?.percent || 0).toFixed(1)}%</p><p className="tinyText mutedText">Peak {Number(system.cpu?.peak_percent || 0).toFixed(1)}% · Avg {Number(system.cpu?.avg_percent || 0).toFixed(1)}% · {system.cpu?.count || 0} cores</p></div>
          <div className={`${cardStyles.card} ${cardStyles.compact}`}><div className="row"><MemoryStick /><strong>Memory</strong></div><p>{Number(system.memory?.percent || 0).toFixed(1)}%</p><p className="tinyText mutedText">{formatBytes(system.memory?.used_bytes)} / {formatBytes(system.memory?.total_bytes)}</p></div>
          <div className={`${cardStyles.card} ${cardStyles.compact}`}><div className="row"><HardDrive /><strong>Disk</strong></div><p>{Number(system.disk?.percent || 0).toFixed(1)}%</p><p className="tinyText mutedText">{formatBytes(system.disk?.used_bytes)} / {formatBytes(system.disk?.total_bytes)}</p></div>
        </div>}
      </div>
    </div>
  );
};

export default Health;
