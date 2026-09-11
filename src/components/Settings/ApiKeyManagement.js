import { apiFetch } from '../../utils/apiClient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, Plus, Trash2, Copy, Check, RefreshCw, AlertTriangle } from 'lucide-react';
import SettingsSectionHeader from './SettingsSectionHeader';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import noticeStyles from '../ui/Notice.module.css';
import tableStyles from '../ui/Table.module.css';

/**
 * Manage external REST API keys (admin only).
 * Backed by:
 *   GET      /api/v1/scopes
 *   GET/POST /api/v1/api-keys
 *   DELETE   /api/v1/api-keys/:id
 */
export default function ApiKeyManagement({ showToast, user }) {
  const [keys, setKeys] = useState([]);
  const [scopeCatalog, setScopeCatalog] = useState([]);
  const [defaultScopes, setDefaultScopes] = useState(['transcriptions:read']);
  const [selectedScopes, setSelectedScopes] = useState(['transcriptions:read']);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [neverExpires, setNeverExpires] = useState(false);
  const [createdKey, setCreatedKey] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const isAdmin = (user?.role || '').toLowerCase() === 'admin';

  const toast = useCallback(
    (msg, type = 'success') => {
      if (typeof showToast === 'function') showToast(msg, type);
    },
    [showToast]
  );

  const loadScopes = useCallback(async () => {
    try {
      const res = await apiFetch(`/v1/scopes`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.error || data.title || `HTTP ${res.status}`);
      }
      const catalog = Array.isArray(data.data) ? data.data : [];
      const defaults = Array.isArray(data.default_scopes) && data.default_scopes.length
        ? data.default_scopes
        : ['transcriptions:read'];
      setScopeCatalog(catalog);
      setDefaultScopes(defaults);
      setSelectedScopes(defaults);
    } catch (err) {
      // Fallback catalog if endpoint unavailable (older builds)
      const fallback = [
        {
          id: 'transcriptions:read',
          label: 'Read transcriptions',
          description: 'GET /api/v1/transcriptions',
          group: 'Transcriptions',
          enforced: true,
        },
      ];
      setScopeCatalog(fallback);
      setDefaultScopes(['transcriptions:read']);
      setSelectedScopes(['transcriptions:read']);
      console.warn('Could not load scope catalog:', err.message);
    }
  }, []);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/v1/api-keys`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data.detail || data.error || data.title || `HTTP ${res.status}`;
        throw new Error(detail);
      }
      setKeys(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      setError(err.message || 'Failed to load API keys');
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    (async () => {
      await loadScopes();
      await loadKeys();
    })();
  }, [isAdmin, loadScopes, loadKeys]);

  const scopesByGroup = useMemo(() => {
    const groups = {};
    scopeCatalog.forEach((s) => {
      const g = s.group || 'Other';
      if (!groups[g]) groups[g] = [];
      groups[g].push(s);
    });
    return groups;
  }, [scopeCatalog]);

  const toggleScope = (scopeId) => {
    setSelectedScopes((prev) =>
      prev.includes(scopeId) ? prev.filter((s) => s !== scopeId) : [...prev, scopeId]
    );
  };

  const selectAllScopes = () => {
    setSelectedScopes(scopeCatalog.map((s) => s.id));
  };

  const selectDefaultScopes = () => {
    setSelectedScopes([...defaultScopes]);
  };

  const clearScopes = () => {
    setSelectedScopes([]);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast('Enter a name for the API key', 'error');
      return;
    }
    if (!selectedScopes.length) {
      toast('Select at least one scope', 'error');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const body = {
        name: trimmed,
        scopes: selectedScopes,
      };
      if (neverExpires) body.never_expires = true;

      const res = await apiFetch(`/v1/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.error || data.title || `HTTP ${res.status}`);
      }
      setCreatedKey(data.api_key || null);
      setName('');
      setNeverExpires(false);
      setSelectedScopes([...defaultScopes]);
      toast('API key created — copy it now; it will not be shown again');
      await loadKeys();
    } catch (err) {
      toast(err.message || 'Failed to create API key', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId, keyName) => {
    if (!window.confirm(`Revoke API key "${keyName}"? Integrators using this key will lose access immediately.`)) {
      return;
    }
    try {
      const res = await apiFetch(`/v1/api-keys/${encodeURIComponent(keyId)}`, {
        method: 'DELETE',
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || data.title || `HTTP ${res.status}`);
      }
      toast('API key revoked');
      if (createdKey) setCreatedKey(null);
      await loadKeys();
    } catch (err) {
      toast(err.message || 'Failed to revoke API key', 'error');
    }
  };

  const copyKey = async () => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      toast('API key copied to clipboard');
      setTimeout(() => setCopied(false), 1500);
    } catch (_) {
      toast('Could not copy — select the key manually', 'error');
    }
  };

  if (!isAdmin) {
    return (
      <div className="stack stackLarge">
        <SettingsSectionHeader
          icon={KeyRound}
          title="API Keys"
          description="Issue keys for external API access with selectable scopes."
          iconColor="purple"
        />
        <div className={`${noticeStyles.notice} ${noticeStyles.warning}`}>
          <AlertTriangle className={noticeStyles.icon} />
          <div className={noticeStyles.body}>
            <p>Only administrators can create and revoke API keys. Sign in with an admin account to manage keys.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stack stackLarge">
      <SettingsSectionHeader
        icon={KeyRound}
        title="API Keys"
        description="Create and revoke keys for external integrators. Choose which scopes each key is allowed to use."
        iconColor="purple"
      />

      <div className={`${noticeStyles.notice} ${noticeStyles.info}`}>
        <div className={noticeStyles.body}>
          <p><strong>How integrators use a key</strong></p>
          <pre className="codeBlock">{`GET /api/v1/transcriptions
Authorization: Bearer bk_live_…
# Requires scope: transcriptions:read`}</pre>
        </div>
      </div>

      <form onSubmit={handleCreate} className={formStyles.form}>
        <div className={formStyles.field}>
          <label className={formStyles.label}>Key name / company</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Corp integration"
            className={formStyles.input}
          />
        </div>

        {/* Scope picker */}
        <section className={cardStyles.card}>
          <div className="rowBetweenStart">
            <div>
              <h3 className={cardStyles.title}>Scopes</h3>
              <p className={cardStyles.description}>
                Select permissions for this key · {selectedScopes.length} selected
              </p>
            </div>
            <div className="rowWrap">
              <Button type="button" size="small" variant="ghost" onClick={selectDefaultScopes}>Defaults</Button>
              <Button type="button" size="small" variant="ghost" onClick={selectAllScopes}>Select all</Button>
              <Button type="button" size="small" variant="ghost" onClick={clearScopes}>Clear</Button>
            </div>
          </div>

          <div className="scrollPanel stack">
            {Object.entries(scopesByGroup).map(([group, scopes]) => (
              <div key={group}>
                <p className="eyebrow">{group}</p>
                <div className="stackCompact">
                  {scopes.map((scope) => {
                    const checked = selectedScopes.includes(scope.id);
                    return (
                      <label key={scope.id} className={`${formStyles.choiceCard} ${checked ? formStyles.choiceCardSelected : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleScope(scope.id)}
                        />
                        <span className="grow">
                          <span className="rowWrap">
                            <strong>{scope.label}</strong>
                            <code>{scope.id}</code>
                            <span className={`pill ${scope.enforced ? 'pillSuccess' : ''}`}>
                              {scope.enforced ? 'Active' : 'Reserved'}
                            </span>
                          </span>
                          <span className="smallText mutedText">{scope.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
            {!scopeCatalog.length && <p className="smallText mutedText">Loading scopes…</p>}
          </div>
        </section>

        <label className={formStyles.checkbox}>
          <input
            type="checkbox"
            checked={neverExpires}
            onChange={(e) => setNeverExpires(e.target.checked)}
          />
          Never expires (otherwise defaults to 90 days)
        </label>

        <div>
          <Button type="submit" variant="primary" disabled={creating || !selectedScopes.length}>
            <Plus />
            {creating ? 'Creating…' : 'Create key'}
          </Button>
        </div>
      </form>

      {createdKey && (
        <div className={`${noticeStyles.notice} ${noticeStyles.success}`}>
          <div className={`${noticeStyles.body} grow`}>
            <p><strong>Store this key now — it will not be shown again</strong></p>
            <div className="rowWrap">
              <code className="codeBlock grow">{createdKey}</code>
              <Button type="button" onClick={copyKey}>
                {copied ? <Check className="iconSmall" /> : <Copy className="iconSmall" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <Button type="button" size="small" variant="ghost" onClick={() => setCreatedKey(null)}>Dismiss</Button>
          </div>
        </div>
      )}

      <div className="rowBetween">
        <h3 className={cardStyles.title}>Issued keys {loading ? '' : `(${keys.length})`}</h3>
        <Button type="button" size="small" onClick={loadKeys} disabled={loading}>
          <RefreshCw className={loading ? 'spin' : ''} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className={`${noticeStyles.notice} ${noticeStyles.error}`}>
          <div className={noticeStyles.body}><p>{error}</p></div>
        </div>
      )}

      <div className={tableStyles.scroll}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th className={tableStyles.header}>Name</th>
              <th className={tableStyles.header}>Prefix</th>
              <th className={tableStyles.header}>Scopes</th>
              <th className={tableStyles.header}>Expires</th>
              <th className={tableStyles.header}>Created</th>
              <th className={tableStyles.header}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className={tableStyles.row}>
                <td colSpan={6} className={tableStyles.cellMuted}>Loading…</td>
              </tr>
            )}
            {!loading && keys.length === 0 && (
              <tr className={tableStyles.row}>
                <td colSpan={6} className={tableStyles.cellMuted}>No API keys yet. Create one above for an integrator.</td>
              </tr>
            )}
            {!loading && keys.map((k) => (
              <tr key={k.id} className={tableStyles.row}>
                <td className={tableStyles.cell}>
                  {k.name}
                  {k.revoked ? <span className="pill pillDanger">revoked</span> : null}
                </td>
                <td className={tableStyles.cellMuted}><code>{k.key_prefix || '—'}</code></td>
                <td className={tableStyles.cellMuted}>
                  <div className="rowWrap">
                    {(k.scopes || []).length
                      ? (k.scopes || []).map((s) => <code key={s}>{s}</code>)
                      : '—'}
                  </div>
                </td>
                <td className={tableStyles.cellMuted}>{k.expires_at ? new Date(k.expires_at).toLocaleString() : 'Never'}</td>
                <td className={tableStyles.cellMuted}>{k.created_at ? new Date(k.created_at).toLocaleString() : '—'}</td>
                <td className={tableStyles.cell}>
                  {!k.revoked && (
                    <Button type="button" size="small" variant="danger" onClick={() => handleRevoke(k.id, k.name)} title="Revoke key">
                      <Trash2 />
                      Revoke
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
