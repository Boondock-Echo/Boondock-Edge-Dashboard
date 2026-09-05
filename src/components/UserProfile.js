import api from '../utils/apiClient';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { User, Shield, Smartphone, Clock, Trash2, Check, X, ArrowLeft, Key, Unlock } from 'lucide-react';

const UserProfile = ({ isDarkMode }) => {
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

  const themeClasses = {
    bg: isDarkMode ? 'bg-gray-900' : 'bg-gray-50',
    card: isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textSecondary: isDarkMode ? 'text-gray-400' : 'text-gray-600',
    input: isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900',
    button: isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700',
    buttonDanger: isDarkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-600 hover:bg-red-700'
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${themeClasses.bg} flex items-center justify-center`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themeClasses.bg} p-6`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/')}
            className={`p-2 rounded-lg ${themeClasses.card} hover:opacity-80 transition-opacity`}
          >
            <ArrowLeft className={`w-5 h-5 ${themeClasses.text}`} />
          </button>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-full ${themeClasses.card}`}>
              <User className={`w-6 h-6 ${themeClasses.text}`} />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${themeClasses.text}`}>User Profile</h1>
              <p className={themeClasses.textSecondary}>{user?.name || user?.username}</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className={`mb-4 p-4 rounded-lg bg-red-100 border border-red-400 text-red-700 ${isDarkMode ? 'bg-red-900/20 border-red-600 text-red-400' : ''}`}>
            {typeof error === 'string' ? error : (error?.message || String(error))}
          </div>
        )}
        {success && (
          <div className={`mb-4 p-4 rounded-lg bg-green-100 border border-green-400 text-green-700 ${isDarkMode ? 'bg-green-900/20 border-green-600 text-green-400' : ''}`}>
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* MFA Section */}
          <div className={`${themeClasses.card} border rounded-lg p-6`}>
            <div className="flex items-center gap-3 mb-4">
              <Shield className={`w-5 h-5 ${themeClasses.text}`} />
              <h2 className={`text-xl font-semibold ${themeClasses.text}`}>Multi-Factor Authentication</h2>
            </div>

            <div className="mb-4 space-y-2">
              <div className={`flex items-center gap-2 ${themeClasses.textSecondary}`}>
                Status: 
                {mfaStatus.mfa_enabled ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <Check className="w-4 h-4" /> Enabled
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-gray-500">
                    <X className="w-4 h-4" /> Disabled
                  </span>
                )}
              </div>
              {mfaStatus.mfa_enforced && (
                <div className={`flex items-center gap-2 text-sm ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                  <Shield className="w-4 h-4" />
                  <span>MFA is required by administrator</span>
                </div>
              )}
            </div>

            {!showMfaSetup && !mfaStatus.mfa_enabled && (
              <button
                onClick={handleMfaSetup}
                className={`${themeClasses.button} text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors`}
              >
                <Key className="w-4 h-4" />
                Enable MFA
              </button>
            )}

            {showMfaSetup && mfaSetup && (
              <div className="space-y-4">
                <div>
                  <p className={`${themeClasses.textSecondary} mb-2`}>
                    Scan this QR code with your authenticator app (Google Authenticator, Microsoft Authenticator, etc.):
                  </p>
                  <div className="flex justify-center p-4 bg-white rounded-lg">
                    <img src={mfaSetup.qr_code} alt="MFA QR Code" className="max-w-xs" />
                  </div>
                  <p className={`${themeClasses.textSecondary} text-xs mt-2 text-center`}>
                    Or enter this code manually: <code className="bg-gray-100 px-2 py-1 rounded">{mfaSetup.secret}</code>
                  </p>
                </div>
                <div>
                  <label className={`block ${themeClasses.textSecondary} mb-2`}>
                    Enter 6-digit code from your app:
                  </label>
                  <input
                    type="text"
                    maxLength="6"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    className={`${themeClasses.input} w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    placeholder="000000"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleVerifySetup}
                    disabled={verifying || totpCode.length !== 6}
                    className={`${themeClasses.button} text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50`}
                  >
                    {verifying ? 'Verifying...' : 'Verify & Enable'}
                  </button>
                  <button
                    onClick={() => {
                      setShowMfaSetup(false);
                      setMfaSetup(null);
                      setTotpCode('');
                    }}
                    className={`${themeClasses.card} ${themeClasses.text} px-4 py-2 rounded-lg border transition-colors`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {mfaStatus.mfa_enabled && !showMfaSetup && (
              <div className="space-y-4">
                <div>
                  <label className={`block ${themeClasses.textSecondary} mb-2`}>
                    Password:
                  </label>
                  <input
                    type="password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    className={`${themeClasses.input} w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    placeholder="Enter your password"
                  />
                </div>
                <div>
                  <label className={`block ${themeClasses.textSecondary} mb-2`}>
                    TOTP Code:
                  </label>
                  <input
                    type="text"
                    maxLength="6"
                    value={disableTotp}
                    onChange={(e) => setDisableTotp(e.target.value.replace(/\D/g, ''))}
                    className={`${themeClasses.input} w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    placeholder="000000"
                  />
                </div>
                <button
                  onClick={handleDisableMfa}
                  disabled={disabling || !disablePassword || !disableTotp}
                  className={`${themeClasses.buttonDanger} text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50`}
                >
                  <Unlock className="w-4 h-4" />
                  {disabling ? 'Disabling...' : 'Disable MFA'}
                </button>
              </div>
            )}
          </div>

          {/* Devices Section */}
          <div className={`${themeClasses.card} border rounded-lg p-6`}>
            <div className="flex items-center gap-3 mb-4">
              <Smartphone className={`w-5 h-5 ${themeClasses.text}`} />
              <h2 className={`text-xl font-semibold ${themeClasses.text}`}>Authorized Devices</h2>
            </div>

            {devices.length === 0 ? (
              <p className={themeClasses.textSecondary}>No devices registered</p>
            ) : (
              <div className="space-y-3">
                {devices.map((device, index) => (
                  <div key={device.device_id || index} className={`${themeClasses.card} border rounded-lg p-4`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className={`font-medium ${themeClasses.text}`}>
                          {device.name || `Device ${index + 1}`}
                        </p>
                        <p className={`text-sm ${themeClasses.textSecondary} mt-1`}>
                          {device.user_agent || 'Unknown device'}
                        </p>
                        <p className={`text-xs ${themeClasses.textSecondary} mt-1`}>
                          IP: {device.ip_address || 'Unknown'} | 
                          Last seen: {formatDate(device.last_seen)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveDevice(device.device_id)}
                        className={`p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-red-900/20' : ''}`}
                        title="Remove device"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Login History */}
        <div className={`${themeClasses.card} border rounded-lg p-6 mt-6`}>
          <div className="flex items-center gap-3 mb-4">
            <Clock className={`w-5 h-5 ${themeClasses.text}`} />
            <h2 className={`text-xl font-semibold ${themeClasses.text}`}>Login History</h2>
          </div>

          {loginHistory.length === 0 ? (
            <p className={themeClasses.textSecondary}>No login history available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <th className={`text-left py-3 px-4 ${themeClasses.textSecondary} font-medium`}>Date & Time</th>
                    <th className={`text-left py-3 px-4 ${themeClasses.textSecondary} font-medium`}>IP Address</th>
                    <th className={`text-left py-3 px-4 ${themeClasses.textSecondary} font-medium`}>User Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {loginHistory.slice(0, 20).map((login, index) => (
                    <tr key={index} className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                      <td className={`py-3 px-4 ${themeClasses.text}`}>{formatDate(login.timestamp)}</td>
                      <td className={`py-3 px-4 ${themeClasses.textSecondary}`}>{login.ip_address || 'Unknown'}</td>
                      <td className={`py-3 px-4 ${themeClasses.textSecondary} text-sm`}>
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
    </div>
  );
};

export default UserProfile;
