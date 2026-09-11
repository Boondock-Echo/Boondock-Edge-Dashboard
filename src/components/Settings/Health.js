import React, { useState, useEffect } from 'react';
import api from '../../utils/apiClient';
import { Activity, Calendar, RefreshCw, AlertCircle, Cpu, HardDrive, MemoryStick } from 'lucide-react';

import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import buttonStyles from '../ui/Button.module.css';
import noticeStyles from '../ui/Notice.module.css';
import tableStyles from '../ui/Table.module.css';

const Health = () => {
  const [healthStats, setHealthStats] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [systemLoading, setSystemLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [refreshing, setRefreshing] = useState(false);
  const [channelMap, setChannelMap] = useState({}); // MAC address -> channel name mapping

  const forcePurge = async () => {
    try {
      await api.post(`/health/purge`);
    } catch (error) {
      console.error('Error forcing purge:', error);
    }
  };

  const fetchHealthStats = async (date, useCurrent = true, shouldPurge = false) => {
    try {
      setLoading(true);
      
      // Force purge if requested
      if (shouldPurge) {
        await forcePurge();
      }
      
      const response = await api.get(`/health/devices`, {
        params: {
          date: date,
          current: useCurrent // Get current in-memory stats first
        }
      });
      setHealthStats(response.data.stats || []);
    } catch (error) {
      console.error('Error fetching health stats:', error);
      setHealthStats([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchSystemHealth = async (date, useCurrent = true, shouldPurge = false) => {
    try {
      setSystemLoading(true);
      
      // Force purge if requested
      if (shouldPurge) {
        await forcePurge();
      }
      
      const response = await api.get(`/health/system`, {
        params: {
          date: date,
          current: useCurrent // Get current in-memory stats first
        }
      });
      // Handle both current (nested structure) and persisted (flat structure) formats
      const stats = response.data.stats;
      if (!stats) {
        // No data available
        setSystemHealth(null);
        return;
      }
      
      if (stats.current) {
        // Current format: { current: {...}, peaks: {...}, averages: {...} }
        // Convert to persisted format for display
        const current = stats.current || {};
        const peaks = stats.peaks || {};
        const averages = stats.averages || {};
        
        // Always set health data - zero values are valid (system might be idle)
        setSystemHealth({
          cpu: {
            percent: current.cpu_percent || 0,
            count: current.cpu_count || 0,
            peak_percent: peaks.cpu_percent || 0,
            avg_percent: averages.cpu_percent || 0
          },
          memory: {
            total_bytes: current.memory_total_bytes || 0,
            available_bytes: current.memory_available_bytes || 0,
            used_bytes: current.memory_used_bytes || 0,
            percent: current.memory_percent || 0,
            peak_percent: peaks.memory_percent || 0,
            peak_used_bytes: peaks.memory_used_bytes || 0,
            avg_percent: averages.memory_percent || 0,
            avg_used_bytes: averages.memory_used_bytes || 0
          },
          disk: {
            total_bytes: current.disk_total_bytes || 0,
            used_bytes: current.disk_used_bytes || 0,
            free_bytes: current.disk_free_bytes || 0,
            percent: current.disk_percent || 0,
            peak_percent: peaks.disk_percent || 0,
            peak_used_bytes: peaks.disk_used_bytes || 0,
            avg_percent: averages.disk_percent || 0,
            avg_used_bytes: averages.disk_used_bytes || 0
          }
        });
      } else if (stats.cpu || stats.memory || stats.disk) {
        // Persisted format (already in correct structure)
        setSystemHealth(stats);
      } else {
        // Invalid or empty stats
        setSystemHealth(null);
      }
    } catch (error) {
      console.error('Error fetching system health:', error);
      setSystemHealth(null);
    } finally {
      setSystemLoading(false);
    }
  };

  const fetchChannels = async () => {
    try {
      const response = await api.get(`/v1/channels`);
      const channels = response.data || [];
      // Create mapping: MAC address (uppercase, no colons) -> channel name
      const mapping = {};
      channels.forEach(channel => {
        if (channel.mac) {
          const mac = channel.mac.toUpperCase().replace(/[:-]/g, '');
          mapping[mac] = channel.name || `Device ${mac}`;
        }
      });
      setChannelMap(mapping);
    } catch (error) {
      console.error('Error fetching channels:', error);
      setChannelMap({});
    }
  };

  useEffect(() => {
    // On first load, purge and show current data
    fetchHealthStats(selectedDate, true, true);
    fetchSystemHealth(selectedDate, true, true);
    fetchChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const handleRefresh = () => {
    setRefreshing(true);
    // Force purge and show current data on refresh
    fetchHealthStats(selectedDate, true, true);
    fetchSystemHealth(selectedDate, true, true);
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return 'N/A';
    try {
      const date = new Date(isoString);
      return date.toLocaleString();
    } catch {
      return isoString;
    }
  };

  if (loading && healthStats.length === 0) {
    return (
      <div className={cardStyles.card}>
        <div className="row">
          <RefreshCw className="iconLarge spin" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Recorder Health Section */}
      <div className={`${cardStyles.card} ${cardStyles.compact}`}>
        {/* Header with date picker and refresh */}
      <div className="rowBetween">
        <div className="row">
          <div className={cardStyles.card}>
            <Activity className="iconMedium" />
          </div>
          <div>
            <h3 className={cardStyles.title}>Recorder Health</h3>
            <p className="mutedText smallText">Monitor recording device health and activity</p>
          </div>
        </div>
        <div className="row">
          <div className="row">
            <Calendar className="iconSmall" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={formStyles.input}
            />
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
          >
            <RefreshCw className={`iconSmall ${refreshing ? 'spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Device Health Table */}
      <div 
        className={`${cardStyles.card} ${cardStyles.compact}`}
      >
        {healthStats.length === 0 ? (
          <div className={cardStyles.card}>
            <Activity className="iconLarge" />
            <p >No health data available for the selected date</p>
          </div>
        ) : (
          <div className={tableStyles.scroll}>
            <table className={tableStyles.table}>
              <thead>
                <tr className={tableStyles.row}>
                  <th className={tableStyles.header}>Device</th>
                  <th className={tableStyles.header}>Events</th>
                  <th className={tableStyles.header}>Uploads</th>
                  <th className={tableStyles.header}>Errors</th>
                  <th className={tableStyles.header}>Connection Loss</th>
                  <th className={tableStyles.header}>Uptime</th>
                  <th className={tableStyles.header}>Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {healthStats.map((device, index) => (
                  <tr
                    key={device.mac_address || index}
                    className={tableStyles.rowInteractive}
                  >
                    <td className={tableStyles.cell}>
                      <div >
                        <div >
                          {(() => {
                            const normalizedMac = device.mac_address ? device.mac_address.toUpperCase().replace(/[:-]/g, '') : '';
                            return channelMap[normalizedMac] || `Device ${device.mac_address}`;
                          })()}
                        </div>
                        <div >
                          {device.mac_address}
                        </div>
                      </div>
                    </td>
                    <td className={tableStyles.cell}>{device.event_count || 0}</td>
                    <td className={tableStyles.cell}>{device.file_upload_count || 0}</td>
                    <td className={tableStyles.cell}>
                      {device.error_count || 0}
                    </td>
                    <td className={tableStyles.cell}>
                      {device.connection_loss_count || 0}
                    </td>
                    <td className={tableStyles.cell}>
                      {device.uptime_formatted || '00:00:00'}
                    </td>
                    <td className={tableStyles.cellMuted}>
                      {formatDateTime(device.last_activity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>

    {/* System Health Section */}
    <div className={`${cardStyles.card} ${cardStyles.compact}`}>
        <div className="row">
          <div className={cardStyles.card}>
            <Cpu className="iconMedium" />
          </div>
          <div>
            <h3 className={cardStyles.title}>System Health</h3>
            <p className="mutedText smallText">CPU, Memory, and Disk Usage</p>
          </div>
        </div>

        {systemLoading ? (
          <div className="row">
            <RefreshCw className="iconLarge spin" />
          </div>
        ) : !systemHealth || (!systemHealth.cpu && !systemHealth.memory && !systemHealth.disk) ? (
          <div className={cardStyles.card}>
            <Cpu className="iconLarge" />
            <p >No system health data available for the selected date</p>
            <p className="mutedText tinyText">
              System health monitoring collects data every 5 seconds. Data will appear after the first collection cycle.
            </p>
          </div>
        ) : (
          <div className="stack stackLarge">
            {/* CPU Metrics */}
            {systemHealth.cpu && (
              <div className={`${cardStyles.card} ${cardStyles.compact}`}>
                <div className="row">
                  <Cpu className="iconMedium" />
                  <h4 className={cardStyles.title}>CPU</h4>
                </div>
                <div className="gridTwo">
                  <div>
                    <div >Current</div>
                    <div >
                      {systemHealth.cpu.percent?.toFixed(1) || 0}%
                    </div>
                  </div>
                  <div>
                    <div >Peak</div>
                    <div >
                      {systemHealth.cpu.peak_percent?.toFixed(1) || 0}%
                    </div>
                  </div>
                  <div>
                    <div >Average</div>
                    <div >
                      {systemHealth.cpu.avg_percent?.toFixed(1) || 0}%
                    </div>
                  </div>
                  <div>
                    <div >Cores</div>
                    <div >
                      {systemHealth.cpu.count || 0}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Memory Metrics */}
            {systemHealth.memory && (
              <div className={`${cardStyles.card} ${cardStyles.compact}`}>
                <div className="row">
                  <MemoryStick className="iconMedium" />
                  <h4 className={cardStyles.title}>Memory (RAM)</h4>
                </div>
                <div className="gridTwo">
                  <div>
                    <div >Current Usage</div>
                    <div >
                      {systemHealth.memory.percent?.toFixed(1) || 0}%
                    </div>
                    <div >
                      {formatBytes(systemHealth.memory.used_bytes || 0)} / {formatBytes(systemHealth.memory.total_bytes || 0)}
                    </div>
                  </div>
                  <div>
                    <div >Peak Usage</div>
                    <div >
                      {systemHealth.memory.peak_percent?.toFixed(1) || 0}%
                    </div>
                    <div >
                      {formatBytes(systemHealth.memory.peak_used_bytes || 0)}
                    </div>
                  </div>
                  <div>
                    <div >Average Usage</div>
                    <div >
                      {systemHealth.memory.avg_percent?.toFixed(1) || 0}%
                    </div>
                    <div >
                      {formatBytes(systemHealth.memory.avg_used_bytes || 0)}
                    </div>
                  </div>
                  <div>
                    <div >Available</div>
                    <div >
                      {formatBytes(systemHealth.memory.available_bytes || 0)}
                    </div>
                  </div>
                </div>
                <div className={cardStyles.card}>
                  <div
                    className={`${noticeStyles.notice} ${noticeStyles.error}`}
                    style={{ width: `${Math.min(systemHealth.memory.percent || 0, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Disk Metrics */}
            {systemHealth.disk && (
              <div className={`${cardStyles.card} ${cardStyles.compact}`}>
                <div className="row">
                  <HardDrive className="iconMedium" />
                  <h4 className={cardStyles.title}>Disk Storage</h4>
                </div>
                <div className="gridTwo">
                  <div>
                    <div >Current Usage</div>
                    <div >
                      {systemHealth.disk.percent?.toFixed(1) || 0}%
                    </div>
                    <div >
                      {formatBytes(systemHealth.disk.used_bytes || 0)} / {formatBytes(systemHealth.disk.total_bytes || 0)}
                    </div>
                  </div>
                  <div>
                    <div >Peak Usage</div>
                    <div >
                      {systemHealth.disk.peak_percent?.toFixed(1) || 0}%
                    </div>
                    <div >
                      {formatBytes(systemHealth.disk.peak_used_bytes || 0)}
                    </div>
                  </div>
                  <div>
                    <div >Average Usage</div>
                    <div >
                      {systemHealth.disk.avg_percent?.toFixed(1) || 0}%
                    </div>
                    <div >
                      {formatBytes(systemHealth.disk.avg_used_bytes || 0)}
                    </div>
                  </div>
                  <div>
                    <div >Free Space</div>
                    <div >
                      {formatBytes(systemHealth.disk.free_bytes || 0)}
                    </div>
                  </div>
                </div>
                <div className={cardStyles.card}>
                  <div
                    className={`${noticeStyles.notice} ${noticeStyles.error}`}
                    style={{ width: `${Math.min(systemHealth.disk.percent || 0, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Additional Info */}
        {healthStats.length > 0 && (
          <div className={`${cardStyles.card} ${cardStyles.compact}`}>
            <div className="row">
              <AlertCircle className="iconMedium" />
              <div className="grow">
                <p className="mutedText smallText">
                  <strong>Note:</strong> Health data is updated every 5 minutes. Connection loss is detected when a device has no activity for 5 minutes or more.
                </p>
                {healthStats.some(d => d.device_created_at) && (
                  <p className="mutedText smallText">
                    Device creation times are tracked from the first connection or event.
                  </p>
                )}
                <p className="mutedText smallText">
                  System health metrics are collected every 5 seconds and persisted every 5 minutes. Peak values reset daily.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Health;
