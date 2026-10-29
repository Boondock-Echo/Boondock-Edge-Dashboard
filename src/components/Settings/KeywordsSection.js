import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PlusCircle, Siren } from 'lucide-react';
import api from '../../utils/apiClient';
import SettingsSectionHeader from './SettingsSectionHeader';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import noticeStyles from '../ui/Notice.module.css';

const EMPTY_DRAFT = {
  pattern: '',
  match_type: 'literal',
  case_sensitive: false,
  group_id: '',
  action_ids: [],
};

const KeywordsSection = () => {
  const [groups, setGroups] = useState([]);
  const [actions, setActions] = useState([]);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadGroups = useCallback(async () => {
    try {
      setError('');
      const [{ data }, actionResponse] = await Promise.all([api.get('/groups'), api.get('/keyword-actions')]);
      setActions(actionResponse.data.actions);
      const nextGroups = Array.isArray(data) ? data : [];
      setGroups(nextGroups);
      setDraft((current) => {
        if (current.group_id || nextGroups.length === 0) return current;
        const defaultGroup = nextGroups.find((group) => group.is_default) ?? nextGroups[0];
        return { ...current, group_id: String(defaultGroup.id) };
      });
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Failed to load keyword groups.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const keywords = useMemo(() => {
    const byId = new Map();

    for (const group of groups) {
      for (const keyword of group.keyword_details || []) {
        const id = Number(keyword.id);
        const existing = byId.get(id) || { ...keyword, group_names: [] };
        if (!existing.group_names.includes(group.name)) existing.group_names.push(group.name);
        byId.set(id, existing);
      }
    }

    return [...byId.values()].sort((a, b) =>
      String(a.pattern).localeCompare(String(b.pattern), undefined, { sensitivity: 'base' }),
    );
  }, [groups]);

  const addKeyword = async () => {
    const pattern = draft.pattern.trim();
    const groupId = Number(draft.group_id);
    const group = groups.find((item) => Number(item.id) === groupId);
    if (!pattern || !group) return;

    setSaving(true);
    setError('');
    try {
      await api.patch(`/groups/${group.id}`, {
        keywords: [
          ...(group.keywords || []),
          {
            pattern,
            match_type: draft.match_type,
            case_sensitive: draft.case_sensitive,
            action_ids: draft.action_ids,
          },
        ],
      });
      setDraft((current) => ({ ...EMPTY_DRAFT, group_id: current.group_id }));
      await loadGroups();
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Failed to add keyword.');
    } finally {
      setSaving(false);
    }
  };

  const saveActions = async () => {
    setSaving(true); setError('');
    try {
      await api.put(`/keywords/${editing.id}/actions`, { action_ids: editing.action_ids });
      setEditing(null); await loadGroups();
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Failed to save keyword actions.');
    } finally { setSaving(false); }
  };

  const actionChoices = (selected, onChange) => (
    <fieldset className="stack">
      <legend>Actions for this keyword</legend>
      {!actions.length && <p className={cardStyles.description}>Create an action on the Actions screen, then select it here.</p>}
      {actions.map((action) => <label className="row" key={action.id}>
        <input type="checkbox" checked={selected.includes(action.id)} onChange={(event) => onChange(event.target.checked ? [...selected, action.id] : selected.filter((id) => id !== action.id))} />
        {action.name} ({action.kind})
      </label>)}
    </fieldset>
  );

  const removeKeyword = async (keyword) => {
    if (!window.confirm(`Delete keyword "${keyword.pattern}" from all groups?`)) return;

    setError('');
    try {
      await api.delete(`/keywords/${keyword.id}`);
      await loadGroups();
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Failed to delete keyword.');
    }
  };

  return (
    <div className="stack stackLarge">
      <SettingsSectionHeader
        icon={Siren}
        title="Keywords"
        description="Keywords belong to authorization groups and are available to users through those groups."
        iconColor="blue"
      />

      {error && (
        <div className={`${noticeStyles.notice} ${noticeStyles.error}`}>
          <div className={noticeStyles.body}><p>{error}</p></div>
        </div>
      )}

      <div className={`${cardStyles.card} stack stackLarge`}>
        <div className="gridTwo">
          <div className={formStyles.field}>
            <label htmlFor="keyword-pattern" className={formStyles.label}>Pattern</label>
            <input
              className={formStyles.input}
              value={draft.pattern}
              onChange={(event) => setDraft((current) => ({ ...current, pattern: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addKeyword();
                }
              }}
              id="keyword-pattern"
              placeholder="Keyword or regular expression"
            />
          </div>

          <div className={formStyles.field}>
            <label htmlFor="keyword-group" className={formStyles.label}>Group</label>
            <select
              className={formStyles.select}
              id="keyword-group"
              value={draft.group_id}
              onChange={(event) => setDraft((current) => ({ ...current, group_id: event.target.value }))}
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>
        </div>

        {actionChoices(draft.action_ids, (ids) => setDraft((current) => ({ ...current, action_ids: ids })))}
        <div className="rowWrap">
          <select
            className={`${formStyles.select} ${formStyles.selectInline}`}
            value={draft.match_type}
            onChange={(event) => setDraft((current) => ({ ...current, match_type: event.target.value }))}
          >
            <option value="literal">Literal</option>
            <option value="regex">Regular expression</option>
          </select>

          <label className="row">
            <input
              type="checkbox"
              checked={draft.case_sensitive}
              onChange={(event) => setDraft((current) => ({ ...current, case_sensitive: event.target.checked }))}
            />
            Case sensitive
          </label>

          <Button
            type="button"
            variant="primary"
            onClick={addKeyword}
            disabled={saving || !draft.pattern.trim() || !draft.group_id}
          >
            <PlusCircle size={18} />
            Add keyword
          </Button>
        </div>
      </div>

      <div className={`${cardStyles.card} stack`}>
        <h3 className={cardStyles.title}>{keywords.length} keyword{keywords.length === 1 ? '' : 's'}</h3>
        {loading ? (
          <div className="row"><span className="spinner spinnerSmall" /> Loading keywords…</div>
        ) : keywords.length === 0 ? (
          <p className={cardStyles.description}>No group keywords are configured.</p>
        ) : (
          <div className="stackCompact">
            {keywords.map((keyword) => (
              <div key={keyword.id} className="stack">
                <div className="rowBetween">
                <div>
                  <div className="rowWrap">
                    <strong>{keyword.pattern}</strong>
                    <span className="pill">{keyword.match_type}</span>
                    {keyword.case_sensitive && <span className="pill">case-sensitive</span>}
                  </div>
                  <p className="tinyText mutedText">
                    Groups: {keyword.group_names.join(', ') || 'none'}
                  </p>
                </div>
                <div className="row">
                <Button size="small" disabled={saving} onClick={() => setEditing({ id: keyword.id, action_ids: [...(keyword.action_ids || [])] })}>Edit actions for {keyword.pattern}</Button>
                <Button
                  type="button"
                  size="small"
                  variant="danger"
                  onClick={() => removeKeyword(keyword)}
                >
                  Delete
                </Button>
                </div>
                </div>
                <p className={cardStyles.description}>Actions: {actions.filter((action) => (keyword.action_ids || []).includes(action.id)).map((action) => action.name).join(', ') || 'None'}</p>
                {editing?.id === keyword.id && <>
                  {actionChoices(editing.action_ids, (ids) => setEditing((current) => ({ ...current, action_ids: ids })))}
                  <div className="row"><Button disabled={saving} onClick={saveActions}>Save keyword actions</Button><Button disabled={saving} onClick={() => setEditing(null)}>Cancel</Button></div>
                </>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default KeywordsSection;
