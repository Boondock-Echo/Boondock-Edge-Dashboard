import React, { useCallback, useEffect, useId, useState } from 'react';
import { Mail, Zap } from 'lucide-react';
import api from '../../utils/apiClient';
import Button from '../ui/Button';
import SettingsSectionHeader from './SettingsSectionHeader';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import noticeStyles from '../ui/Notice.module.css';

const DEFAULT_ACTION = {
  device_host: '', outlet_id: '', command: 'turn_on',
  name: '', kind: 'popup', from_email: '', from_name: 'Boondock', reply_to: '',
  autoplay: true, to: '', cc: '', bcc: '', body_format: 'text',
  subject: 'Keyword alert: {keywords} — {channel}',
  body: 'Keyword: {keywords}\nChannel: {channel}\nTime: {timestamp}\n\n{transcript}\n\n{recording_url}',
};
const TEMPLATE_FIELDS = ['keyword', 'keywords', 'matched_text', 'transcript', 'recording_id', 'channel', 'timestamp', 'recording_url', 'dashboard_url'];
const list = (value) => value.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean);
const errorText = (error) => error.response?.data?.error || 'The request failed. Please try again.';

const Field = ({ label, children }) => {
  const id = useId();
  return (
    <div className={formStyles.field}>
      <label htmlFor={id} className={formStyles.label}>{label}</label>
      {React.cloneElement(children, { id })}
    </div>
  );
};
const Message = ({ error, message }) => error || message ? (
  <div role={error ? 'alert' : 'status'} className={`${noticeStyles.notice} ${error ? noticeStyles.error : noticeStyles.success}`}>
    {error || message}
  </div>
) : null;

export const EmailSettingsSection = () => {
  const [settings, setSettings] = useState(null);
  const [password, setPassword] = useState('');
  const [clearPassword, setClearPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/settings/email').then(({ data }) => setSettings(data)).catch((requestError) => setError(errorText(requestError)));
  }, []);
  const change = (key, value) => setSettings((current) => ({ ...current, [key]: value }));
  const save = async (event) => {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const payload = { ...settings };
      delete payload.password_configured;
      delete payload.configured;
      const { data } = await api.patch('/settings/email', {
        ...payload, port: Number(payload.port), ...(password ? { password } : {}), clear_password: clearPassword,
      });
      setSettings(data); setPassword(''); setClearPassword(false);
      setMessage('Email delivery settings saved.');
    } catch (requestError) { setError(errorText(requestError)); }
    finally { setBusy(false); }
  };

  return (
    <section className="stack stackLarge">
      <SettingsSectionHeader icon={Mail} title="Email delivery" description="Configure the SMTP server used by keyword email actions." />
      <Message error={error} message={message} />
      {settings && <>
        <form onSubmit={save} className={`${cardStyles.card} stack stackLarge`}>
          <div className="gridTwo">
            <Field label="SMTP host"><input className={formStyles.input} value={settings.host} onChange={(event) => change('host', event.target.value)} /></Field>
            <Field label="SMTP port"><input className={formStyles.input} type="number" min="1" max="65535" required value={settings.port} onChange={(event) => change('port', event.target.value)} /></Field>
            <Field label="Connection security"><select className={formStyles.select} value={settings.security} onChange={(event) => change('security', event.target.value)}><option value="starttls">STARTTLS</option><option value="ssl">TLS / SSL</option><option value="none">None (local relay)</option></select></Field>
            <Field label="SMTP username"><input className={formStyles.input} autoComplete="off" value={settings.username} onChange={(event) => change('username', event.target.value)} /></Field>
            <Field label="SMTP password"><input className={formStyles.input} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={settings.password_configured ? 'Saved — leave blank to keep' : 'Password'} /></Field>
            <label className="row"><input type="checkbox" checked={clearPassword} onChange={(event) => setClearPassword(event.target.checked)} />Clear saved password</label>
            <Field label="Dashboard base URL"><input className={formStyles.input} type="url" value={settings.dashboard_url} placeholder="https://boondock.example.com" onChange={(event) => change('dashboard_url', event.target.value)} /></Field>
          </div>
          <p className={cardStyles.description}>The dashboard URL supplies links in email templates. Recording links require the recipient to sign in with access to the recording.</p>
          <Button type="submit" variant="primary" disabled={busy}>Save email settings</Button>
        </form>
      </>}
    </section>
  );
};

const KeywordActionsSection = () => {
  const [actions, setActions] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [kasaDevices, setKasaDevices] = useState([]);
  const [discovered, setDiscovered] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [deliveries, setDeliveries] = useState([]);
  const [draft, setDraft] = useState(DEFAULT_ACTION);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const results = await Promise.all([api.get('/keyword-actions'), api.get('/settings/email'), api.get('/keyword-actions/deliveries')]);
    setActions(results[0].data.actions); setEmailConfigured(results[1].data.configured); setDeliveries(results[2].data); setLoaded(true);
  }, []);
  useEffect(() => { load().catch((requestError) => setError(errorText(requestError))); }, [load]);
  const change = (key, value) => { setDraft((current) => ({ ...current, [key]: value })); setPreview(null); };
  const reset = () => { setOutlets([]); setDraft(DEFAULT_ACTION); setEditing(null); setPreview(null); };
  const save = async (event) => {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const payload = {
        ...draft,
        to: list(draft.to), cc: list(draft.cc), bcc: list(draft.bcc),
      };
      if (editing) await api.patch(`/keyword-actions/${editing}`, payload);
      else await api.post('/keyword-actions', payload);
      reset(); await load(); setMessage('Keyword action saved.');
    } catch (requestError) { setError(errorText(requestError)); }
    finally { setBusy(false); }
  };
  const edit = (action) => {
    const { id, ...values } = action;
    setOutlets([]); setEditing(id); setPreview(null); setMessage('');
    setDraft({ ...DEFAULT_ACTION, ...values, to: (values.to || []).join(', '), cc: (values.cc || []).join(', '), bcc: (values.bcc || []).join(', ') });
  };
  const remove = async (action) => {
    if (!window.confirm(`Delete action "${action.name}"? Pending deliveries will be cancelled.`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await api.delete(`/keyword-actions/${action.id}`);
      if (editing === action.id) reset();
      await load(); setMessage('Keyword action deleted.');
    } catch (requestError) { setError(errorText(requestError)); }
    finally { setBusy(false); }
  };
  const showPreview = async () => {
    setBusy(true); setError('');
    try {
      const { data } = await api.post('/keyword-actions/preview', { subject: draft.subject, body: draft.body, body_format: draft.body_format });
      setPreview(data);
    } catch (requestError) { setError(errorText(requestError)); }
    finally { setBusy(false); }
  };

  const sendTest = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const { data } = await api.post('/settings/email/test', {
        to: testRecipient.trim(), from_email: draft.from_email, from_name: draft.from_name, reply_to: draft.reply_to,
      });
      setMessage(data.message);
    } catch (requestError) { setError(errorText(requestError)); }
    finally { setBusy(false); }
  };

  const discoverKasa = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const { data } = await api.post('/keyword-actions/kasa/discover', {});
      setKasaDevices(data.devices); setDiscovered(true);
      setMessage(`Found ${data.devices.length} device${data.devices.length === 1 ? '' : 's'}.`);
    } catch (requestError) { setError(errorText(requestError)); }
    finally { setBusy(false); }
  };

  const kasaRequest = async (test) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const payload = { device_host: draft.device_host.trim() };
      if (test) Object.assign(payload, { outlet_id: draft.outlet_id, command: draft.command });
      const { data } = await api.post(`/keyword-actions/kasa/${test ? 'test' : 'outlets'}`, payload);
      setOutlets(data.outlets);
      if (!data.outlets.some((outlet) => outlet.id === draft.outlet_id)) change('outlet_id', '');
      setMessage(test ? data.message : `Connected to ${data.name || data.model}. Select an outlet.`);
    } catch (requestError) { setError(errorText(requestError)); }
    finally { setBusy(false); }
  };

  return (
    <section className="stack stackLarge">
      <SettingsSectionHeader icon={Zap} title="Keyword actions" description="Set up reusable actions, then select them on the Keywords screen." />
      <Message error={error} message={message} />
      <p className={cardStyles.description}>Select an action on a keyword to activate it. Actions run when a transcription arrives, within the keyword’s group access. Editing or manually retranscribing a recording does not trigger actions. Duplicate recordings and hallucinations do not trigger actions. Popups work while the inbox is open, including when live mode is off.</p>
      {loaded && <form onSubmit={save} className={`${cardStyles.card} stack stackLarge`}>
        <h3 className={cardStyles.title}>{editing ? 'Edit action' : 'Add action'}</h3>
        <div className="gridTwo">
          <Field label="Action name"><input className={formStyles.input} required maxLength="100" value={draft.name} onChange={(event) => change('name', event.target.value)} /></Field>
          {draft.kind === 'email' && !emailConfigured ? <p role="status">Set up email routing to edit this email action.</p> :
            <Field label="Action type"><select className={formStyles.select} disabled={busy} value={draft.kind} onChange={(event) => change('kind', event.target.value)}><option value="popup">Popup</option><option value="kasa">Kasa device</option>{emailConfigured && <option value="email">Email</option>}</select></Field>}
        </div>
        {draft.kind === 'popup' ? <label className="row"><input type="checkbox" checked={draft.autoplay} onChange={(event) => change('autoplay', event.target.checked)} />Play recording audio automatically</label> : draft.kind === 'kasa' ? <>
          <p className={cardStyles.description}>Discover Kasa devices on the API host’s local network, or enter an IP address manually. Select an outlet or device to control. Discovery, reading, and saving do not change device states.</p>
          <Button disabled={busy} onClick={discoverKasa}>{busy ? 'Please wait…' : 'Discover Kasa devices'}</Button>
          {discovered && !kasaDevices.length && <p role="status">No devices found. Check that the API host and devices share a network with UDP broadcast access, or enter the device IP address manually.</p>}
          {kasaDevices.length > 0 && <Field label="Discovered device"><select className={formStyles.select} disabled={busy} value={kasaDevices.some((device) => device.device_host === draft.device_host) ? draft.device_host : ''} onChange={(event) => {
            const device = kasaDevices.find((item) => item.device_host === event.target.value);
            if (!device) return;
            change('device_host', device.device_host); setOutlets(device.outlets);
            change('outlet_id', device.outlets.length === 1 ? device.outlets[0].id : '');
          }}><option value="">Select a discovered device</option>{kasaDevices.map((device) => <option key={device.device_host} value={device.device_host} disabled={!device.supported}>{device.name || device.model} · {device.model} · {device.device_host}{device.supported ? '' : ` — ${device.reason}`}</option>)}</select></Field>}
          <Field label="Device IP address"><input className={formStyles.input} required disabled={busy} placeholder="192.168.1.50" value={draft.device_host} onChange={(event) => { change('device_host', event.target.value); change('outlet_id', ''); setOutlets([]); }} /></Field>
          <Button disabled={busy || !draft.device_host.trim()} onClick={() => kasaRequest(false)}>Read outlets</Button>
          <Field label="Outlet"><select className={formStyles.select} required disabled={busy} value={draft.outlet_id} onChange={(event) => change('outlet_id', event.target.value)}><option value="">Select an outlet</option>{draft.outlet_id && !outlets.some((outlet) => outlet.id === draft.outlet_id) && <option value={draft.outlet_id}>Saved outlet — read outlets to see its name</option>}{outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name} ({outlet.is_on ? 'on' : 'off'})</option>)}</select></Field>
          <Field label="Device command"><select className={formStyles.select} disabled={busy} value={draft.command} onChange={(event) => change('command', event.target.value)}><option value="turn_on">Turn on</option><option value="turn_off">Turn off</option></select></Field>
          <p className={cardStyles.description}>Test action immediately {draft.command === 'turn_on' ? 'turns on' : 'turns off'} the selected outlet.</p>
          <Button disabled={busy || !draft.outlet_id || !draft.device_host.trim()} onClick={() => kasaRequest(true)}>Test action</Button>
        </> : <>
          <p className={cardStyles.description}>Enter recipient addresses separated by commas. Sender and recipients apply to this action only.</p>
          <div className="gridTwo">
            <Field label="From email"><input className={formStyles.input} type="email" required value={draft.from_email} onChange={(event) => change('from_email', event.target.value)} /></Field>
            <Field label="From name"><input className={formStyles.input} value={draft.from_name} onChange={(event) => change('from_name', event.target.value)} /></Field>
            <Field label="Reply-To email"><input className={formStyles.input} type="email" value={draft.reply_to} onChange={(event) => change('reply_to', event.target.value)} /></Field>
          </div>
          <Field label="To recipients"><input className={formStyles.input} required value={draft.to} onChange={(event) => change('to', event.target.value)} /></Field>
          <div className="gridTwo">
            <Field label="Cc recipients"><input className={formStyles.input} value={draft.cc} onChange={(event) => change('cc', event.target.value)} /></Field>
            <Field label="Bcc recipients"><input className={formStyles.input} value={draft.bcc} onChange={(event) => change('bcc', event.target.value)} /></Field>
          </div>
          <Field label="Email subject"><input className={formStyles.input} required maxLength="500" value={draft.subject} onChange={(event) => change('subject', event.target.value)} /></Field>
          <Field label="Message format"><select className={formStyles.select} value={draft.body_format} onChange={(event) => change('body_format', event.target.value)}><option value="text">Plain text</option><option value="html">HTML</option></select></Field>
          <Field label="Email template"><textarea className={formStyles.input} rows="9" required value={draft.body} onChange={(event) => change('body', event.target.value)} /></Field>
          <p className={cardStyles.description}>Template fields: {TEMPLATE_FIELDS.map((field) => `{${field}}`).join(', ')}. Times use UTC. HTML substitutions are escaped. Use double braces for literal braces.</p>
          <Button disabled={busy} onClick={showPreview}>Preview email template</Button>
          <Field label="Test recipient"><input className={formStyles.input} type="email" value={testRecipient} onChange={(event) => setTestRecipient(event.target.value)} /></Field>
          <Button disabled={busy || !emailConfigured || !draft.from_email || !testRecipient.trim()} onClick={sendTest}>Send test email</Button>
          {preview && <div className="stack" aria-label="Email template preview"><strong>{preview.subject}</strong>{preview.body_format === 'html' ? <iframe title="Email template preview" sandbox="" srcDoc={preview.body} style={{ width: '100%', minHeight: '200px', background: 'white' }} /> : <pre style={{ whiteSpace: 'pre-wrap' }}>{preview.body}</pre>}</div>}
        </>}
        <div className="rowWrap"><Button type="submit" variant="primary" disabled={busy || (draft.kind === 'email' && !emailConfigured)}>Save action</Button>{editing && <Button onClick={reset} disabled={busy}>Cancel edit</Button>}</div>
      </form>}
      <div className={`${cardStyles.card} stack`}>
        <h3 className={cardStyles.title}>Configured actions</h3>
        {loaded && !actions.length && <p className={cardStyles.description}>No keyword actions configured.</p>}
        {actions.map((action) => <div className="rowBetween" key={action.id}>
          <div><strong>{action.name}</strong><p className={cardStyles.description}>{action.kind}</p></div>
          <div className="row"><Button size="small" disabled={busy} onClick={() => edit(action)}>Edit {action.name}</Button><Button size="small" variant="danger" disabled={busy} onClick={() => remove(action)}>Delete {action.name}</Button></div>
        </div>)}
      </div>
      <div className={`${cardStyles.card} stack`}>
        <div className="rowBetween"><h3 className={cardStyles.title}>Recent action deliveries</h3><Button disabled={busy} onClick={() => load().catch((requestError) => setError(errorText(requestError)))}>Refresh deliveries</Button></div>
        {!deliveries.length && <p className={cardStyles.description}>No action deliveries yet.</p>}
        {deliveries.map((delivery) => <div key={delivery.id} className="rowBetween"><span>{actions.find((action) => action.id === delivery.action_id)?.name || 'Deleted action'} · recording {delivery.recording_id}</span><span>{delivery.kind === 'popup' ? 'Popup event recorded' : delivery.state} · {delivery.attempts} attempt{delivery.attempts === 1 ? '' : 's'}{delivery.last_error ? ` · ${delivery.last_error}` : ''}</span></div>)}
      </div>
    </section>
  );
};

export default KeywordActionsSection;
