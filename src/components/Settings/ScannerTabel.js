import { apiFetch } from '../../utils/apiClient';
import { useState, useEffect } from 'react';
import {
  Plus, Trash2, SmartphoneNfc, X, Edit2, Search,
  RotateCw, Check, Volume2, Lock, Unlock, AlertTriangle,
  Radio, Settings, Activity, Info, HelpCircle ,CircuitBoard,Microchip,Cable,InboxIcon ,PlugZap 
} from 'lucide-react';

const ScannerTable = ({ isDarkMode = true }) => {
  // State declarations
  const [scanners, setScanners] = useState([]);
  const [channels, setChannels] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedScanner, setSelectedScanner] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState({
    show: false,
    message: '',
    type: 'success'
  });
  const [formData, setFormData] = useState({
    id: '',
    channel: '',
    volume: 15,
    squelch: 0,
    status: 'disconnected',
  });
  const [activeTab, setActiveTab] = useState('scanners');
  const [confirmDialog, setConfirmDialog] = useState({
    show: false,
    title: '',
    message: '',
    onConfirm: null
  });

  // Theme classes
  const themeClasses = {
    bg: isDarkMode ? 'bg-gray-900' : 'bg-gray-100',
    text: isDarkMode ? 'text-gray-100' : 'text-gray-900',
    secondaryText: isDarkMode ? 'text-gray-400' : 'text-gray-600',
    card: isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    header: isDarkMode ? 'bg-gray-800' : 'bg-gray-50',
    input: isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300',
    button: isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300',
    tableHeader: isDarkMode ? 'bg-gray-750' : 'bg-gray-50',
    tableHover: isDarkMode ? 'hover:bg-gray-750' : 'hover:bg-gray-50',
    border: isDarkMode ? 'border-gray-700' : 'border-gray-200',
    divider: isDarkMode ? 'divide-gray-700' : 'divide-gray-200'
  };

  // Fetch initial data on component mount
  useEffect(() => {
    fetchScanners();
    fetchChannels();
  }, []);

  const fetchScanners = async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`/radio/list`, { method: 'GET' });
      const data = await response.json();
      const scannerArray = Object.entries(data.scanners || {}).map(([scannerId, details]) => ({
        scannerId,
        id: details.id || scannerId,
        channel: details.channel || '',
        port: details.port || '',
        model: details.model || '',
        version: details.version || '',
        status: details.status || 'disconnected',
        volume: details.volume || 5,
        squelch: details.squelch || 5,
      }));
      setScanners(scannerArray);
    } catch (error) {
      showNotification('Failed to fetch scanners', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async () => {
    try {
      const response = await apiFetch(`/channels`, { method: 'GET' });
      const data = await response.json();
      setChannels(data || []);
    } catch (error) {
      showNotification('Failed to fetch channels', 'error');
      setChannels([]);
    }
  };

  const editScanner = async (scannerId, updatedData) => {
    try {
      const response = await apiFetch(`/radio/${scannerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });
      if (!response.ok) throw new Error('Failed to update scanner');
      fetchScanners();
      showNotification(`Scanner ${scannerId} updated successfully`);
    } catch (error) {
      showNotification(`Failed to update scanner: ${error.message}`, 'error');
    }
  };

  const initScanners = async () => {
    setLoading(true);
    try {
      await apiFetch(`/radio/init`, { method: 'POST' });
      fetchScanners();
      showNotification('Scanners initialized successfully');
    } catch (error) {
      showNotification('Failed to initialize scanners', 'error');
    } finally {
      setLoading(false);
    }
  };

  const clearScanners = async () => {
    setConfirmDialog({ show: false, title: '', message: '', onConfirm: null });
    setLoading(true);
    try {
      await apiFetch(`/radio/clear`, { method: 'POST' });
      setScanners([]);
      showNotification('Inventory cleared successfully');
    } catch (error) {
      showNotification('Failed to clear inventory', 'error');
    } finally {
      setLoading(false);
    }
  };

  const confirmClearScanners = () => {
    setConfirmDialog({
      show: true,
      title: 'Clear Scanner Inventory',
      message: 'Are you sure you want to clear all scanner inventory? This action cannot be undone.',
      onConfirm: clearScanners
    });
  };

  const parkScanner = async (scannerId) => {
    try {
      await apiFetch(`/radio/${scannerId}/park`, { method: 'POST' });
      fetchScanners();
      showNotification(`Scanner ${scannerId} identified`);
    } catch (error) {
      showNotification('Failed to identify scanner', 'error');
    }
  };

  const reassignScanner = async (oldId, newId) => {
    try {
      await apiFetch(`/radio/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldId, newId }),
      });
      fetchScanners();
      showNotification(`Scanner reassigned from ${oldId} to ${newId}`);
    } catch (error) {
      showNotification('Failed to reassign scanner', 'error');
    }
  };

  const restoreIds = async () => {
    try {
      await apiFetch(`/radio/restore_ids`, { method: 'POST' });
      fetchScanners();
      showNotification('Scanner IDs restored successfully');
    } catch (error) {
      showNotification('Failed to restore IDs', 'error');
    }
  };

  const getAvailableChannels = () => {
    const linkedChannelIds = scanners.map(scanner => scanner.channel).filter(Boolean);
    return channels.map(channel => ({
      ...channel,
      isLinked: linkedChannelIds.includes(channel.id.toString())
    }));
  };

  const getChannelName = (channelId) => {
    const channel = channels.find((ch) => ch.id === Number(channelId));
    return channel ? channel.name : 'None';
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const openModal = (mode, scanner = null) => {
    setModalMode(mode);
    setSelectedScanner(scanner);
    setFormData(scanner || { id: '', channel: '', volume: 15, squelch: 0, status: 'disconnected' });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (modalMode === 'edit' && selectedScanner) {
      const updatedData = {
        channel: formData.channel,
        volume: parseInt(formData.volume, 10),
        squelch: parseInt(formData.squelch, 10),
        status: formData.status || selectedScanner.status,
        id: formData.id,
        port: selectedScanner.port,
        model: selectedScanner.model,
        version: selectedScanner.version,
      };
      await editScanner(selectedScanner.scannerId, updatedData);
      setIsModalOpen(false);
    }
  };

  const filteredScanners = scanners.filter(scanner =>
    scanner.scannerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (scanner.channel && getChannelName(scanner.channel).toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected': return 'text-green-500';
      case 'disconnected': return 'text-red-500';
      default: return 'text-yellow-500';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected': return <div className="w-3 h-3 rounded-full bg-green-500"></div>;
      case 'disconnected': return <div className="w-3 h-3 rounded-full bg-red-500"></div>;
      default: return <div className="w-3 h-3 rounded-full bg-yellow-500"></div>;
    }
  };

  return (
    <div className={`min-h-screen ${themeClasses.bg} ${themeClasses.text} transition-colors duration-300`}>
      {/* Header */}
      <header className={`sticky top-0 z-10 ${themeClasses.header} bg-opacity-90 backdrop-blur-md border-b ${themeClasses.border} shadow-lg`}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h1 className="text-2xl font-bold flex items-center gap-2 text-blue-400">
              <Radio className="w-6 h-6" />
              Scanner Management
            </h1>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${themeClasses.secondaryText} w-4 h-4`} />
                <input
                  type="text"
                  placeholder="Search scanners..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`pl-10 pr-4 py-2 ${themeClasses.input} rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-64`}
                />
              </div>
              <button
                onClick={() => window.location.reload()}
                className={`p-2 ${themeClasses.secondaryText} ${themeClasses.button} rounded-full transition-colors`}
                title="Refresh"
              >
                <RotateCw className="w-5 h-5" />
              </button>
              <button
                className={`p-2 ${themeClasses.secondaryText} ${themeClasses.button} rounded-full transition-colors`}
                title="Help"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className={`flex mt-4 border-b ${themeClasses.border}`}>
            <button
              onClick={() => setActiveTab('scanners')}
              className={`px-4 py-2 flex items-center gap-2 transition-colors ${activeTab === 'scanners' ? 'text-blue-400 border-b-2 border-blue-400' : `${themeClasses.secondaryText} hover:text-gray-200`
                }`}
            >
              <SmartphoneNfc className="w-4 h-4" />
              Scanners
            </button>
            <button
              onClick={() => setActiveTab('channels')}
              className={`px-4 py-2 flex items-center gap-2 transition-colors ${activeTab === 'channels' ? 'text-blue-400 border-b-2 border-blue-400' : `${themeClasses.secondaryText} hover:text-gray-200`
                }`}
            >
              <PlugZap  className="w-4 h-4" />
              Connection Map
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 flex items-center gap-2 transition-colors ${activeTab === 'settings' ? 'text-blue-400 border-b-2 border-blue-400' : `${themeClasses.secondaryText} hover:text-gray-200`
                }`}
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {activeTab === 'scanners' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className={`${themeClasses.card} rounded-xl p-6 shadow-lg border hover:border-blue-500 transition-colors`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`${themeClasses.secondaryText} font-medium`}>Total Scanners</h3>
                  <SmartphoneNfc className="w-5 h-5 text-blue-400" />
                </div>
                <p className="text-3xl font-bold">{scanners.length}</p>
                <div className={`mt-4 text-sm ${themeClasses.secondaryText}`}>
                  {scanners.filter(s => s.channel).length} scanners assigned
                </div>
              </div>

              <div className={`${themeClasses.card} rounded-xl p-6 shadow-lg border hover:border-green-500 transition-colors`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`${themeClasses.secondaryText} font-medium`}>Available Channels</h3>
                  <Radio className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-3xl font-bold">{channels.length}</p>
                <div className={`mt-4 text-sm ${themeClasses.secondaryText}`}>
                  {scanners.filter(s => s.channel).length}/{channels.length} channels in use
                </div>
              </div>

              <div className={`${themeClasses.card} rounded-xl p-6 shadow-lg border hover:border-purple-500 transition-colors`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`${themeClasses.secondaryText} font-medium`}>System Status</h3>
                  <Activity className="w-5 h-5 text-purple-400" />
                </div>
                <p className="text-3xl font-bold">
                  {scanners.filter(s => s.status === 'connected').length > 0 ? "Active" : "Idle"}
                </p>
                <div className={`mt-4 text-sm ${themeClasses.secondaryText}`}>
                  {scanners.filter(s => s.status === 'connected').length} scanners connected
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mb-6">
              <button
                onClick={initScanners}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white disabled:opacity-50 flex items-center gap-2 transition-colors shadow-lg"
              >
                <Plus className="w-4 h-4" />
                {loading ? 'Initializing...' : 'Initialize Scanners'}
              </button>
              <button
                onClick={confirmClearScanners}
                disabled={loading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white disabled:opacity-50 flex items-center gap-2 transition-colors shadow-lg"
              >
                <Trash2 className="w-4 h-4" />
                {loading ? 'Clearing...' : 'Clear Inventory'}
              </button>
              <button
                onClick={restoreIds}
                disabled={loading}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white disabled:opacity-50 flex items-center gap-2 transition-colors shadow-lg"
              >
                <RotateCw className="w-4 h-4" />
                {loading ? 'Restoring...' : 'Restore IDs'}
              </button>
            </div>

            <div className={`${themeClasses.card} rounded-xl overflow-hidden shadow-lg border`}>
              <div className={`p-4 ${themeClasses.tableHeader} border-b ${themeClasses.border} flex justify-between items-center`}>
                <h2 className="text-xl font-semibold">Scanner Devices</h2>
                <span className={`${themeClasses.button} px-3 py-1 rounded-full text-sm`}>
                  {filteredScanners.length} devices
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={themeClasses.tableHeader}>
                    <tr>
                      <th className={`px-6 py-4 text-left ${themeClasses.secondaryText} font-medium`}>ID</th>
                      <th className={`px-6 py-4 text-left ${themeClasses.secondaryText} font-medium`}>Status</th>
                      <th className={`px-6 py-4 text-left ${themeClasses.secondaryText} font-medium`}>Channel</th>
                      <th className={`px-6 py-4 text-left ${themeClasses.secondaryText} font-medium`}>Volume</th>
                      <th className={`px-6 py-4 text-left ${themeClasses.secondaryText} font-medium`}>Squelch</th>
                      <th className={`px-6 py-4 text-right ${themeClasses.secondaryText} font-medium`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className={themeClasses.divider}>
                    {loading ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-8 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-3"></div>
                            <p className={themeClasses.secondaryText}>Loading scanners...</p>
                          </div>
                        </td>
                      </tr>
                    ) : filteredScanners.length > 0 ? (
                      filteredScanners.map((scanner) => (
                        <tr key={scanner.scannerId} className={`${themeClasses.tableHover} transition-colors`}>
                          <td className="px-6 py-4 font-medium">{scanner.scannerId}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(scanner.status)}
                              <span className={getStatusColor(scanner.status)}>
                                {scanner.status.charAt(0).toUpperCase() + scanner.status.slice(1)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {scanner.channel ? (
                                <>
                                  <Lock className="w-4 h-4 text-blue-400" />
                                  <span>Ch #{scanner.channel}</span>
                                  <span className={themeClasses.secondaryText}>({getChannelName(scanner.channel)})</span>
                                </>
                              ) : (
                                <span className={`flex items-center gap-2 ${themeClasses.secondaryText}`}>
                                  <Unlock className="w-4 h-4" />
                                  Not assigned
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Volume2 className={`w-4 h-4 ${themeClasses.secondaryText}`} />
                              <div className={`${themeClasses.input} rounded-full h-2 w-32`}>
                                <div
                                  className="bg-blue-500 h-2 rounded-full"
                                  style={{ width: `${(scanner.volume / 15) * 100}%` }}
                                ></div>
                              </div>
                              <span className="text-sm">{scanner.volume}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className={`${themeClasses.input} rounded-full h-2 w-32`}>
                                <div
                                  className="bg-purple-500 h-2 rounded-full"
                                  style={{ width: `${(scanner.squelch / 10) * 100}%` }}
                                ></div>
                              </div>
                              <span className="text-sm">{scanner.squelch}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => parkScanner(scanner.scannerId)}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-md text-white text-sm flex items-center gap-1 transition-colors"
                                title="Identify this scanner"
                              >
                                <Radio className="w-3 h-3" />
                                Identify
                              </button>
                              <button
                                onClick={() => openModal('edit', scanner)}
                                className={`p-1 ${themeClasses.button} rounded-md transition-colors`}
                                title="Edit configuration"
                              >
                                <Edit2 className="w-4 h-4 text-blue-400" />
                              </button>
                              <button
                                onClick={() => {
                                  const newId = `SCANNER_${Math.floor(Math.random() * 1000)}`;
                                  reassignScanner(scanner.scannerId, newId);
                                }}
                                className={`p-1 ${themeClasses.button} rounded-md transition-colors`}
                                title="Reassign scanner ID"
                              >
                                <RotateCw className="w-4 h-4 text-yellow-400" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="px-6 py-8 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <Search className={`w-8 h-8 ${themeClasses.secondaryText} mb-2`} />
                            <p className={themeClasses.secondaryText}>No scanners found</p>
                            {searchTerm && (
                              <button
                                onClick={() => setSearchTerm('')}
                                className="mt-2 text-blue-400 hover:text-blue-300"
                              >
                                Clear search
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
{/* moden ui  */}
{activeTab === 'channels' && (
  <div className={`${themeClasses.card} rounded-2xl overflow-hidden shadow-lg border ${themeClasses.border}`}>
    <div className={`p-6 ${themeClasses.tableHeader} border-b ${themeClasses.border}`}>
      <h2 className={`text-2xl font-bold flex items-center ${isDarkMode ? 'text-indigo-300' : 'text-indigo-600'}`}>
        <CircuitBoard className="w-6 h-6 mr-2 opacity-80" />
        Connections
      </h2>
    </div>
    
    <div className="p-6 relative">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M10,20 Q50,50 90,20" stroke={isDarkMode ? '#8B5CF6' : '#6366F1'} strokeWidth="0.2" fill="none" />
          <path d="M10,50 Q50,80 90,50" stroke={isDarkMode ? '#EC4899' : '#8B5CF6'} strokeWidth="0.2" fill="none" />
          <path d="M10,80 Q50,20 90,80" stroke={isDarkMode ? '#6366F1' : '#EC4899'} strokeWidth="0.2" fill="none" />
        </svg>
      </div>
      
      <div className="space-y-8 relative z-10">
        {scanners.map(scanner => {
          const assignedChannel = channels.find(channel => channel.id.toString() === scanner.channel);
          const isConnected = scanner.status === 'connected' && assignedChannel;

          return (
            <div
              key={scanner.scannerId}
              className={`group relative flex items-center p-5 rounded-2xl border ${themeClasses.border} ${themeClasses.card} transition-all duration-300 hover:shadow-xl hover:scale-[1.01]`}
            >
              {/* Left Side: Scanner Device */}
              <div className="w-1/3 relative z-10">
                <div className={`p-4 ${themeClasses.card} rounded-xl border ${themeClasses.border} shadow-md backdrop-blur-sm bg-opacity-90 relative overflow-hidden`}>
                  {/* Decorative device background */}
                  <div className="absolute inset-0 opacity-5 pointer-events-none">
                    <svg width="100%" height="100%" viewBox="0 0 100 100">
                      <pattern id={`circuit-${scanner.scannerId}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M0,10 L8,10 L8,0 L10,0 L10,20 L8,20 L8,12 L0,12" stroke={isDarkMode ? '#fff' : '#000'} strokeWidth="0.5" fill="none" />
                        <circle cx="15" cy="5" r="1" fill={isDarkMode ? '#fff' : '#000'} />
                        <circle cx="5" cy="15" r="1" fill={isDarkMode ? '#fff' : '#000'} />
                      </pattern>
                      <rect width="100%" height="100%" fill={`url(#circuit-${scanner.scannerId})`} />
                    </svg>
                  </div>
                  
                  <div className="flex items-center gap-4 relative z-10">
                    <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-700/70' : 'bg-gray-100/70'} backdrop-blur-sm`}>
                      <div className="relative">
                        <SmartphoneNfc className="w-7 h-7 text-indigo-400" />
                        {isConnected && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-pulse border border-white"></span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className={`font-medium flex items-center gap-2 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-600'}`}>
                        {scanner.scannerId}
                        <Microchip className="w-3 h-3 text-indigo-300" />
                      </div>
                      <div className={`text-xs ${themeClasses.secondaryText} mt-1 flex items-center gap-2`}>
                        <span>{scanner.model || 'Device'}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-400"></span>
                        <span className="flex items-center">
                          <Volume2 className="w-3 h-3 mr-1" />
                          {scanner.volume}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center">
                        <div className={`w-3 h-3 rounded-full ${
                          isConnected ? 'bg-emerald-500' : 'bg-red-500'
                        } mr-2 relative ${
                          isConnected ? 'animate-pulse' : ''
                        }`}>
                          {isConnected && (
                            <div className="absolute inset-0 rounded-full bg-emerald-500 opacity-70 animate-ping"></div>
                          )}
                        </div>
                        <span className="text-[10px] uppercase font-semibold text-gray-400">
                          {isConnected ? 'Connected' : 'Disconnected'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Connection port indicator on right side of scanner */}
                  <div className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-1/2 w-4 h-10 rounded-r-md bg-indigo-500/70 flex items-center justify-center overflow-hidden">
                    <div className="w-2 h-6 rounded-full bg-indigo-300/30"></div>
                    {isConnected && (
                      <div className="absolute inset-0 bg-indigo-500 opacity-50 animate-pulse"></div>
                    )}
                  </div>
                </div>
              </div>

              {/* Middle: Connection Path */}
              <div className="flex-1 relative h-20 flex items-center justify-center px-4">
                <svg className="w-full h-16" viewBox="0 0 200 40" preserveAspectRatio="none">
                  {/* Base connection path */}
                  {isConnected ? (
                    <>
                      {/* Connected wire */}
                      <path
                        d="M0,20 C50,20 70,5 100,5 C130,5 150,35 200,35"
                        fill="none"
                        stroke={`url(#gradient-${scanner.scannerId})`}
                        strokeWidth="2"
                        className="transition-all duration-300"
                      />
                      
                      {/* Data flow animations */}
                      <circle
                        cx="0"
                        cy="20"
                        r="3"
                        fill="url(#radial-gradient)"
                        className="animate-[moveAlongConnectedPath_4s_infinite_ease-in-out]"
                        filter="drop-shadow(0 0 2px rgba(79, 70, 229, 0.5))"
                      />
                      <circle
                        cx="0"
                        cy="20"
                        r="3"
                        fill="url(#radial-gradient)"
                        className="animate-[moveAlongConnectedPath_4s_1s_infinite_ease-in-out]"
                        filter="drop-shadow(0 0 2px rgba(79, 70, 229, 0.5))"
                      />
                      
                      {/* Wire connectors/joints */}
                      <circle cx="100" cy="5" r="3" fill="#8B5CF6" opacity="0.7" />
                    </>
                  ) : (
                    // Disconnected wire
                    <path
                      d="M0,20 C40,20 60,20 80,20"
                      fill="none"
                      stroke={isDarkMode ? '#4B5563' : '#D1D5DB'}
                      strokeWidth="1.5"
                      strokeDasharray="4,2"
                      className="transition-all duration-300"
                    />
                  )}
                  
                  {/* Gradient definitions */}
                  <defs>
                    <linearGradient id={`gradient-${scanner.scannerId}`} x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#6366F1" />
                      <stop offset="50%" stopColor="#8B5CF6" />
                      <stop offset="100%" stopColor="#EC4899" />
                    </linearGradient>
                    <radialGradient id="radial-gradient">
                      <stop offset="0%" stopColor="white" />
                      <stop offset="100%" stopColor="#8B5CF6" />
                    </radialGradient>
                  </defs>
                </svg>
                
                <style jsx>{`
                  @keyframes moveAlongConnectedPath {
                    0% { cx: 0; cy: 20; }
                    25% { cx: 100; cy: 5; }
                    50% { cx: 200; cy: 35; }
                    75% { cx: 100; cy: 5; }
                    100% { cx: 0; cy: 20; }
                  }
                `}</style>
                
                {/* Connection status label */}
                {!isConnected && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wider opacity-70 text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                    Not Connected
                  </div>
                )}
              </div>

              {/* Right Side: Channel */}
              <div className="w-1/3 relative z-10">
                {isConnected && assignedChannel ? (
                  <div className={`group relative p-4 ${themeClasses.card} rounded-xl border ${themeClasses.border} shadow-md transition-all duration-300 group-hover:shadow-lg overflow-hidden`}>
                    {/* Connection port indicator on left side of channel */}
                    <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-10 rounded-l-md bg-indigo-500/70 flex items-center justify-center overflow-hidden">
                      <div className="w-2 h-6 rounded-full bg-indigo-300/30"></div>
                      <div className="absolute inset-0 bg-indigo-500 opacity-50 animate-pulse"></div>
                    </div>
                    
                    {/* Channel identifier */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-indigo-600 text-white font-semibold shadow-lg`}>
                        #{assignedChannel.id}
                      </div>
                      <h3 className={`font-semibold text-lg ${isDarkMode ? 'text-indigo-200' : 'text-indigo-600'}`}>
                        {assignedChannel.name}
                      </h3>
                    </div>
                    
                    {/* Channel status */}
                    <div className="flex items-center justify-between">
                      <div className={`text-xs ${themeClasses.secondaryText} flex items-center gap-1`}>
                        <Cable className="w-3 h-3" />
                        <span>Channel Status</span>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 transition-all duration-300 group-hover:shadow-sm">
                        Active
                      </span>
                    </div>
                    
                    {/* Subtle background */}
                    <div className="absolute inset-0 rounded-xl bg-indigo-500/5 -z-10"></div>
                  </div>
                ) : (
                  <div className={`text-center p-4 ${themeClasses.card} rounded-xl border ${themeClasses.border} border-dashed opacity-70`}>
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Cable className="w-5 h-5 text-gray-400" />
                      <span className={`text-sm ${themeClasses.secondaryText} italic`}>No Channel Connected</span>
                      <div className="mt-2 w-full h-8 rounded-lg bg-gray-200 dark:bg-gray-700 opacity-50"></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Enhanced Background Glow Effect */}
              {isConnected && (
                <div className="absolute inset-0 border border-indigo-500/30 rounded-2xl -z-10"></div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Unassigned channels */}
      {channels.filter(channel => !scanners.some(scanner => scanner.channel === channel.id.toString())).length > 0 && (
        <div className="mt-10 border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-medium mb-4 text-gray-500">Available Channels</h3>
          <div className="grid grid-cols-3 gap-4">
            {channels.filter(channel => !scanners.some(scanner => scanner.channel === channel.id.toString())).map(channel => (
              <div key={channel.id} className={`p-3 ${themeClasses.card} rounded-xl border ${themeClasses.border} border-dashed transition-duration-300 hover:border-indigo-500/30 hover:shadow-sm group cursor-pointer`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} text-gray-500 text-sm`}>
                    #{channel.id}
                  </div>
                  <h4 className="text-sm font-medium text-gray-500">{channel.name}</h4>
                </div>
                <div className="flex items-center justify-center gap-2 text-[10px] uppercase text-gray-400">
                  <InboxIcon className="w-3 h-3" />
                  <span>Available for Connection</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
)}

        {activeTab === 'settings' && (
          <div className={`${themeClasses.card} rounded-xl overflow-hidden shadow-lg border`}>
            <div className={`p-4 ${themeClasses.tableHeader} border-b ${themeClasses.border}`}>
              <h2 className="text-xl font-semibold">Scanner Settings</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={`p-4 ${themeClasses.tableHeader} rounded-lg border ${themeClasses.border}`}>
                  <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-blue-400" />
                    System Configuration
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className={`block text-sm ${themeClasses.secondaryText} mb-1`}>Default Volume</label>
                      <div className="flex items-center gap-3">
                        <Volume2 className={`w-4 h-4 ${themeClasses.secondaryText}`} />
                        <input
                          type="range"
                          min="0"
                          max="15"
                          value="10"
                          className="w-full"
                        />
                        <span className="text-sm">10</span>
                      </div>
                    </div>
                    <div>
                      <label className={`block text-sm ${themeClasses.secondaryText} mb-1`}>Default Squelch</label>
                      <div className="flex items-center gap-3">
                        <Volume2 className={`w-4 h-4 ${themeClasses.secondaryText}`} />
                        <input
                          type="range"
                          min="0"
                          max="10"
                          value="5"
                          className="w-full"
                        />
                        <span className="text-sm">5</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className={`p-4 ${themeClasses.tableHeader} rounded-lg border ${themeClasses.border}`}>
                  <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                    <Info className="w-5 h-5 text-blue-400" />
                    System Information
                  </h3>
                  <div className="space-y-4">
                    <div className={`flex justify-between border-b ${themeClasses.border} pb-2`}>
                      <span className={themeClasses.secondaryText}>Version</span>
                      <span>2.4.1</span>
                    </div>
                    <div className={`flex justify-between border-b ${themeClasses.border} pb-2`}>
                      <span className={themeClasses.secondaryText}>Last Updated</span>
                      <span>Today at 10:45 AM</span>
                    </div>
                    <div className={`flex justify-between border-b ${themeClasses.border} pb-2`}>
                      <span className={themeClasses.secondaryText}>Uptime</span>
                      <span>3 days, 7 hours</span>
                    </div>
                    <div className={`flex justify-between border-b ${themeClasses.border} pb-2`}>
                      <span className={themeClasses.secondaryText}>Scanner Protocol</span>
                      <span>RS232 / USB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={themeClasses.secondaryText}>Status</span>
                      <span className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        Operational
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {notification.show && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg transition-all duration-300 transform translate-y-0 ${notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}>
          <div className="flex items-center gap-3">
            {notification.type === 'success' ? (
              <Check className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
            <p>{notification.message}</p>
            <button
              onClick={() => setNotification({ ...notification, show: false })}
              className="ml-4 p-1 rounded-full hover:bg-opacity-20 hover:bg-black"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className={`${themeClasses.card} rounded-xl shadow-2xl w-full max-w-md p-6 border relative`}>
            <button
              onClick={() => setIsModalOpen(false)}
              className={`absolute top-4 right-4 p-1 rounded-full ${themeClasses.button} transition-colors`}
            >
              <X className={`w-5 h-5 ${themeClasses.secondaryText}`} />
            </button>

            <h2 className={`text-xl font-semibold mb-5 pb-2 border-b ${themeClasses.border}`}>
              {modalMode === 'edit' ? 'Edit Scanner Configuration' : 'Create Scanner'}
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm ${themeClasses.secondaryText} mb-1`}>Scanner ID</label>
                  <input
                    type="text"
                    name="id"
                    value={formData.id}
                    onChange={handleInputChange}
                    className={`w-full ${themeClasses.input} rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>

                <div>
                  <label className={`block text-sm ${themeClasses.secondaryText} mb-1`}>Assign Channel</label>
                  <select
                    name="channel"
                    value={formData.channel}
                    onChange={handleInputChange}
                    className={`w-full ${themeClasses.input} rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  >
                    <option value="">None</option>
                    {getAvailableChannels().map(channel => (
                      <option
                        key={channel.id}
                        value={channel.id}
                        disabled={channel.isLinked && formData.channel !== channel.id.toString()}
                      >
                        Channel #{channel.id} - {channel.name} {channel.isLinked && channel.id.toString() !== formData.channel ? '(In Use)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`flex justify-between text-sm ${themeClasses.secondaryText} mb-1`}>
                    <span>Volume</span>
                    <span>{formData.volume}</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <Volume2 className={`w-4 h-4 ${themeClasses.secondaryText}`} />
                    <input
                      type="range"
                      name="volume"
                      min="0"
                      max="15"
                      value={formData.volume}
                      onChange={handleInputChange}
                      className="w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className={`flex justify-between text-sm ${themeClasses.secondaryText} mb-1`}>
                    <span>Squelch</span>
                    <span>{formData.squelch}</span>
                  </label>
                  <input
                    type="range"
                    name="squelch"
                    min="0"
                    max="10"
                    value={formData.squelch}
                    onChange={handleInputChange}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`px-4 py-2 ${themeClasses.button} rounded-lg text-white transition-colors`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDialog.show && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className={`${themeClasses.card} rounded-xl shadow-2xl w-full max-w-md p-6 border`}>
            <div className="text-center mb-4">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold">{confirmDialog.title}</h3>
              <p className={`mt-2 ${themeClasses.secondaryText}`}>{confirmDialog.message}</p>
            </div>

            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={() => setConfirmDialog({ ...confirmDialog, show: false })}
                className={`px-4 py-2 ${themeClasses.button} rounded-lg text-white transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScannerTable;