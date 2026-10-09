import React, { useEffect, useState } from 'react';
import { Check, KeyRound, Languages, Save } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../utils/apiClient';
import SettingsSectionHeader from './SettingsSectionHeader';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import noticeStyles from '../ui/Notice.module.css';

const LANGUAGES = [
  'english', 'spanish', 'french', 'german', 'italian', 'portuguese',
  'chinese', 'japanese', 'korean', 'arabic',
];

const MODELS = [
  ['tiny.en', 'Low'],
  ['base.en', 'Normal'],
  ['small.en', 'Medium'],
  ['medium', 'High'],
  ['large', 'Highest'],
];

const GlobalSettings = ({ activeSection }) => {
  const [settings, setSettings] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeSection && activeSection !== 'transcription-services') return undefined;
    let cancelled = false;
    setLoading(true);
    api.get('/settings/transcription')
      .then(({ data }) => {
        if (!cancelled) setSettings(data);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.response?.data?.error || 'Failed to load transcription settings');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeSection]);

  if (activeSection && activeSection !== 'transcription-services') return null;

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        target_language: settings.target_language,
        model: settings.model,
        method: settings.method,
        queue_enabled: Boolean(settings.queue_enabled),
      };
      if (apiKey) payload.api_key = apiKey;
      const { data } = await api.patch('/settings/transcription', payload);
      setSettings(data);
      setApiKey('');
      toast.success('Transcription settings saved');
    } catch (requestError) {
      const message = requestError.response?.data?.error || 'Failed to save transcription settings';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="centeredContent"><span className="spinner" /></div>;
  if (!settings) return <div className={`${noticeStyles.notice} ${noticeStyles.error}`}><div className={noticeStyles.body}><p>{error || 'Transcription settings unavailable'}</p></div></div>;

  return (
    <div className="stack stackLarge">
      <SettingsSectionHeader
        icon={Languages}
        title="Transcription service"
        description="Configure the transcription language, model, provider, and queue."
        iconColor="blue"
      />

      {error ? <div className={`${noticeStyles.notice} ${noticeStyles.error}`}><div className={noticeStyles.body}><p>{error}</p></div></div> : null}

      <div className="gridTwo">
        <div className={`${cardStyles.card} stack`}>
          <label className={formStyles.label}>Target language</label>
          <select className={formStyles.select} value={settings.target_language} onChange={(event) => setSettings((previous) => ({ ...previous, target_language: event.target.value }))}>
            {LANGUAGES.map((language) => <option key={language} value={language}>{language.charAt(0).toUpperCase() + language.slice(1)}</option>)}
          </select>

          <label className={formStyles.label}>Model</label>
          <select className={formStyles.select} value={settings.model} onChange={(event) => setSettings((previous) => ({ ...previous, model: event.target.value }))}>
            {MODELS.map(([value, label]) => <option key={value} value={value}>{label} ({value})</option>)}
          </select>
        </div>

        <div className={`${cardStyles.card} stack`}>
          <label className={formStyles.label}>Method</label>
          <select className={formStyles.select} value={settings.method} onChange={(event) => setSettings((previous) => ({ ...previous, method: event.target.value }))}>
            <option value="local">Local</option>
            <option value="openai">OpenAI</option>
          </select>

          {settings.method === 'openai' ? (
            <>
              <label className={formStyles.label}><span className="row"><KeyRound size={16} />API key</span></label>
              <input
                type="password"
                className={formStyles.input}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={settings.api_key_configured ? 'Configured — enter a new key to replace' : 'Enter API key'}
                autoComplete="new-password"
              />
            </>
          ) : null}

          <label className={`${formStyles.choiceCard} ${settings.queue_enabled ? formStyles.choiceCardSelected : ''}`}>
            <span className="grow stackCompact"><strong>Transcription queue</strong><span className="smallText mutedText">Process queued recordings automatically.</span></span>
            <span className={formStyles.switch}>
              <input type="checkbox" checked={Boolean(settings.queue_enabled)} onChange={(event) => setSettings((previous) => ({ ...previous, queue_enabled: event.target.checked }))} />
              <span className={formStyles.switchTrack} aria-hidden="true"><span className={formStyles.switchThumb} /></span>
            </span>
          </label>
        </div>
      </div>

      <div className="actionsEnd">
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? <span className="spinner spinnerSmall" /> : settings.api_key_configured && !apiKey ? <Check size={18} /> : <Save size={18} />}
          Save transcription settings
        </Button>
      </div>
    </div>
  );
};

export default GlobalSettings;
