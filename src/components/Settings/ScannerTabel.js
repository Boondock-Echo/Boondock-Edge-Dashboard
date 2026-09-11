import { apiFetch } from '../../utils/apiClient';
import { useState, useEffect, useRef } from 'react';
import {
  Plus, Trash2, SmartphoneNfc, X, Edit2, Search,
  RotateCw, Check, Volume2, Lock, Unlock, AlertTriangle,
  Radio, Settings, Info, HelpCircle ,CircuitBoard,Cable,InboxIcon ,PlugZap 
} from 'lucide-react';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import modalStyles from '../ui/Modal.module.css';
import noticeStyles from '../ui/Notice.module.css';
import navigationStyles from '../ui/Navigation.module.css';
import tableStyles from '../ui/Table.module.css';
import styles from '../ui/ScannerTable.module.css';

const ScannerTable = () => {
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
  const scannerDialogRef = useRef(null);
  const confirmDialogRef = useRef(null);


  useEffect(() => {
    const dialog = scannerDialogRef.current;
    if (!dialog) return;
    if (isModalOpen && !dialog.open) dialog.showModal();
    if (!isModalOpen && dialog.open) dialog.close();
  }, [isModalOpen]);

  useEffect(() => {
    const dialog = confirmDialogRef.current;
    if (!dialog) return;
    if (confirmDialog.show && !dialog.open) dialog.showModal();
    if (!confirmDialog.show && dialog.open) dialog.close();
  }, [confirmDialog.show]);

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

  // Theme classes
  // Status appearance now maps to semantic global theme classes instead of dark/light branches.
  const getStatusClass = (status) => {
    switch (status) {
      case 'connected': return 'pillSuccess';
      case 'disconnected': return 'pillDanger';
      default: return 'pillWarning';
    }
  };


  return (
    <div className="stack stackLarge">
      {/* Header */}
      <div className={cardStyles.header}>
        <div>
          <h1 className={cardStyles.title}><Radio size={24} />Scanner Management</h1>
        </div>
        <div className="rowWrap">
          <div className={formStyles.inputFrame}>
            <Search size={16} className={formStyles.inputIcon} />
            <input
              type="text"
              placeholder="Search scanners..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={formStyles.iconInput}
            />
          </div>
          <Button size="icon" variant="ghost" onClick={() => window.location.reload()} aria-label="Refresh" title="Refresh">
            <RotateCw />
          </Button>
          <Button size="icon" variant="ghost" aria-label="Help" title="Help">
            <HelpCircle />
          </Button>
        </div>
      </div>

      <div className={navigationStyles.subnav}>
        <button onClick={() => setActiveTab('scanners')} className={`${navigationStyles.tab} ${activeTab === 'scanners' ? navigationStyles.active : ''}`}>
          <SmartphoneNfc size={16} /> Scanners
        </button>
        <button onClick={() => setActiveTab('channels')} className={`${navigationStyles.tab} ${activeTab === 'channels' ? navigationStyles.active : ''}`}>
          <PlugZap size={16} /> Connection Map
        </button>
        <button onClick={() => setActiveTab('settings')} className={`${navigationStyles.tab} ${activeTab === 'settings' ? navigationStyles.active : ''}`}>
          <Settings size={16} /> Settings
        </button>
      </div>

      {activeTab === 'scanners' && (
        <>
          {/* Stats */}
          <div className="gridThree">
            <div className={`${cardStyles.card} ${cardStyles.compact}`}>
              <p className={cardStyles.description}>Total Scanners</p>
              <strong>{scanners.length}</strong>
            </div>
            <div className={`${cardStyles.card} ${cardStyles.compact}`}>
              <p className={cardStyles.description}>Assigned Channels</p>
              <strong>{scanners.filter(s => s.channel).length}</strong>
            </div>
            <div className={`${cardStyles.card} ${cardStyles.compact}`}>
              <p className={cardStyles.description}>System Status</p>
              <strong>{scanners.filter(s => s.status === 'connected').length > 0 ? 'Active' : 'Idle'}</strong>
              <p className={cardStyles.description}>{scanners.filter(s => s.status === 'connected').length} scanners connected</p>
            </div>
          </div>

          <div className="rowWrap">
            <Button variant="primary" onClick={initScanners} disabled={loading}><Plus />{loading ? 'Initializing...' : 'Initialize Scanners'}</Button>
            <Button variant="danger" onClick={confirmClearScanners} disabled={loading}><Trash2 />{loading ? 'Clearing...' : 'Clear Inventory'}</Button>
            <Button variant="accent" onClick={restoreIds} disabled={loading}><RotateCw />{loading ? 'Restoring...' : 'Restore IDs'}</Button>
          </div>

          <div className={`${cardStyles.card} ${cardStyles.flush}`}>
            <div className={`${cardStyles.header} ${styles.tableHeader}`}>
              <h2 className={cardStyles.title}>Scanner Devices</h2>
              <span className="pill">{filteredScanners.length} devices</span>
            </div>
            <div className={tableStyles.scroll}>
              <table className={tableStyles.table}>
                <thead>
                  <tr>
                    <th className={tableStyles.header}>ID</th>
                    <th className={tableStyles.header}>Status</th>
                    <th className={tableStyles.header}>Channel</th>
                    <th className={tableStyles.header}>Volume</th>
                    <th className={tableStyles.header}>Squelch</th>
                    <th className={tableStyles.header}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="6" className={tableStyles.cell}><div className="centeredContent"><span className="spinner spinnerLarge" /><span>Loading scanners...</span></div></td></tr>
                  ) : filteredScanners.length > 0 ? (
                    filteredScanners.map((scanner) => (
                      <tr key={scanner.scannerId} className={tableStyles.rowInteractive}>
                        <td className={tableStyles.cell}>{scanner.scannerId}</td>
                        <td className={tableStyles.cell}><span className={`pill ${getStatusClass(scanner.status)}`}>{scanner.status.charAt(0).toUpperCase() + scanner.status.slice(1)}</span></td>
                        <td className={tableStyles.cell}>
                          <div className="row">
                            {scanner.channel ? <><Lock size={16} /><span>Ch #{scanner.channel}</span><span className={tableStyles.cellMuted}>({getChannelName(scanner.channel)})</span></> : <><Unlock size={16} /><span className={tableStyles.cellMuted}>Not assigned</span></>}
                          </div>
                        </td>
                        <td className={tableStyles.cell}>
                          <div className="row"><Volume2 size={16} /><progress max="15" value={scanner.volume} /><span>{scanner.volume}</span></div>
                        </td>
                        <td className={tableStyles.cell}>
                          <div className="row"><progress max="10" value={scanner.squelch} /><span>{scanner.squelch}</span></div>
                        </td>
                        <td className={tableStyles.cell}>
                          <div className="rowWrap">
                            <Button size="small" variant="accent" onClick={() => parkScanner(scanner.scannerId)} title="Identify this scanner"><Radio />Identify</Button>
                            <Button size="icon" variant="ghost" onClick={() => openModal('edit', scanner)} aria-label={`Edit ${scanner.scannerId}`} title="Edit configuration"><Edit2 /></Button>
                            <Button size="icon" variant="ghost" onClick={() => { const newId = `SCANNER_${Math.floor(Math.random() * 1000)}`; reassignScanner(scanner.scannerId, newId); }} aria-label={`Reassign ${scanner.scannerId}`} title="Reassign scanner ID"><RotateCw /></Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="6" className={tableStyles.cell}><div className="centeredContent"><Search size={28} /><p>No scanners found</p>{searchTerm && <Button size="small" variant="ghost" onClick={() => setSearchTerm('')}>Clear search</Button>}</div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* moden ui  */}
      {activeTab === 'channels' && (
        <div className={`${cardStyles.card} ${cardStyles.flush}`}>
          <div className={styles.mapHeader}>
            <h2 className={cardStyles.title}><CircuitBoard size={24} />Scanner Connection Map</h2>
          </div>
          {/* Decorative background elements */}
          <div className={styles.connectionMap}>
            {scanners.map((scanner) => {
              const assignedChannel = channels.find(channel => channel.id.toString() === scanner.channel);
              const isConnected = scanner.status === 'connected';
              // Disconnected wire
              return (
                <div key={scanner.scannerId} className={`${styles.connectionRow} ${isConnected && assignedChannel ? styles.connectionRowActive : ''}`}>
                  {/* Left Side: Scanner Device */}
                  <div className={`${styles.endpoint} ${styles.scannerEndpoint}`}>
                    {/* Decorative device background */}
                    <div className="row"><SmartphoneNfc size={24} /><strong>{scanner.scannerId}</strong></div>
                    <p className={cardStyles.description}>{scanner.model || 'Scanner'} · {scanner.port || 'No port'}</p>
                    <span className={`pill ${isConnected ? 'pillSuccess' : 'pillDanger'}`}>{isConnected ? 'Connected' : 'Disconnected'}</span>
                    {/* Connection port indicator on right side of scanner */}
                    <span className={styles.portIndicator} aria-hidden="true" />
                  </div>

                  {/* Middle: Connection Path */}
                  <div className={styles.connectionPath}>
                    {/* Base connection path */}
                    <div className={styles.connector} aria-hidden="true">
                      {/* Connected wire */}
                      {isConnected && assignedChannel && <span className={styles.connectedWire} />}
                      {/* Data flow animations */}
                      {isConnected && assignedChannel && <span className={styles.dataPulse} />}
                      {/* Wire connectors/joints */}
                      <span className={styles.jointStart} />
                      <span className={styles.jointEnd} />
                      {/* Disconnected wire */}
                      {!isConnected && <span className={styles.disconnectedWire} />}
                    </div>
                    {/* Gradient definitions */}
                    {/* Connection status label */}
                    <span className={`pill ${isConnected && assignedChannel ? 'pillSuccess' : 'pill'}`}>
                      {isConnected && assignedChannel ? 'Linked' : 'Unlinked'}
                    </span>
                  </div>

                  {/* Right Side: Channel */}
                  <div className={`${styles.endpoint} ${styles.channelEndpoint}`}>
                    {/* Connection port indicator on left side of channel */}
                    <span className={styles.portIndicator} aria-hidden="true" />
                    {assignedChannel ? (
                      <>
                        {/* Channel identifier */}
                        <div className="row"><Cable size={20} /><strong>#{assignedChannel.id} {assignedChannel.name}</strong></div>
                        {/* Channel status */}
                        <span className="pill pillAccent">Active</span>
                        {/* Subtle background */}
                      </>
                    ) : (
                      <div className="centeredContent"><Cable size={20} /><span>No Channel Connected</span></div>
                    )}
                  </div>

                  {/* Enhanced Background Glow Effect */}
                </div>
              );
            })}
          </div>

          {/* Unassigned channels */}
          {channels.filter(channel => !scanners.some(scanner => scanner.channel === channel.id.toString())).length > 0 && (
            <div className={`${styles.availableChannels} stack`}>
              <h3>Available Channels</h3>
              <div className="gridThree">
                {channels.filter(channel => !scanners.some(scanner => scanner.channel === channel.id.toString())).map(channel => (
                  <div key={channel.id} className={`${cardStyles.card} ${cardStyles.compact}`}>
                    <div className="row"><InboxIcon size={16} /><strong>#{channel.id} {channel.name}</strong></div>
                    <p className={cardStyles.description}>Available for Connection</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className={`${cardStyles.card} stack`}>
          <h2 className={cardStyles.title}>Scanner Settings</h2>
          <div className="gridTwo">
            <div className={`${cardStyles.card} ${cardStyles.compact} stack`}>
              <h3 className={cardStyles.title}><Settings size={20} />System Configuration</h3>
              <label className={formStyles.field}>
                <span className={formStyles.label}>Default Volume</span>
                <div className="row"><Volume2 size={16} /><input type="range" min="0" max="15" value="10" readOnly className={formStyles.range} /><span>10</span></div>
              </label>
              <label className={formStyles.field}>
                <span className={formStyles.label}>Default Squelch</span>
                <div className="row"><Volume2 size={16} /><input type="range" min="0" max="10" value="5" readOnly className={formStyles.range} /><span>5</span></div>
              </label>
            </div>
            <div className={`${cardStyles.card} ${cardStyles.compact} stack`}>
              <h3 className={cardStyles.title}><Info size={20} />System Information</h3>
              <div className="rowBetween"><span>Version</span><span>2.4.1</span></div>
              <div className="rowBetween"><span>Last Updated</span><span>Today at 10:45 AM</span></div>
              <div className="rowBetween"><span>Uptime</span><span>3 days, 7 hours</span></div>
              <div className="rowBetween"><span>Scanner Protocol</span><span>RS232 / USB</span></div>
              <div className="rowBetween"><span>Status</span><span className="pill pillSuccess">Operational</span></div>
            </div>
          </div>
        </div>
      )}

      {notification.show && (
        <div className={styles.notification}>
          <div className={`${noticeStyles.notice} ${notification.type === 'success' ? noticeStyles.success : noticeStyles.error}`}>
            {notification.type === 'success' ? <Check size={20} /> : <AlertTriangle size={20} />}
            <div className={`${noticeStyles.body} grow`}><p>{notification.message}</p></div>
            <Button size="icon" variant="ghost" onClick={() => setNotification({ ...notification, show: false })} aria-label="Dismiss notification"><X /></Button>
          </div>
        </div>
      )}

      {isModalOpen && (
        <dialog ref={scannerDialogRef} className={modalStyles.dialog}>
          <div className={modalStyles.header}>
            <h2 className={modalStyles.title}>{modalMode === 'edit' ? 'Edit Scanner Configuration' : 'Create Scanner'}</h2>
            <Button size="icon" variant="ghost" onClick={() => setIsModalOpen(false)} aria-label="Close"><X /></Button>
          </div>
          <form onSubmit={handleSubmit} className={`${modalStyles.body} ${formStyles.form}`}>
            <label className={formStyles.field}><span className={formStyles.label}>Scanner ID</span><input type="text" name="id" value={formData.id} onChange={handleInputChange} className={formStyles.input} /></label>
            <label className={formStyles.field}><span className={formStyles.label}>Assign Channel</span><select name="channel" value={formData.channel} onChange={handleInputChange} className={formStyles.select}><option value="">None</option>{getAvailableChannels().map(channel => <option key={channel.id} value={channel.id} disabled={channel.isLinked && formData.channel !== channel.id.toString()}>Channel #{channel.id} - {channel.name} {channel.isLinked && channel.id.toString() !== formData.channel ? '(In Use)' : ''}</option>)}</select></label>
            <label className={formStyles.field}><span className="rowBetween"><span className={formStyles.label}>Volume</span><span>{formData.volume}</span></span><input type="range" name="volume" min="0" max="15" value={formData.volume} onChange={handleInputChange} className={formStyles.range} /></label>
            <label className={formStyles.field}><span className="rowBetween"><span className={formStyles.label}>Squelch</span><span>{formData.squelch}</span></span><input type="range" name="squelch" min="0" max="10" value={formData.squelch} onChange={handleInputChange} className={formStyles.range} /></label>
            <div className={modalStyles.actions}><Button type="button" onClick={() => setIsModalOpen(false)}>Cancel</Button><Button type="submit" variant="primary">Save Changes</Button></div>
          </form>
        </dialog>
      )}

      {confirmDialog.show && (
        <dialog ref={confirmDialogRef} className={modalStyles.dialog}>
          <div className={`${modalStyles.body} stack`}>
            <AlertTriangle size={36} />
            <h3 className={modalStyles.title}>{confirmDialog.title}</h3>
            <p>{confirmDialog.message}</p>
            <div className={modalStyles.actions}>
              <Button onClick={() => setConfirmDialog({ ...confirmDialog, show: false })}>Cancel</Button>
              <Button variant="danger" onClick={confirmDialog.onConfirm}>Confirm</Button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );

};

export default ScannerTable;