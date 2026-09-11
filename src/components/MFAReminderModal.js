import { apiFetch } from '../utils/apiClient';
import { useEffect, useRef, useState } from 'react';
import { Shield, X, Check } from 'lucide-react';
import Button from './ui/Button';
import formStyles from './ui/Form.module.css';
import modalStyles from './ui/Modal.module.css';
import noticeStyles from './ui/Notice.module.css';

const MFAReminderModal = ({ isOpen, onClose, onSetup, user }) => {
  const dialogRef = useRef(null);
  const [mfaSetup, setMfaSetup] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

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

  return (
    <dialog ref={dialogRef} className={modalStyles.dialog} onCancel={onClose}>
      {/* Header */}
      <div className={modalStyles.header}>
        <div className="row">
          <span className="pill pillAccent">
            <Shield size={20} />
          </span>
          <h2 className={modalStyles.title}>MFA Setup Required</h2>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close MFA reminder">
          <X size={20} />
        </Button>
      </div>

      <div className={modalStyles.body}>
        {!showSetup && !success && (
          <div className="stack">
            <p>
              Your administrator has required Multi-Factor Authentication (MFA) for your account.
              Please set up MFA to secure your account.
            </p>
            <div className="rowWrap">
              <Button variant="primary" onClick={handleStartSetup}>Set Up MFA</Button>
              <Button onClick={onClose}>Remind Me Later</Button>
            </div>
          </div>
        )}

        {showSetup && mfaSetup && !success && (
          <div className="stack">
            <p>
              Scan this QR code with your authenticator app (Google Authenticator, Microsoft Authenticator, etc.):
            </p>
            <div className="qrFrame">
              <img src={mfaSetup.qr_code} alt="MFA QR Code" className="qrCode" />
            </div>
            <p className={formStyles.helpText}>
              Or enter this code manually: <code>{mfaSetup.secret}</code>
            </p>
            <div className={formStyles.field}>
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
            {error && (
              <div className={`${noticeStyles.notice} ${noticeStyles.error}`}>
                <div className={noticeStyles.body}>{error}</div>
              </div>
            )}
            <div className="rowWrap">
              <Button
                variant="primary"
                onClick={handleVerifySetup}
                disabled={verifying || totpCode.length !== 6}
              >
                {verifying ? 'Verifying...' : 'Verify & Enable'}
              </Button>
              <Button
                onClick={() => {
                  setShowSetup(false);
                  setMfaSetup(null);
                  setTotpCode('');
                  setError('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {success && (
          <div className="centeredContent stackCompact">
            <span className="pill pillSuccess"><Check size={24} /></span>
            <p><strong>MFA Enabled Successfully!</strong></p>
            <p>Your account is now secured with MFA.</p>
          </div>
        )}
      </div>
    </dialog>
  );
};

export default MFAReminderModal;
