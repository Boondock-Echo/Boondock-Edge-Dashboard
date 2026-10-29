import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { API_BASE_URL } from '../utils/apiClient';
import { useAuth } from './AuthContext';
import { usePermissions } from './hooks/usePermissions';
import InlineAudioPlayer from './InlineAudioPlayer';
import cardStyles from './ui/Card.module.css';

/** Authenticated destination for recording links in keyword alert emails. */
const RecordingLinkPage = () => {
  const { recordingId } = useParams();
  const { user } = useAuth();
  const principal = user?.user ?? user;
  const { hasPermission } = usePermissions();
  const canPlayAudio = principal?.role === 'admin' || hasPermission('play_audio');
  const [recording, setRecording] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setRecording(null);
    api.get('/recordings/inbox', { params: { recording_id: recordingId, limit: 1 } })
      .then(({ data }) => {
        if (!active) return;
        const row = data.messages?.[0];
        if (row) setRecording(row);
        else setError('This recording is unavailable or you do not have access.');
      })
      .catch(() => { if (active) setError('This recording is unavailable or you do not have access.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [recordingId]);

  return (
    <main className="stack stackLarge" style={{ maxWidth: '60rem', margin: '2rem auto', padding: '1rem' }}>
      <Link to="/">Back to inbox</Link>
      <h1>Recording {recordingId}</h1>
      {loading && <p role="status">Loading recording…</p>}
      {error && <p role="alert">{error}</p>}
      {recording && <article className={`${cardStyles.card} stack stackLarge`}>
        <p>{new Date(recording.timestamp).toLocaleString()}</p>
        <p style={{ whiteSpace: 'pre-wrap' }}>{recording.transcription || 'No transcription available'}</p>
        {canPlayAudio && recording.filename && <InlineAudioPlayer ownerId={`recording-link:${recordingId}`} src={`${API_BASE_URL}/${recording.filename}`} showWaveform />}
      </article>}
    </main>
  );
};

export default RecordingLinkPage;
