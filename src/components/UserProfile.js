import api from '../utils/apiClient';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { User, Shield, Smartphone, Clock, Trash2, Check, X, ArrowLeft, Key, Unlock } from 'lucide-react';
import Button from './ui/Button';
import pageStyles from './ui/Page.module.css';
import cardStyles from './ui/Card.module.css';
import formStyles from './ui/Form.module.css';
import listStyles from './ui/List.module.css';
import noticeStyles from './ui/Notice.module.css';
import tableStyles from './ui/Table.module.css';

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
      <div className={pageStyles.centered}>
        <span className="spinner spinnerLarge" role="status" aria-label="Loading profile" />
      </div>
    );
  }

  return (
    <main className={pageStyles.page}>
      <div className={`${pageStyles.contentWide} stack`}>
        {/* Header */}
        <div className={pageStyles.header}>
          <Button size="icon" onClick={() => navigate('/')} aria-label="Back to dashboard">
            <ArrowLeft size={20} />
          </Button>
          <div className="row">
            <div className={pageStyles.headerIcon}>
              <User size={24} />
            </div>
            <div>
              <h1 className={pageStyles.title}>User Profile</h1>
              <p className={cardStyles.description}>{user?.name || user?.username}</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className={`${noticeStyles.notice} ${noticeStyles.error}`}>
            {typeof error === 'string' ? error : (error?.message || String(error))}
          </div>
        )}
        {success && (
          <div className={`${noticeStyles.notice} ${noticeStyles.success}`}>
            {success}
          </div>
        )}

        <div className="gridTwo">
          {/* MFA Section */}
          <div className={`${cardStyles.card} stack`}>
            <h2 className={cardStyles.title}>
              <Shield size={20} />
              Multi-Factor Authentication
            </h2>

            <div className="stack stackCompact">
              <div className="row">
                Status: 
                {mfaStatus.mfa_enabled ? (
                  <span className="pill pillSuccess">
                    <Check size={16} /> Enabled
                  </span>
                ) : (
                  <span className="pill">
                    <X size={16} /> Disabled
                  </span>
                )}
              </div>
              {mfaStatus.mfa_enforced && (
                <div className="pill pillWarning">
                  <Shield size={16} />
                  <span>MFA is required by administrator</span>
                </div>
              )}
            </div>

            {!showMfaSetup && !mfaStatus.mfa_enabled && (
              <Button onClick={handleMfaSetup}>
                <Key size={16} />
                Enable MFA
              </Button>
            )}

            {showMfaSetup && mfaSetup && (
              <div className="stack">
                <div>
                  <p className={cardStyles.description}>
                    Scan this QR code with your authenticator app (Google Authenticator, Microsoft Authenticator, etc.):
                  </p>
                  <div className="qrFrame">
                    <img src={mfaSetup.qr_code} alt="MFA QR Code" className="qrCode" />
                  </div>
                  <p className={formStyles.helpText}>
                    Or enter this code manually: <code>{mfaSetup.secret}</code>
                  </p>
                </div>
                <div>
                  <label className={formStyles.label}>
                    Enter 6-digit code from your app:
                  </label>
                  <input
                    type="text"
                    maxLength="6"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    className={formStyles.input}
                    placeholder="000000"
                  />
                </div>
                <div className="rowWrap">
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
              <div className="stack">
                <div>
                  <label className={formStyles.label}>
                    Password:
                  </label>
                  <input
                    type="password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    className={formStyles.input}
                    placeholder="Enter your password"
                  />
                </div>
                <div>
                  <label className={formStyles.label}>
                    TOTP Code:
                  </label>
                  <input
                    type="text"
                    maxLength="6"
                    value={disableTotp}
                    onChange={(e) => setDisableTotp(e.target.value.replace(/\D/g, ''))}
                    className={formStyles.input}
                    placeholder="000000"
                  />
                </div>
                <Button
                  onClick={handleDisableMfa}
                  disabled={disabling || !disablePassword || !disableTotp}
                  variant="danger"
                >
                  <Unlock size={16} />
                  {disabling ? 'Disabling...' : 'Disable MFA'}
                </Button>
              </div>
            )}
          </div>

          {/* Devices Section */}
          <div className={`${cardStyles.card} stack`}>
            <h2 className={cardStyles.title}>
              <Smartphone size={20} />
              Authorized Devices
            </h2>

            {devices.length === 0 ? (
              <p className={cardStyles.description}>No devices registered</p>
            ) : (
              <div className={listStyles.list}>
                {devices.map((device, index) => (
                  <div key={device.device_id || index} className={listStyles.item}>
                    <div className="rowBetweenStart">
                      <div className="grow">
                        <p className={listStyles.title}>
                          {device.name || `Device ${index + 1}`}
                        </p>
                        <p className={listStyles.meta}>
                          {device.user_agent || 'Unknown device'}
                        </p>
                        <p className={listStyles.metaSmall}>
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
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Login History */}
        <div className={`${cardStyles.card} stack`}>
          <h2 className={cardStyles.title}>
            <Clock size={20} />
            Login History
          </h2>

          {loginHistory.length === 0 ? (
            <p className={cardStyles.description}>No login history available</p>
          ) : (
            <div className={tableStyles.scroll}>
              <table className={tableStyles.table}>
                <thead>
                  <tr className={tableStyles.row}>
                    <th className={tableStyles.header}>Date & Time</th>
                    <th className={tableStyles.header}>IP Address</th>
                    <th className={tableStyles.header}>User Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {loginHistory.slice(0, 20).map((login, index) => (
                    <tr key={index} className={tableStyles.row}>
                      <td className={tableStyles.cell}>{formatDate(login.timestamp)}</td>
                      <td className={tableStyles.cellMuted}>{login.ip_address || 'Unknown'}</td>
                      <td className={tableStyles.cellMuted}>
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
