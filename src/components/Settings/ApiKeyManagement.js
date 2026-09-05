import { apiFetch } from '../../utils/apiClient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, Plus, Trash2, Copy, Check, RefreshCw, AlertTriangle } from 'lucide-react';
import SettingsSectionHeader from './SettingsSectionHeader';

/**
 * Manage external REST API keys (admin only).
 * Backed by:
 *   GET      /api/v1/scopes
 *   GET/POST /api/v1/api-keys
 *   DELETE   /api/v1/api-keys/:id
 */
export default function ApiKeyManagement({ isDarkMode = false, showToast, user }) {
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

  const muted = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const inputCls = isDarkMode
    ? 'bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400';
  const rowBorder = isDarkMode ? 'border-gray-800' : 'border-gray-200';
  const tableHead = isDarkMode ? 'bg-gray-800/80 text-gray-400' : 'bg-gray-50 text-gray-500';
  const panelCls = isDarkMode
    ? 'border-gray-800 bg-gray-900/40'
    : 'border-gray-200 bg-gray-50';

  if (!isAdmin) {
    return (
      <div className="space-y-6 mt-6">
        <SettingsSectionHeader
          icon={KeyRound}
          title="API Keys"
          description="Issue keys for external API access with selectable scopes."
          isDarkMode={isDarkMode}
          iconColor="purple"
        />
        <div
          className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${
            isDarkMode ? 'border-amber-800/50 bg-amber-950/30 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>Only administrators can create and revoke API keys. Sign in with an admin account to manage keys.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-6">
      <SettingsSectionHeader
        icon={KeyRound}
        title="API Keys"
        description="Create and revoke keys for external integrators. Choose which scopes each key is allowed to use."
        isDarkMode={isDarkMode}
        iconColor="purple"
      />

      <div
        className={`rounded-lg border p-4 text-sm ${
          isDarkMode ? 'border-blue-900/50 bg-blue-950/20 text-blue-200' : 'border-blue-100 bg-blue-50 text-blue-900'
        }`}
      >
        <p className="font-medium mb-1">How integrators use a key</p>
        <code className={`block text-xs break-all whitespace-pre-wrap ${muted}`}>
          {`GET /api/v1/transcriptions
Authorization: Bearer bk_live_…
# Requires scope: transcriptions:read`}
        </code>
      </div>

      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className={`block text-xs font-medium mb-1.5 ${muted}`}>Key name / company</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Corp integration"
            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/40 ${inputCls}`}
          />
        </div>

        {/* Scope picker */}
        <div className={`rounded-lg border p-4 ${panelCls}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                Scopes
              </h3>
              <p className={`text-xs mt-0.5 ${muted}`}>
                Select permissions for this key · {selectedScopes.length} selected
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={selectDefaultScopes} className={`text-xs underline ${muted}`}>
                Defaults
              </button>
              <button type="button" onClick={selectAllScopes} className={`text-xs underline ${muted}`}>
                Select all
              </button>
              <button type="button" onClick={clearScopes} className={`text-xs underline ${muted}`}>
                Clear
              </button>
            </div>
          </div>

          <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
            {Object.entries(scopesByGroup).map(([group, scopes]) => (
              <div key={group}>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${muted}`}>{group}</p>
                <div className="space-y-2">
                  {scopes.map((scope) => {
                    const checked = selectedScopes.includes(scope.id);
                    return (
                      <label
                        key={scope.id}
                        className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                          checked
                            ? isDarkMode
                              ? 'border-blue-600/60 bg-blue-950/30'
                              : 'border-blue-300 bg-blue-50'
                            : isDarkMode
                              ? 'border-gray-800 hover:border-gray-700'
                              : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleScope(scope.id)}
                          className="mt-1 rounded border-gray-500"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                              {scope.label}
                            </span>
                            <code className={`text-[11px] px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-600 border border-gray-200'}`}>
                              {scope.id}
                            </code>
                            {scope.enforced ? (
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-500">
                                Active
                              </span>
                            ) : (
                              <span className={`text-[10px] font-semibold uppercase tracking-wide ${muted}`}>
                                Reserved
                              </span>
                            )}
                          </span>
                          <span className={`block text-xs mt-1 ${muted}`}>{scope.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
            {!scopeCatalog.length && (
              <p className={`text-sm ${muted}`}>Loading scopes…</p>
            )}
          </div>
        </div>

        <label className={`inline-flex items-center gap-2 text-sm ${muted}`}>
          <input
            type="checkbox"
            checked={neverExpires}
            onChange={(e) => setNeverExpires(e.target.checked)}
            className="rounded border-gray-500"
          />
          Never expires (otherwise defaults to 90 days)
        </label>

        <button
          type="submit"
          disabled={creating || !selectedScopes.length}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {creating ? 'Creating…' : 'Create key'}
        </button>
      </form>

      {createdKey && (
        <div
          className={`rounded-lg border p-4 ${
            isDarkMode ? 'border-emerald-800/60 bg-emerald-950/30' : 'border-emerald-200 bg-emerald-50'
          }`}
        >
          <p className={`text-sm font-semibold mb-2 ${isDarkMode ? 'text-emerald-300' : 'text-emerald-800'}`}>
            Store this key now — it will not be shown again
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <code
              className={`flex-1 break-all rounded-lg border px-3 py-2 text-xs font-mono ${
                isDarkMode ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-200 text-gray-900'
              }`}
            >
              {createdKey}
            </code>
            <button
              type="button"
              onClick={copyKey}
              className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setCreatedKey(null)}
            className={`mt-3 text-xs underline ${muted}`}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
          Issued keys {loading ? '' : `(${keys.length})`}
        </h3>
        <button
          type="button"
          onClick={loadKeys}
          disabled={loading}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
            isDarkMode ? 'border-gray-700 text-gray-300' : 'border-gray-300 text-gray-700'
          }`}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <p className={`text-sm ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
      )}

      <div className={`overflow-x-auto rounded-lg border ${rowBorder}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={tableHead}>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Prefix</th>
              <th className="px-3 py-2 text-left font-medium">Scopes</th>
              <th className="px-3 py-2 text-left font-medium">Expires</th>
              <th className="px-3 py-2 text-left font-medium">Created</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className={`px-3 py-8 text-center ${muted}`}>
                  Loading…
                </td>
              </tr>
            )}
            {!loading && keys.length === 0 && (
              <tr>
                <td colSpan={6} className={`px-3 py-8 text-center ${muted}`}>
                  No API keys yet. Create one above for an integrator.
                </td>
              </tr>
            )}
            {!loading &&
              keys.map((k) => (
                <tr key={k.id} className={`border-t ${rowBorder}`}>
                  <td className={`px-3 py-2.5 ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                    {k.name}
                    {k.revoked ? (
                      <span className="ml-2 text-xs text-red-500">revoked</span>
                    ) : null}
                  </td>
                  <td className={`px-3 py-2.5 font-mono text-xs ${muted}`}>{k.key_prefix || '—'}</td>
                  <td className={`px-3 py-2.5 text-xs ${muted}`}>
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {(k.scopes || []).length
                        ? (k.scopes || []).map((s) => (
                            <code
                              key={s}
                              className={`px-1.5 py-0.5 rounded ${
                                isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {s}
                            </code>
                          ))
                        : '—'}
                    </div>
                  </td>
                  <td className={`px-3 py-2.5 text-xs ${muted}`}>
                    {k.expires_at ? new Date(k.expires_at).toLocaleString() : 'Never'}
                  </td>
                  <td className={`px-3 py-2.5 text-xs ${muted}`}>
                    {k.created_at ? new Date(k.created_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {!k.revoked && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(k.id, k.name)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-500/10"
                        title="Revoke key"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Revoke
                      </button>
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
