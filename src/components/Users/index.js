import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Edit, Key, Lock, Search, Save, Trash2, Unlock, UserPlus, Users, X } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../utils/apiClient';
import { useAuth } from '../AuthContext';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import modalStyles from '../ui/Modal.module.css';
import tableStyles from '../ui/Table.module.css';
import SettingsSectionHeader from '../Settings/SettingsSectionHeader';

const emptyUser = () => ({
  email: '',
  name: '',
  password: '',
  role: 'member',
  groups: [],
});

const UserModal = ({ user, groups, onClose, onSubmit }) => {
  const isEdit = Boolean(user?.id);
  const [formData, setFormData] = useState(() => user ? { ...user, password: '' } : emptyUser());
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  const toggleGroup = (groupId) => {
    setFormData((current) => ({
      ...current,
      groups: current.groups.includes(groupId)
        ? current.groups.filter((id) => id !== groupId)
        : [...current.groups, groupId],
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    await onSubmit(formData);
  };

  return (
    <dialog ref={dialogRef} className={modalStyles.dialog} onCancel={onClose}>
      <div className={modalStyles.header}>
        <h2 className={modalStyles.title}>{isEdit ? 'Edit user' : 'Create user'}</h2>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close user editor"><X /></Button>
      </div>

      <form className={`${formStyles.form} ${modalStyles.body}`} onSubmit={submit}>
        <div className={formStyles.field}>
          <label className={formStyles.label}>Email</label>
          <input
            type="email"
            className={formStyles.input}
            value={formData.email || ''}
            onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))}
            required
          />
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>Name</label>
          <input
            className={formStyles.input}
            value={formData.name || ''}
            onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
            required
          />
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>Password {isEdit ? '(leave blank to keep current)' : ''}</label>
          <input
            type="password"
            className={formStyles.input}
            value={formData.password || ''}
            onChange={(event) => setFormData((current) => ({ ...current, password: event.target.value }))}
            required={!isEdit}
          />
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>Role</label>
          <select
            className={formStyles.select}
            value={formData.role || 'member'}
            onChange={(event) => setFormData((current) => ({ ...current, role: event.target.value }))}
          >
            <option value="member">Member</option>
            <option value="admin">Administrator</option>
          </select>
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>Groups</label>
          <div className="stackCompact">
            {groups.map((group) => (
              <label key={group.id} className="row">
                <input
                  type="checkbox"
                  checked={(formData.groups || []).includes(group.id)}
                  onChange={() => toggleGroup(group.id)}
                />
                <span>{group.name}</span>
                {group.is_default && <span className="pill">default</span>}
              </label>
            ))}
          </div>
        </div>

        <div className={modalStyles.actions}>
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary"><Save size={18} /> {isEdit ? 'Save changes' : 'Create user'}</Button>
        </div>
      </form>
    </dialog>
  );
};

const UserManagement = () => {
  const { user: authValue } = useAuth();
  const principal = authValue?.user ?? authValue ?? null;
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [usersResponse, groupsResponse] = await Promise.all([
        api.get('/users'),
        api.get('/groups'),
      ]);
      setUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);
      setGroups(Array.isArray(groupsResponse.data) ? groupsResponse.data : []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groupsById = useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups],
  );

  const filteredUsers = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) =>
      `${user.name || ''} ${user.email || ''}`.toLowerCase().includes(needle),
    );
  }, [searchTerm, users]);

  const saveUser = async (formData) => {
    const payload = {
      email: formData.email.trim(),
      name: formData.name.trim(),
      role: formData.role,
      groups: formData.groups || [],
    };
    if (formData.password) payload.password = formData.password;

    try {
      if (formData.id) {
        await api.patch(`/users/${formData.id}`, payload);
        toast.success('User updated.');
      } else {
        await api.post('/users', payload);
        toast.success('User created.');
      }
      setEditingUser(null);
      setCreating(false);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save user.');
      throw error;
    }
  };

  const deleteUser = async (user) => {
    if (!window.confirm(`Delete ${user.email}?`)) return;
    try {
      await api.delete(`/users/${user.id}`);
      toast.success('User deleted.');
      await load();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete user.');
    }
  };

  const resetMfa = async (user) => {
    if (!window.confirm(`Reset MFA for ${user.email}?`)) return;
    try {
      await api.post(`/users/${user.id}/mfa/reset`);
      toast.success(`MFA reset for ${user.email}.`);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to reset MFA.');
    }
  };

  const setMfaEnforcement = async (user, enforce) => {
    try {
      await api.post(`/users/${user.id}/mfa/enforcement`, { enforce });
      toast.success(`MFA requirement ${enforce ? 'enabled' : 'disabled'}.`);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update MFA requirement.');
    }
  };

  if (loading) {
    return <div className="centeredContent"><span className="spinner" /> Loading users…</div>;
  }

  return (
    <div className="stack stackLarge">
      <SettingsSectionHeader
        icon={Users}
        title="Users"
        description="Manage accounts, roles, groups, and MFA requirements."
        iconColor="blue"
      />

      <div className="rowBetween">
        <div className={formStyles.inputFrame}>
          <Search className={formStyles.inputIcon} size={20} />
          <input
            className={formStyles.iconInput}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search users…"
          />
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}><UserPlus size={18} /> Add user</Button>
      </div>

      <div className={`${cardStyles.card} ${cardStyles.flush}`}>
        <div className={tableStyles.scroll}>
          <table className={tableStyles.table}>
            <thead>
              <tr className={tableStyles.row}>
                <th className={tableStyles.header}>User</th>
                <th className={tableStyles.header}>Role</th>
                <th className={tableStyles.header}>Groups</th>
                <th className={tableStyles.header}>MFA</th>
                <th className={tableStyles.header}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className={tableStyles.rowInteractive}>
                  <td className={tableStyles.cell}>
                    <strong>{user.name}</strong>
                    <div className="tinyText mutedText">{user.email}</div>
                  </td>
                  <td className={tableStyles.cell}><span className="pill">{user.role}</span></td>
                  <td className={tableStyles.cell}>
                    <div className="rowWrap">
                      {(user.groups || []).map((groupId) => (
                        <span key={groupId} className="pill">{groupsById.get(groupId)?.name || `Group ${groupId}`}</span>
                      ))}
                    </div>
                  </td>
                  <td className={tableStyles.cell}>
                    <div className="rowWrap">
                      <span className={`pill ${user.mfa_enabled ? 'pillSuccess' : ''}`}>{user.mfa_enabled ? 'Enabled' : 'Disabled'}</span>
                      {user.mfa_enforced && <span className="pill pillWarning">Required</span>}
                    </div>
                  </td>
                  <td className={tableStyles.cell}>
                    <div className="rowWrap">
                      <Button size="icon" variant="ghost" onClick={() => setEditingUser(user)} title="Edit user"><Edit size={18} /></Button>
                      <Button size="icon" variant="warning" onClick={() => setMfaEnforcement(user, !user.mfa_enforced)} title="Toggle MFA requirement">
                        {user.mfa_enforced ? <Unlock size={18} /> : <Lock size={18} />}
                      </Button>
                      <Button size="icon" variant="warning" onClick={() => resetMfa(user)} title="Reset MFA"><Key size={18} /></Button>
                      {principal?.id !== user.id && (
                        <Button size="icon" variant="danger" onClick={() => deleteUser(user)} title="Delete user"><Trash2 size={18} /></Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {creating && <UserModal groups={groups} onClose={() => setCreating(false)} onSubmit={saveUser} />}
      {editingUser && <UserModal user={editingUser} groups={groups} onClose={() => setEditingUser(null)} onSubmit={saveUser} />}
    </div>
  );
};

export default UserManagement;
