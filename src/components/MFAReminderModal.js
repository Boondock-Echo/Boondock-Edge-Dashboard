import { apiFetch } from '../utils/apiClient';
import { useState } from 'react';
import { Shield, X, Check } from 'lucide-react';

const MFAReminderModal = ({ isOpen, onClose, onSetup, isDarkMode, user }) => {
  const [mfaSetup, setMfaSetup] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  if (!isOpen) return null;

  const handleStartSetup = async () => {
    try {
      setError('');
      const token = localStorage.getItem('token');
      const response = await apiFetch(`/mfa/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMfaSetup(data);
        setShowSetup(true);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to setup MFA');
      }
    } catch (err) {
      setError('Failed to setup MFA');
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
      const token = localStorage.getItem('token');
      const response = await apiFetch(`/mfa/verify-setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ totp_code: totpCode })
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          onSetup();
          onClose();
        }, 2000);
      } else {
        const data = await response.json();
        setError(data.error || 'Invalid code. Please try again.');
      }
    } catch (err) {
      setError('Failed to verify MFA setup');
      console.error('MFA verify error:', err);
    } finally {
      setVerifying(false);
    }
  };

  const themeClasses = {
    bg: isDarkMode ? 'bg-gray-900' : 'bg-white',
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textSecondary: isDarkMode ? 'text-gray-400' : 'text-gray-600',
    border: isDarkMode ? 'border-gray-700' : 'border-gray-200',
    input: isDarkMode ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900',
    button: isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700',
    buttonSecondary: isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className={`${themeClasses.bg} rounded-lg shadow-xl max-w-md w-full mx-4 ${themeClasses.border} border-2`}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
                <Shield className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
              </div>
              <h2 className={`text-xl font-semibold ${themeClasses.text}`}>
                MFA Setup Required
              </h2>
            </div>
            <button
              onClick={onClose}
              className={`p-1 rounded-lg ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'} transition-colors`}
            >
              <X className={`w-5 h-5 ${themeClasses.textSecondary}`} />
            </button>
          </div>

          {!showSetup && !success && (
            <>
              <p className={`${themeClasses.textSecondary} mb-6`}>
                Your administrator has required Multi-Factor Authentication (MFA) for your account. 
                Please set up MFA to secure your account.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleStartSetup}
                  className={`${themeClasses.button} text-white px-4 py-2 rounded-lg flex-1 transition-colors`}
                >
                  Set Up MFA
                </button>
                <button
                  onClick={onClose}
                  className={`${themeClasses.buttonSecondary} ${themeClasses.text} px-4 py-2 rounded-lg transition-colors`}
                >
                  Remind Me Later
                </button>
              </div>
            </>
          )}

          {showSetup && mfaSetup && !success && (
            <div className="space-y-4">
              <p className={`${themeClasses.textSecondary} text-sm`}>
                Scan this QR code with your authenticator app (Google Authenticator, Microsoft Authenticator, etc.):
              </p>
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img src={mfaSetup.qr_code} alt="MFA QR Code" className="max-w-xs" />
              </div>
              <p className={`${themeClasses.textSecondary} text-xs text-center`}>
                Or enter this code manually: <code className={`${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} px-2 py-1 rounded`}>{mfaSetup.secret}</code>
              </p>
              <div>
                <label className={`block ${themeClasses.textSecondary} mb-2 text-sm`}>
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
              {error && (
                <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-red-900/20 text-red-400' : 'bg-red-100 text-red-700'}`}>
                  {error}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={handleVerifySetup}
                  disabled={verifying || totpCode.length !== 6}
                  className={`${themeClasses.button} text-white px-4 py-2 rounded-lg flex-1 transition-colors disabled:opacity-50`}
                >
                  {verifying ? 'Verifying...' : 'Verify & Enable'}
                </button>
                <button
                  onClick={() => {
                    setShowSetup(false);
                    setMfaSetup(null);
                    setTotpCode('');
                    setError('');
                  }}
                  className={`${themeClasses.buttonSecondary} ${themeClasses.text} px-4 py-2 rounded-lg transition-colors`}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {success && (
            <div className="text-center py-4">
              <div className="flex justify-center mb-4">
                <div className={`p-3 rounded-full ${isDarkMode ? 'bg-green-900/30' : 'bg-green-100'}`}>
                  <Check className={`w-8 h-8 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
                </div>
              </div>
              <p className={`${themeClasses.text} font-semibold mb-2`}>MFA Enabled Successfully!</p>
              <p className={`${themeClasses.textSecondary} text-sm`}>Your account is now secured with MFA.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MFAReminderModal;

