import React, { useState, useEffect } from 'react';
import api from '../../utils/apiClient';
import { Activity, Calendar, RefreshCw, AlertCircle, Cpu, HardDrive, MemoryStick } from 'lucide-react';

const Health = ({ isDarkMode }) => {
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

  const containerClasses = isDarkMode
    ? 'bg-gray-800/50 border-gray-700'
    : 'bg-gray-50 border-gray-200';

  const cardClasses = isDarkMode
    ? 'bg-gray-800 border-gray-700'
    : 'bg-white border-gray-200';

  const textClasses = isDarkMode
    ? 'text-gray-300'
    : 'text-gray-700';

  const labelClasses = isDarkMode
    ? 'text-gray-400'
    : 'text-gray-600';

  if (loading && healthStats.length === 0) {
    return (
      <div className={`rounded-lg border p-6 ${containerClasses}`}>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className={`w-8 h-8 animate-spin ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Recorder Health Section */}
      <div className={`rounded-lg border p-4 md:p-6 ${containerClasses}`}>
        {/* Header with date picker and refresh */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
            <Activity className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
          <div>
            <h3 className={`text-lg font-semibold ${textClasses}`}>Recorder Health</h3>
            <p className={`text-sm ${labelClasses}`}>Monitor recording device health and activity</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className={`w-4 h-4 ${labelClasses}`} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={`px-3 py-2 rounded-lg border text-sm ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-gray-300'
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            />
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`px-4 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
              isDarkMode
                ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            } ${refreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Device Health Table */}
      <div 
        className={`mt-4 rounded-lg border p-4 md:p-6 ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'border-gray-200'}`}
        style={!isDarkMode ? { backgroundColor: 'var(--toastify-color-light)' } : {}}
      >
        {healthStats.length === 0 ? (
          <div className={`rounded-lg border p-12 text-center ${cardClasses}`}>
            <Activity className={`w-12 h-12 mx-auto mb-4 ${labelClasses}`} />
            <p className={textClasses}>No health data available for the selected date</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <th className={`text-left py-3 px-4 font-semibold ${labelClasses}`}>Device</th>
                  <th className={`text-left py-3 px-4 font-semibold ${labelClasses}`}>Events</th>
                  <th className={`text-left py-3 px-4 font-semibold ${labelClasses}`}>Uploads</th>
                  <th className={`text-left py-3 px-4 font-semibold ${labelClasses}`}>Errors</th>
                  <th className={`text-left py-3 px-4 font-semibold ${labelClasses}`}>Connection Loss</th>
                  <th className={`text-left py-3 px-4 font-semibold ${labelClasses}`}>Uptime</th>
                  <th className={`text-left py-3 px-4 font-semibold ${labelClasses}`}>Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {healthStats.map((device, index) => (
                  <tr
                    key={device.mac_address || index}
                    className={`border-b ${isDarkMode ? 'border-gray-700 hover:bg-gray-800/50' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    <td className={`py-3 px-4 ${textClasses}`}>
                      <div className="flex flex-col">
                        <div className="font-medium">
                          {(() => {
                            const normalizedMac = device.mac_address ? device.mac_address.toUpperCase().replace(/[:-]/g, '') : '';
                            return channelMap[normalizedMac] || `Device ${device.mac_address}`;
                          })()}
                        </div>
                        <div className={`text-xs font-mono ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {device.mac_address}
                        </div>
                      </div>
                    </td>
                    <td className={`py-3 px-4 ${textClasses}`}>{device.event_count || 0}</td>
                    <td className={`py-3 px-4 ${textClasses}`}>{device.file_upload_count || 0}</td>
                    <td className={`py-3 px-4 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                      {device.error_count || 0}
                    </td>
                    <td className={`py-3 px-4 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                      {device.connection_loss_count || 0}
                    </td>
                    <td className={`py-3 px-4 ${textClasses} font-mono`}>
                      {device.uptime_formatted || '00:00:00'}
                    </td>
                    <td className={`py-3 px-4 ${textClasses} text-xs`}>
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
    <div className={`mt-8 rounded-lg border p-4 md:p-6 ${containerClasses}`}>
        <div className="flex items-center gap-3 mb-6">
          <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
            <Cpu className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
          <div>
            <h3 className={`text-lg font-semibold ${textClasses}`}>System Health</h3>
            <p className={`text-sm ${labelClasses}`}>CPU, Memory, and Disk Usage</p>
          </div>
        </div>

        {systemLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className={`w-8 h-8 animate-spin ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
          </div>
        ) : !systemHealth || (!systemHealth.cpu && !systemHealth.memory && !systemHealth.disk) ? (
          <div className={`rounded-lg border p-12 text-center ${cardClasses}`}>
            <Cpu className={`w-12 h-12 mx-auto mb-4 ${labelClasses}`} />
            <p className={textClasses}>No system health data available for the selected date</p>
            <p className={`text-xs mt-2 ${labelClasses}`}>
              System health monitoring collects data every 5 seconds. Data will appear after the first collection cycle.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* CPU Metrics */}
            {systemHealth.cpu && (
              <div className={`rounded-lg border p-4 ${cardClasses}`}>
                <div className="flex items-center gap-2 mb-4">
                  <Cpu className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                  <h4 className={`font-semibold ${textClasses}`}>CPU</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className={`text-sm ${labelClasses} mb-1`}>Current</div>
                    <div className={`text-xl font-bold ${textClasses}`}>
                      {systemHealth.cpu.percent?.toFixed(1) || 0}%
                    </div>
                  </div>
                  <div>
                    <div className={`text-sm ${labelClasses} mb-1`}>Peak</div>
                    <div className={`text-xl font-bold ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                      {systemHealth.cpu.peak_percent?.toFixed(1) || 0}%
                    </div>
                  </div>
                  <div>
                    <div className={`text-sm ${labelClasses} mb-1`}>Average</div>
                    <div className={`text-xl font-bold ${textClasses}`}>
                      {systemHealth.cpu.avg_percent?.toFixed(1) || 0}%
                    </div>
                  </div>
                  <div>
                    <div className={`text-sm ${labelClasses} mb-1`}>Cores</div>
                    <div className={`text-xl font-bold ${textClasses}`}>
                      {systemHealth.cpu.count || 0}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Memory Metrics */}
            {systemHealth.memory && (
              <div className={`rounded-lg border p-4 ${cardClasses}`}>
                <div className="flex items-center gap-2 mb-4">
                  <MemoryStick className={`w-5 h-5 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
                  <h4 className={`font-semibold ${textClasses}`}>Memory (RAM)</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className={`text-sm ${labelClasses} mb-1`}>Current Usage</div>
                    <div className={`text-xl font-bold ${textClasses}`}>
                      {systemHealth.memory.percent?.toFixed(1) || 0}%
                    </div>
                    <div className={`text-xs ${labelClasses}`}>
                      {formatBytes(systemHealth.memory.used_bytes || 0)} / {formatBytes(systemHealth.memory.total_bytes || 0)}
                    </div>
                  </div>
                  <div>
                    <div className={`text-sm ${labelClasses} mb-1`}>Peak Usage</div>
                    <div className={`text-xl font-bold ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                      {systemHealth.memory.peak_percent?.toFixed(1) || 0}%
                    </div>
                    <div className={`text-xs ${labelClasses}`}>
                      {formatBytes(systemHealth.memory.peak_used_bytes || 0)}
                    </div>
                  </div>
                  <div>
                    <div className={`text-sm ${labelClasses} mb-1`}>Average Usage</div>
                    <div className={`text-xl font-bold ${textClasses}`}>
                      {systemHealth.memory.avg_percent?.toFixed(1) || 0}%
                    </div>
                    <div className={`text-xs ${labelClasses}`}>
                      {formatBytes(systemHealth.memory.avg_used_bytes || 0)}
                    </div>
                  </div>
                  <div>
                    <div className={`text-sm ${labelClasses} mb-1`}>Available</div>
                    <div className={`text-xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                      {formatBytes(systemHealth.memory.available_bytes || 0)}
                    </div>
                  </div>
                </div>
                <div className={`w-full bg-gray-700 rounded-full h-2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                  <div
                    className={`h-2 rounded-full ${systemHealth.memory.percent > 80 ? 'bg-red-500' : systemHealth.memory.percent > 60 ? 'bg-orange-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(systemHealth.memory.percent || 0, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Disk Metrics */}
            {systemHealth.disk && (
              <div className={`rounded-lg border p-4 ${cardClasses}`}>
                <div className="flex items-center gap-2 mb-4">
                  <HardDrive className={`w-5 h-5 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
                  <h4 className={`font-semibold ${textClasses}`}>Disk Storage</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className={`text-sm ${labelClasses} mb-1`}>Current Usage</div>
                    <div className={`text-xl font-bold ${textClasses}`}>
                      {systemHealth.disk.percent?.toFixed(1) || 0}%
                    </div>
                    <div className={`text-xs ${labelClasses}`}>
                      {formatBytes(systemHealth.disk.used_bytes || 0)} / {formatBytes(systemHealth.disk.total_bytes || 0)}
                    </div>
                  </div>
                  <div>
                    <div className={`text-sm ${labelClasses} mb-1`}>Peak Usage</div>
                    <div className={`text-xl font-bold ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                      {systemHealth.disk.peak_percent?.toFixed(1) || 0}%
                    </div>
                    <div className={`text-xs ${labelClasses}`}>
                      {formatBytes(systemHealth.disk.peak_used_bytes || 0)}
                    </div>
                  </div>
                  <div>
                    <div className={`text-sm ${labelClasses} mb-1`}>Average Usage</div>
                    <div className={`text-xl font-bold ${textClasses}`}>
                      {systemHealth.disk.avg_percent?.toFixed(1) || 0}%
                    </div>
                    <div className={`text-xs ${labelClasses}`}>
                      {formatBytes(systemHealth.disk.avg_used_bytes || 0)}
                    </div>
                  </div>
                  <div>
                    <div className={`text-sm ${labelClasses} mb-1`}>Free Space</div>
                    <div className={`text-xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                      {formatBytes(systemHealth.disk.free_bytes || 0)}
                    </div>
                  </div>
                </div>
                <div className={`w-full bg-gray-700 rounded-full h-2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                  <div
                    className={`h-2 rounded-full ${systemHealth.disk.percent > 90 ? 'bg-red-500' : systemHealth.disk.percent > 75 ? 'bg-orange-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(systemHealth.disk.percent || 0, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Additional Info */}
        {healthStats.length > 0 && (
          <div className={`mt-6 p-4 rounded-lg border ${cardClasses}`}>
            <div className="flex items-start gap-3">
              <AlertCircle className={`w-5 h-5 mt-0.5 ${labelClasses}`} />
              <div className="flex-1">
                <p className={`text-sm ${textClasses}`}>
                  <strong>Note:</strong> Health data is updated every 5 minutes. Connection loss is detected when a device has no activity for 5 minutes or more.
                </p>
                {healthStats.some(d => d.device_created_at) && (
                  <p className={`text-sm mt-2 ${labelClasses}`}>
                    Device creation times are tracked from the first connection or event.
                  </p>
                )}
                <p className={`text-sm mt-2 ${labelClasses}`}>
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

