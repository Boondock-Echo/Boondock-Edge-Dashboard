import React, { useCallback, useEffect, useState } from 'react';
import { EyeOff, PlusCircle } from 'lucide-react';
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
};

const HallucinationsSection = () => {
  const [patterns, setPatterns] = useState([]);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadPatterns = useCallback(async () => {
    try {
      setError('');
      const { data } = await api.get('/hallucinations');
      setPatterns(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Failed to load hallucination patterns.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPatterns();
  }, [loadPatterns]);

  const addPattern = async () => {
    const pattern = draft.pattern.trim();
    if (!pattern) return;

    setSaving(true);
    setError('');
    try {
      const { data } = await api.post('/hallucinations', {
        pattern,
        match_type: draft.match_type,
        case_sensitive: draft.case_sensitive,
      });
      setPatterns((current) => [...current, data]);
      setDraft(EMPTY_DRAFT);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Failed to add hallucination pattern.');
    } finally {
      setSaving(false);
    }
  };

  const removePattern = async (pattern) => {
    setError('');
    try {
      await api.delete(`/hallucinations/${pattern.id}`);
      setPatterns((current) => current.filter((item) => item.id !== pattern.id));
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Failed to delete hallucination pattern.');
    }
  };

  return (
    <div className="stack stackLarge">
      <SettingsSectionHeader
        icon={EyeOff}
        title="Audio post processing"
        description="Manage literal and regular-expression patterns removed from transcriptions."
        iconColor="purple"
      />

      {error && (
        <div className={`${noticeStyles.notice} ${noticeStyles.error}`}>
          <div className={noticeStyles.body}><p>{error}</p></div>
        </div>
      )}

      <div className={`${cardStyles.card} stack`}>
        <div className={formStyles.field}>
          <label className={formStyles.label}>Pattern</label>
          <input
            className={formStyles.input}
            value={draft.pattern}
            onChange={(event) => setDraft((current) => ({ ...current, pattern: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addPattern();
              }
            }}
            placeholder="Text or regular expression"
          />
        </div>

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

          <Button type="button" variant="primary" onClick={addPattern} disabled={saving || !draft.pattern.trim()}>
            <PlusCircle size={18} />
            Add pattern
          </Button>
        </div>
      </div>

      <div className={`${cardStyles.card} stack`}>
        <h3 className={cardStyles.title}>Patterns</h3>
        {loading ? (
          <div className="row"><span className="spinner spinnerSmall" /> Loading patterns…</div>
        ) : patterns.length === 0 ? (
          <p className={cardStyles.description}>No hallucination patterns are configured.</p>
        ) : (
          <div className="stackCompact">
            {patterns.map((pattern) => (
              <div key={pattern.id} className="rowBetween">
                <div>
                  <div className="rowWrap">
                    <strong>{pattern.pattern}</strong>
                    <span className="pill">{pattern.match_type}</span>
                    {pattern.case_sensitive && <span className="pill">case-sensitive</span>}
                  </div>
                </div>
                <Button type="button" size="small" variant="danger" onClick={() => removePattern(pattern)}>
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HallucinationsSection;
