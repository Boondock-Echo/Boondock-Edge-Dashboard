import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Edit, Plus, Save, Shield, Trash2, X } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../utils/apiClient';
import SettingsSectionHeader from './SettingsSectionHeader';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import modalStyles from '../ui/Modal.module.css';

const emptyGroup = () => ({
  name: '',
  description: '',
  is_default: false,
  permissions_text: '',
});

const normalizePermissions = (text) =>
  [...new Set(
    String(text || '')
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean),
  )];

const GroupModal = ({ group, onClose, onSave }) => {
  const isEdit = Boolean(group?.id);
  const [formData, setFormData] = useState(() => group ? {
    ...group,
    permissions_text: (group.permissions || []).join('\n'),
  } : emptyGroup());
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    await onSave({
      ...formData,
      permissions: normalizePermissions(formData.permissions_text),
    });
  };

  return (
    <dialog ref={dialogRef} className={modalStyles.dialog} onCancel={onClose}>
      <div className={modalStyles.header}>
        <h2 className={modalStyles.title}>{isEdit ? 'Edit group' : 'Create group'}</h2>
        <Button size="icon" variant="ghost" onClick={onClose}><X /></Button>
      </div>

      <form className={`${formStyles.form} ${modalStyles.body}`} onSubmit={submit}>
        <div className={formStyles.field}>
          <label className={formStyles.label}>Name</label>
          <input
            className={formStyles.input}
            value={formData.name}
            onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
            required
          />
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>Description</label>
          <textarea
            className={formStyles.textarea}
            rows="3"
            value={formData.description || ''}
            onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
          />
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>Permissions</label>
          <textarea
            className={formStyles.textarea}
            rows="10"
            value={formData.permissions_text}
            onChange={(event) => setFormData((current) => ({ ...current, permissions_text: event.target.value }))}
            placeholder="One permission per line"
          />
          <p className="tinyText mutedText">One permission key per line. Existing keys are preserved exactly.</p>
        </div>

        <label className="row">
          <input
            type="checkbox"
            checked={Boolean(formData.is_default)}
            onChange={(event) => setFormData((current) => ({ ...current, is_default: event.target.checked }))}
          />
          Default group
        </label>

        <div className={modalStyles.actions}>
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary"><Save size={18} /> Save group</Button>
        </div>
      </form>
    </dialog>
  );
};

const ProfileManagement = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);

  const loadGroups = useCallback(async () => {
    try {
      const { data } = await api.get('/groups');
      setGroups(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load groups.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const saveGroup = async (formData) => {
    const payload = {
      name: formData.name.trim(),
      description: formData.description || '',
      is_default: Boolean(formData.is_default),
      permissions: formData.permissions,
    };

    try {
      if (formData.id) {
        await api.patch(`/groups/${formData.id}`, payload);
        toast.success('Group updated.');
      } else {
        await api.post('/groups', payload);
        toast.success('Group created.');
      }
      setCreating(false);
      setEditingGroup(null);
      await loadGroups();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save group.');
      throw error;
    }
  };

  const deleteGroup = async (group) => {
    if (!window.confirm(`Delete group "${group.name}"?`)) return;
    try {
      await api.delete(`/groups/${group.id}`);
      toast.success('Group deleted.');
      await loadGroups();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete group.');
    }
  };

  if (loading) return <div className="row"><span className="spinner spinnerSmall" /> Loading groups…</div>;

  return (
    <div className="stack stackLarge">
      <SettingsSectionHeader
        icon={Shield}
        title="Groups"
        description="Manage authorization groups and their permission sets."
        iconColor="purple"
      />

      <div className="actionsEnd">
        <Button variant="primary" onClick={() => setCreating(true)}><Plus size={18} /> Create group</Button>
      </div>

      <div className="gridThree">
        {groups.map((group) => (
          <div key={group.id} className={`${cardStyles.card} stack`}>
            <div className="rowBetween">
              <div>
                <div className="rowWrap">
                  <h3 className={cardStyles.title}>{group.name}</h3>
                  {group.is_default && <span className="pill pillAccent">Default</span>}
                </div>
                {group.description && <p className={cardStyles.description}>{group.description}</p>}
              </div>
            </div>

            <div>
              <p className="eyebrow">Permissions</p>
              <div className="rowWrap">
                {(group.permissions || []).map((permission) => <span key={permission} className="pill">{permission}</span>)}
              </div>
            </div>

            <div>
              <p className="eyebrow">Keywords</p>
              <div className="rowWrap">
                {(group.keyword_details || []).map((keyword) => <span key={keyword.id} className="pill">{keyword.pattern}</span>)}
              </div>
            </div>

            <div className="rowWrap">
              <Button size="small" variant="ghost" onClick={() => setEditingGroup(group)}><Edit size={16} /> Edit</Button>
              {!group.is_default && (
                <Button size="small" variant="danger" onClick={() => deleteGroup(group)}><Trash2 size={16} /> Delete</Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {creating && <GroupModal onClose={() => setCreating(false)} onSave={saveGroup} />}
      {editingGroup && <GroupModal group={editingGroup} onClose={() => setEditingGroup(null)} onSave={saveGroup} />}
    </div>
  );
};

export default ProfileManagement;
