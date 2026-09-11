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

import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import buttonStyles from '../ui/Button.module.css';
import noticeStyles from '../ui/Notice.module.css';
import tableStyles from '../ui/Table.module.css';
const Maintenance = ({ showToast }) => {
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
      return <CheckCircle className="iconMedium" />;
    } else if (status === 'failed') {
      return <XCircle className="iconMedium" />;
    } else if (status === 'running') {
      return <RefreshCw className="iconMedium spin" />;
    }
    return <Clock className="iconMedium" />;
  };

  const getStatusText = (status) => {
    if (status === 'success') return 'Success';
    if (status === 'failed') return 'Failed';
    if (status === 'running') return 'Running';
    return 'Unknown';
  };

  if (loading) {
    return (
      <div className="row">
        <RefreshCw className="iconLarge spin" />
      </div>
    );
  }

  return (
    <div className="stack stackLarge">
      <SettingsSectionHeader
        icon={Wrench}
        title="Maintenance"
        description="Configure overnight maintenance tasks and view maintenance history"
        iconColor="blue"
      />

      {/* Maintenance Time Configuration */}
      <div className={cardStyles.card}>
        <div className="row">
          <div className={`${cardStyles.card} ${cardStyles.compact}`}>
            <Clock className="iconLarge" />
          </div>
          <div>
            <h3 className="pageTitle">
              Maintenance Schedule
            </h3>
            <p className="mutedText smallText">
              Set the time when maintenance tasks will run automatically
            </p>
          </div>
        </div>

        <div className="gridTwo">
          <div>
            <label className={formStyles.label}>
              Maintenance Time
            </label>
            <input
              type="time"
              value={maintenanceTime}
              onChange={(e) => setMaintenanceTime(e.target.value)}
              className={formStyles.input}
            />
            <p className="mutedText tinyText">
              Default: 3:00 AM
            </p>
          </div>

          <div>
            <label className={formStyles.label}>
              Backup Time (from Backup & Restore settings)
            </label>
            <input
              type="time"
              value={backupTime}
              disabled
              className={formStyles.input}
            />
            <p className="mutedText tinyText">
              Configured in Backup & Restore tab
            </p>
          </div>
        </div>
      </div>

      {/* Enabled Tasks */}
      <div className={cardStyles.card}>
        <div className="row">
          <div className={`${noticeStyles.notice} ${noticeStyles.success}`}>
            <Wrench className="iconLarge" />
          </div>
          <div>
            <h3 className="pageTitle">
              Maintenance Tasks
            </h3>
            <p className="mutedText smallText">
              Select which tasks should run during overnight maintenance
            </p>
          </div>
        </div>

        <div className="stack">
          {Object.keys(TASK_DESCRIPTIONS).map((taskId) => {
            const Icon = TASK_ICONS[taskId];
            const isEnabled = enabledTasks[taskId];
            
            return (
              <div
                key={taskId}
                onClick={() => handleTaskToggle(taskId)}
                className={cardStyles.card}
              >
                <div className="rowBetween">
                  <div className="row">
                    <div >
                      <Icon size={24} />
                    </div>
                    <div >
                      <h4 className={cardStyles.title}>
                        {TASK_DESCRIPTIONS[taskId]}
                      </h4>
                    </div>
                  </div>
                  <div >
                    <div >
                      <div className={cardStyles.card} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rowWrap">
          <button
            onClick={handleRunNow}
            disabled={runningTasks}
            className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
          >
            {runningTasks ? (
              <>
                <RefreshCw className="iconSmall spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="iconSmall" />
                Run Now
              </>
            )}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`${buttonStyles.button} ${buttonStyles.success} ${buttonStyles.medium}`}
          >
            {saving ? (
              <>
                <RefreshCw className="iconSmall spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </button>
        </div>
      </div>

      {/* Maintenance History */}
      <div className={cardStyles.card}>
        <div className="row">
          <div className={`${cardStyles.card} ${cardStyles.compact}`}>
            <Calendar className="iconLarge" />
          </div>
          <div>
            <h3 className="pageTitle">
              Maintenance History
            </h3>
            <p className="mutedText smallText">
              View history of all maintenance tasks
            </p>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="centeredContent mutedText smallText">
            No maintenance history available
          </div>
        ) : (
          <>
            <div className={tableStyles.scroll}>
              <table className={tableStyles.table}>
                <thead>
                  <tr className={tableStyles.row}>
                    <th className={tableStyles.header}>
                      Task
                    </th>
                    <th className={tableStyles.header}>
                      Started
                    </th>
                    <th className={tableStyles.header}>
                      Duration
                    </th>
                    <th className={tableStyles.header}>
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
                        className={tableStyles.rowInteractive}
                      >
                        <td className={tableStyles.cell}>
                          <div className="row">
                            <Icon className="iconSmall" />
                            <span className="mutedText smallText">
                              {record.description}
                            </span>
                          </div>
                        </td>
                        <td className={tableStyles.cellMuted}>
                          {formatDate(record.started_at)}
                        </td>
                        <td className={tableStyles.cellMuted}>
                          {formatDuration(record.duration_seconds)}
                        </td>
                        <td className={tableStyles.cell}>
                          <div className="row">
                            {getStatusIcon(record.status)}
                            <span className="mutedText smallText">
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
              <div className="rowBetween">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
                >
                  <ChevronLeft className="iconSmall" />
                  Previous
                </button>
                <span className="mutedText smallText">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
                >
                  Next
                  <ChevronRight className="iconSmall" />
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
