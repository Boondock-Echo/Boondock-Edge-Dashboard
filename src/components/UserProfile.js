import api from '../utils/apiClient';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { User, Shield, Smartphone, Clock, Trash2, Check, X, ArrowLeft, Key, Unlock } from 'lucide-react';
import Button from './ui/Button';
import { Spinner } from './ui/Spinner';
import styles from './ui/Page.module.css';

const UserProfile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mfaStatus, setMfaStatus] = useState({ mfa_enabled: false, has_secret: false });
  const [devices, setDevices] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mfaSetup, setMfaSetup] = useState(null);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableTotp, setDisableTotp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const [{ data: mfaData }, { data: devicesData }] = await Promise.all([
        api.get('/mfa/status'),
        api.get(`/users/${user?.username}/devices`),
      ]);
      setMfaStatus(mfaData);
      setDevices(devicesData.devices || []);
      setLoginHistory(devicesData.login_history || []);
    } catch (err) {
      console.error('Error fetching profile data:', err);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSetup = async () => {
    try {
      setError('');
      const { data } = await api.post('/mfa/setup');
      setMfaSetup(data);
      setShowMfaSetup(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to setup MFA');
      console.error('MFA setup error:', err);
    }
  };

  const handleVerifySetup = async () => {
    if (!totpCode || totpCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    try {
      setVerifying(true);
      setError('');
      await api.post('/mfa/verify-setup', { totp_code: totpCode });
      setSuccess('MFA enabled successfully!');
      setShowMfaSetup(false);
      setMfaSetup(null);
      setTotpCode('');
      fetchProfileData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to verify MFA setup');
      console.error('MFA verify error:', err);
    } finally {
      setVerifying(false);
    }
  };

  const handleDisableMfa = async () => {
    if (!disablePassword) {
      setError('Password is required');
      return;
    }
    if (mfaStatus.mfa_enabled && !disableTotp) {
      setError('TOTP code is required to disable MFA');
      return;
    }

    try {
      setDisabling(true);
      setError('');
      await api.post('/mfa/disable', {
        password: disablePassword,
        totp_code: disableTotp,
      });
      setSuccess('MFA disabled successfully');
      setDisablePassword('');
      setDisableTotp('');
      fetchProfileData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to disable MFA');
      console.error('MFA disable error:', err);
    } finally {
      setDisabling(false);
    }
  };

  const handleRemoveDevice = async (deviceId) => {
    if (!window.confirm('Are you sure you want to remove this device?')) return;

    try {
      await api.delete(`/users/${user?.username}/devices/${deviceId}`);
      setSuccess('Device removed successfully');
      fetchProfileData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove device');
      console.error('Remove device error:', err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };



  if (loading) {
    return (
      <div className={styles.centered}>
        <Spinner size="large" label="Loading profile" />
      </div>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.contentWide}>
        {/* Header */}
        <div className={styles.header}>
          <Button size="icon" onClick={() => navigate('/')} aria-label="Back to dashboard">
            <ArrowLeft className={styles.icon} />
          </Button>
          <div className={styles.row}>
            <div className={styles.iconCircle}>
              <User className={styles.iconLarge} />
            </div>
            <div>
              <h1 className={styles.title}>User Profile</h1>
              <p className={styles.muted}>{user?.name || user?.username}</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className={styles.noticeError}>
            {typeof error === 'string' ? error : (error?.message || String(error))}
          </div>
        )}
        {success && (
          <div className={styles.noticeSuccess}>
            {success}
          </div>
        )}

        <div className={styles.gridTwo}>
          {/* MFA Section */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <Shield className={styles.icon} />
              <h2 className={styles.cardTitleText}>Multi-Factor Authentication</h2>
            </div>

            <div className={styles.section}>
              <div className={styles.rowMuted}>
                Status: 
                {mfaStatus.mfa_enabled ? (
                  <span className={styles.statusSuccess}>
                    <Check className={styles.iconSmall} /> Enabled
                  </span>
                ) : (
                  <span className={styles.statusMuted}>
                    <X className={styles.iconSmall} /> Disabled
                  </span>
                )}
              </div>
              {mfaStatus.mfa_enforced && (
                <div className={styles.statusWarning}>
                  <Shield className={styles.iconSmall} />
                  <span>MFA is required by administrator</span>
                </div>
              )}
            </div>

            {!showMfaSetup && !mfaStatus.mfa_enabled && (
              <Button onClick={handleMfaSetup}>
                <Key className={styles.iconSmall} />
                Enable MFA
              </Button>
            )}

            {showMfaSetup && mfaSetup && (
              <div className={styles.stack}>
                <div>
                  <p className={styles.description}>
                    Scan this QR code with your authenticator app (Google Authenticator, Microsoft Authenticator, etc.):
                  </p>
                  <div className={styles.qrFrame}>
                    <img src={mfaSetup.qr_code} alt="MFA QR Code" className={styles.qrCode} />
                  </div>
                  <p className={styles.helpText}>
                    Or enter this code manually: <code className={styles.code}>{mfaSetup.secret}</code>
                  </p>
                </div>
                <div>
                  <label className={styles.label}>
                    Enter 6-digit code from your app:
                  </label>
                  <input
                    type="text"
                    maxLength="6"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    className={styles.input}
                    placeholder="000000"
                  />
                </div>
                <div className={styles.actions}>
                  <Button
                    onClick={handleVerifySetup}
                    disabled={verifying || totpCode.length !== 6}
                  >
                    {verifying ? 'Verifying...' : 'Verify & Enable'}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowMfaSetup(false);
                      setMfaSetup(null);
                      setTotpCode('');
                    }}
                    variant="secondary"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {mfaStatus.mfa_enabled && !showMfaSetup && (
              <div className={styles.stack}>
                <div>
                  <label className={styles.label}>
                    Password:
                  </label>
                  <input
                    type="password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    className={styles.input}
                    placeholder="Enter your password"
                  />
                </div>
                <div>
                  <label className={styles.label}>
                    TOTP Code:
                  </label>
                  <input
                    type="text"
                    maxLength="6"
                    value={disableTotp}
                    onChange={(e) => setDisableTotp(e.target.value.replace(/\D/g, ''))}
                    className={styles.input}
                    placeholder="000000"
                  />
                </div>
                <Button
                  onClick={handleDisableMfa}
                  disabled={disabling || !disablePassword || !disableTotp}
                  variant="danger"
                >
                  <Unlock className={styles.iconSmall} />
                  {disabling ? 'Disabling...' : 'Disable MFA'}
                </Button>
              </div>
            )}
          </div>

          {/* Devices Section */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <Smartphone className={styles.icon} />
              <h2 className={styles.cardTitleText}>Authorized Devices</h2>
            </div>

            {devices.length === 0 ? (
              <p className={styles.muted}>No devices registered</p>
            ) : (
              <div className={styles.list}>
                {devices.map((device, index) => (
                  <div key={device.device_id || index} className={styles.listItem}>
                    <div className={styles.listItemRow}>
                      <div className={styles.grow}>
                        <p className={styles.itemTitle}>
                          {device.name || `Device ${index + 1}`}
                        </p>
                        <p className={styles.itemMeta}>
                          {device.user_agent || 'Unknown device'}
                        </p>
                        <p className={styles.itemMetaSmall}>
                          IP: {device.ip_address || 'Unknown'} | 
                          Last seen: {formatDate(device.last_seen)}
                        </p>
                      </div>
                      <Button
                        onClick={() => handleRemoveDevice(device.device_id)}
                        variant="danger"
                        size="icon"
                        title="Remove device"
                      >
                        <Trash2 className={styles.iconSmall} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Login History */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <Clock className={styles.icon} />
            <h2 className={styles.cardTitleText}>Login History</h2>
          </div>

          {loginHistory.length === 0 ? (
            <p className={styles.muted}>No login history available</p>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr className={styles.tableRow}>
                    <th className={styles.tableHeader}>Date & Time</th>
                    <th className={styles.tableHeader}>IP Address</th>
                    <th className={styles.tableHeader}>User Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {loginHistory.slice(0, 20).map((login, index) => (
                    <tr key={index} className={styles.tableRow}>
                      <td className={styles.tableCell}>{formatDate(login.timestamp)}</td>
                      <td className={styles.tableCellMuted}>{login.ip_address || 'Unknown'}</td>
                      <td className={styles.tableCellMuted}>
                        {login.user_agent || 'Unknown'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default UserProfile;
