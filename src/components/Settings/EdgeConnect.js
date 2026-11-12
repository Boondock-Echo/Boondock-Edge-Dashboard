import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Cloud, KeyRound, Link2, RefreshCw, Unplug } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../utils/apiClient';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import noticeStyles from '../ui/Notice.module.css';

const POLL_INTERVAL_MS = 2000;

const errorMessage = (requestError, fallback) => (
  requestError.response?.data?.error || requestError.message || fallback
);

/**
 * Connects this Edge to the Boondock portal. A successful connection stores the
 * portal API key as the transcription key, so transcription and keyword actions
 * work without pasting a key by hand.
 */
const EdgeConnect = ({ onChange }) => {
  const [status, setStatus] = useState(null);
  const [pendingId, setPendingId] = useState(null);
  const [portalUrl, setPortalUrl] = useState('');
  const [accountKey, setAccountKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pollTimer = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/boondock-cloud/status');
      setStatus(data);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Failed to load Edge Connect status'));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (!pendingId) return undefined;

    pollTimer.current = setInterval(async () => {
      try {
        const { data } = await api.get('/boondock-cloud/connect/status', {
          params: { connect_id: pendingId },
        });
        if (data.status === 'connected') {
          stopPolling();
          setPendingId(null);
          await refresh();
          toast.success('Edge connected to the portal');
          if (onChange) onChange();
        } else if (['expired', 'error', 'cancelled'].includes(data.status)) {
          stopPolling();
          setPendingId(null);
          setError(data.error || 'Connect did not complete. Try again.');
        }
      } catch (requestError) {
        stopPolling();
        setPendingId(null);
        setError(errorMessage(requestError, 'Lost track of the Connect session'));
      }
    }, POLL_INTERVAL_MS);

    return stopPolling;
  }, [pendingId, refresh, stopPolling, onChange]);

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/boondock-cloud/connect/start', {});
      if (!data.connect_id || !data.portal_url) {
        throw new Error('Invalid connect start response');
      }
      setPortalUrl(data.portal_url);
      setPendingId(data.connect_id);
      window.open(data.portal_url, '_blank', 'noopener,noreferrer');
    } catch (requestError) {
      setError(errorMessage(requestError, 'Failed to start Connect'));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    const connectId = pendingId;
    stopPolling();
    setPendingId(null);
    try {
      await api.post('/boondock-cloud/connect/cancel', { connect_id: connectId });
    } catch (requestError) {
      setError(errorMessage(requestError, 'Failed to cancel Connect'));
    }
  };

  const connectWithKey = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/boondock-cloud/connect/with-key', { key: accountKey.trim() });
      setAccountKey('');
      await refresh();
      toast.success('Edge connected with account key');
      if (onChange) onChange();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Failed to connect with account key'));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/boondock-cloud/disconnect', {});
      await refresh();
      toast.success('Edge disconnected from the portal');
      if (onChange) onChange();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Failed to disconnect'));
    } finally {
      setBusy(false);
    }
  };

  const sync = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/boondock-cloud/sync', {});
      toast.success('Device stats sent to the portal');
    } catch (requestError) {
      setError(errorMessage(requestError, 'Failed to sync with the portal'));
    } finally {
      setBusy(false);
    }
  };

  const connected = Boolean(status?.connected);

  return (
    <div className={`${cardStyles.card} stack`}>
      <div className="row">
        <Cloud size={18} />
        <strong>Edge Connect</strong>
      </div>
      <p className="smallText mutedText">
        Link this Edge to your Boondock portal account. The portal issues the API key used for
        transcription, so keyword actions run on the results without pasting a key.
      </p>

      {error ? (
        <div className={`${noticeStyles.notice} ${noticeStyles.error}`}>
          <div className={noticeStyles.body}><p>{error}</p></div>
        </div>
      ) : null}

      {connected ? (
        <>
          <div className={`${noticeStyles.notice} ${noticeStyles.success}`}>
            <div className={noticeStyles.body}>
              <p>
                Connected{status.key_prefix ? ` — key ${status.key_prefix}…` : ''}
                {status.device_id ? ` · device ${status.device_id.slice(0, 8)}` : ''}
              </p>
            </div>
          </div>
          <div className="actionsEnd">
            <Button variant="secondary" onClick={sync} disabled={busy}>
              <RefreshCw size={18} />
              Sync now
            </Button>
            <Button variant="danger" onClick={disconnect} disabled={busy}>
              <Unplug size={18} />
              Disconnect
            </Button>
          </div>
        </>
      ) : pendingId ? (
        <>
          <div className={`${noticeStyles.notice} ${noticeStyles.info}`}>
            <div className={noticeStyles.body}>
              <p>
                Waiting for approval in the portal.{' '}
                <a href={portalUrl} target="_blank" rel="noopener noreferrer">Open the portal page</a>
                {' '}if it did not open.
              </p>
            </div>
          </div>
          <div className="actionsEnd">
            <Button variant="secondary" onClick={cancel}>Cancel</Button>
          </div>
        </>
      ) : (
        <>
          <div className="actionsEnd">
            <Button variant="primary" onClick={start} disabled={busy}>
              <Link2 size={18} />
              Connect to portal
            </Button>
          </div>

          <label className={formStyles.label} htmlFor="edge-connect-account-key">
            <span className="row"><KeyRound size={16} />Or use an account installation key</span>
          </label>
          <input
            id="edge-connect-account-key"
            type="password"
            className={formStyles.input}
            value={accountKey}
            onChange={(event) => setAccountKey(event.target.value)}
            placeholder="bdi_..."
            autoComplete="off"
          />
          <div className="actionsEnd">
            <Button variant="secondary" onClick={connectWithKey} disabled={busy || !accountKey.trim()}>
              Connect with key
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default EdgeConnect;
