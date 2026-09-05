import React, { useState, useEffect } from 'react';
import api from '../../utils/apiClient';
import { 
  Wrench, 
  Clock, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Database,
  Trash2,
  HardDrive,
  ChevronLeft,
  ChevronRight,
  Play,
  Calendar
} from 'lucide-react';
import SettingsSectionHeader from './SettingsSectionHeader';

const Maintenance = ({ isDarkMode, showToast }) => {
  const [maintenanceTime, setMaintenanceTime] = useState('03:00');
  const [backupTime, setBackupTime] = useState('03:00');
  const [enabledTasks, setEnabledTasks] = useState({
    data_backup: true,
    logs_cleanup: true,
    health_checks: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [runningTasks, setRunningTasks] = useState(false);
  const RECORDS_PER_PAGE = 20;

  const TASK_DESCRIPTIONS = {
    data_backup: 'Data backup based on Backup & Restore settings',
    logs_cleanup: 'Logs cleanup (removes logs older than 30 days)',
    health_checks: 'Health checks (database sizes, top tables, disk usage)'
  };

  const TASK_ICONS = {
    data_backup: Database,
    logs_cleanup: Trash2,
    health_checks: HardDrive
  };

  useEffect(() => {
    fetchSettings();
    fetchHistory();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [currentPage]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/maintenance/settings`);
      const data = response.data;
      
      setMaintenanceTime(data.maintenance_time || '03:00');
      setBackupTime(data.backup_time || '03:00');
      
      // Convert array to object for easier state management
      const tasksObj = {};
      const enabledArray = data.enabled_tasks || [];
      tasksObj.data_backup = enabledArray.includes('data_backup');
      tasksObj.logs_cleanup = enabledArray.includes('logs_cleanup');
      tasksObj.health_checks = enabledArray.includes('health_checks');
      
      setEnabledTasks(tasksObj);
    } catch (error) {
      console.error('Error fetching maintenance settings:', error);
      showToast('Error loading maintenance settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await api.get(`/maintenance/history?page=${currentPage}&per_page=${RECORDS_PER_PAGE}`);
      setHistory(response.data.history || []);
      setTotalPages(response.data.total_pages || 1);
    } catch (error) {
      console.error('Error fetching maintenance history:', error);
      showToast('Error loading maintenance history', 'error');
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Convert object back to array
      const enabledArray = Object.keys(enabledTasks).filter(key => enabledTasks[key]);
      await api.put(`/maintenance/settings`, {
        maintenance_time: maintenanceTime,
        enabled_tasks: enabledArray
      });
      
      showToast('Maintenance settings saved successfully', 'success');
      fetchSettings();
    } catch (error) {
      console.error('Error saving maintenance settings:', error);
      showToast('Error saving maintenance settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRunNow = async () => {
    try {
      setRunningTasks(true);
      const enabledArray = Object.keys(enabledTasks).filter(key => enabledTasks[key]);
      await api.post(`/maintenance/run`, {
        tasks: enabledArray
      });
      
      showToast('Maintenance tasks started', 'success');
      // Refresh history after a short delay
      setTimeout(() => {
        fetchHistory();
      }, 2000);
    } catch (error) {
      console.error('Error running maintenance tasks:', error);
      showToast('Error starting maintenance tasks', 'error');
    } finally {
      setRunningTasks(false);
    }
  };

  const handleTaskToggle = (taskId) => {
    setEnabledTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (e) {
      return dateString;
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  const getStatusIcon = (status) => {
    if (status === 'success') {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    } else if (status === 'failed') {
      return <XCircle className="w-5 h-5 text-red-500" />;
    } else if (status === 'running') {
      return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
    }
    return <Clock className="w-5 h-5 text-gray-500" />;
  };

  const getStatusText = (status) => {
    if (status === 'success') return 'Success';
    if (status === 'failed') return 'Failed';
    if (status === 'running') return 'Running';
    return 'Unknown';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsSectionHeader
        icon={Wrench}
        title="Maintenance"
        description="Configure overnight maintenance tasks and view maintenance history"
        isDarkMode={isDarkMode}
        iconColor="blue"
      />

      {/* Maintenance Time Configuration */}
      <div className={`rounded-2xl shadow-lg p-6 transition-colors duration-300 border ${
        isDarkMode
          ? 'bg-gray-900/60 border-gray-800'
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center gap-4 mb-6">
          <div className={`p-3 rounded-2xl shadow-md ${isDarkMode ? 'bg-blue-600' : 'bg-blue-500'}`}>
            <Clock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className={`text-xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
              Maintenance Schedule
            </h3>
            <p className={`mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Set the time when maintenance tasks will run automatically
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Maintenance Time
            </label>
            <input
              type="time"
              value={maintenanceTime}
              onChange={(e) => setMaintenanceTime(e.target.value)}
              className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                isDarkMode
                  ? 'bg-gray-800 border-gray-700 text-gray-100 focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
              }`}
            />
            <p className={`mt-1 text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              Default: 3:00 AM
            </p>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Backup Time (from Backup & Restore settings)
            </label>
            <input
              type="time"
              value={backupTime}
              disabled
              className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                isDarkMode
                  ? 'bg-gray-800/50 border-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            />
            <p className={`mt-1 text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              Configured in Backup & Restore tab
            </p>
          </div>
        </div>
      </div>

      {/* Enabled Tasks */}
      <div className={`rounded-2xl shadow-lg p-6 transition-colors duration-300 border ${
        isDarkMode
          ? 'bg-gray-900/60 border-gray-800'
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center gap-4 mb-6">
          <div className={`p-3 rounded-2xl shadow-md ${isDarkMode ? 'bg-green-600' : 'bg-green-500'}`}>
            <Wrench className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className={`text-xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
              Maintenance Tasks
            </h3>
            <p className={`mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Select which tasks should run during overnight maintenance
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {Object.keys(TASK_DESCRIPTIONS).map((taskId) => {
            const Icon = TASK_ICONS[taskId];
            const isEnabled = enabledTasks[taskId];
            
            return (
              <div
                key={taskId}
                onClick={() => handleTaskToggle(taskId)}
                className={`p-5 rounded-xl border-2 transition-all duration-300 cursor-pointer ${
                  isEnabled
                    ? isDarkMode
                      ? 'bg-blue-900/30 border-blue-400 shadow-lg'
                      : 'bg-blue-50 border-blue-500 shadow-lg'
                    : isDarkMode
                      ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-xl transition-all duration-300 ${
                      isEnabled
                        ? isDarkMode
                          ? 'bg-blue-500/20 shadow-inner'
                          : 'bg-blue-500 shadow-inner'
                        : isDarkMode
                          ? 'bg-gray-700'
                          : 'bg-gray-100'
                    }`}>
                      <Icon size={24} className={isEnabled
                        ? isDarkMode
                          ? 'text-blue-300'
                          : 'text-white'
                        : isDarkMode
                          ? 'text-gray-400'
                          : 'text-gray-500'
                      } />
                    </div>
                    <div className="text-left">
                      <h4 className={`font-semibold text-lg ${
                        isDarkMode
                          ? isEnabled
                            ? 'text-blue-300'
                            : 'text-gray-300'
                          : isEnabled
                            ? 'text-blue-900'
                            : 'text-gray-700'
                      }`}>
                        {TASK_DESCRIPTIONS[taskId]}
                      </h4>
                    </div>
                  </div>
                  <div className="relative">
                    <div className={`w-12 h-6 rounded-full transition-colors duration-300 ${
                      isEnabled
                        ? isDarkMode
                          ? 'bg-blue-500'
                          : 'bg-blue-500'
                        : isDarkMode
                          ? 'bg-gray-700'
                          : 'bg-gray-200'
                    }`}>
                      <div className={`absolute w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 top-0.5 ${
                        isEnabled ? 'translate-x-6 left-1' : 'translate-x-0 left-1'
                      }`} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={handleRunNow}
            disabled={runningTasks}
            className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 ${
              isDarkMode
                ? runningTasks
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                : runningTasks
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {runningTasks ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Now
              </>
            )}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 ${
              isDarkMode
                ? saving
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
                : saving
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </button>
        </div>
      </div>

      {/* Maintenance History */}
      <div className={`rounded-2xl shadow-lg p-6 transition-colors duration-300 border ${
        isDarkMode
          ? 'bg-gray-900/60 border-gray-800'
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center gap-4 mb-6">
          <div className={`p-3 rounded-2xl shadow-md ${isDarkMode ? 'bg-purple-600' : 'bg-purple-500'}`}>
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className={`text-xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
              Maintenance History
            </h3>
            <p className={`mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              View history of all maintenance tasks
            </p>
          </div>
        </div>

        {history.length === 0 ? (
          <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            No maintenance history available
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Task
                    </th>
                    <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Started
                    </th>
                    <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Duration
                    </th>
                    <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record) => {
                    const Icon = TASK_ICONS[record.task_id] || Wrench;
                    return (
                      <tr
                        key={record.id}
                        className={`border-b ${isDarkMode ? 'border-gray-800 hover:bg-gray-800/50' : 'border-gray-100 hover:bg-gray-50'}`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                            <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                              {record.description}
                            </span>
                          </div>
                        </td>
                        <td className={`py-3 px-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {formatDate(record.started_at)}
                        </td>
                        <td className={`py-3 px-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {formatDuration(record.duration_seconds)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(record.status)}
                            <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                              {getStatusText(record.status)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 ${
                    isDarkMode
                      ? currentPage === 1
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : currentPage === 1
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 ${
                    isDarkMode
                      ? currentPage === totalPages
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : currentPage === totalPages
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Maintenance;

