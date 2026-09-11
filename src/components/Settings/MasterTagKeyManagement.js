import React, { useState, useEffect } from 'react';
import {
  Tag, PlusCircle, Search, Trash2,
  Edit, Check, X, ChevronDown
} from 'lucide-react';
import * as tagsService from '../services/tagsService';
import SettingsSectionHeader from './SettingsSectionHeader';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import tableStyles from '../ui/Table.module.css';

export default function SimpleTagManager() {
  const [tags, setTags] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [newTagCategory, setNewTagCategory] = useState('General');
  const [newTagColor, setNewTagColor] = useState('#ff0000');
  const [editingTagId, setEditingTagId] = useState(null);
  const [editTagValue, setEditTagValue] = useState('');
  const [editTagColor, setEditTagColor] = useState('#ff0000');

  const categories = ['All', 'Product', 'Customer', 'Technical', 'Priority', 'Status', 'General'];

  // Reload whenever filters change
  useEffect(() => {
    (async () => {
      try {
        const data = await tagsService.listTags({
          search: searchQuery,
          category: selectedCategory,
        });
        setTags(data);
      } catch (err) {
        console.error('Failed to load tags:', err);
      }
    })();
  }, [searchQuery, selectedCategory]);

  const filteredTags = tags.filter(tag => {
    const nameMatch = tag.name.toLowerCase().includes(searchQuery.toLowerCase());
    const catMatch = selectedCategory === 'All' || tag.category === selectedCategory;
    return nameMatch && catMatch;
  });

  // Create
  const handleAddTag = async () => {
    if (!newTag.trim()) return;
    try {
      const created = await tagsService.createTag({
        name: newTag.trim(),
        category: newTagCategory,
        color: newTagColor,
      });
      setTags(prev => [...prev, created]);
      setNewTag('');
      setNewTagCategory('General');
      setNewTagColor('#ff0000');
      setIsCreatingTag(false);
    } catch (err) {
      console.error('Create failed:', err);
    }
  };

  // Delete
  const handleRemoveTag = async (id) => {
    if (!window.confirm('Delete this tag?')) return;
    try {
      await tagsService.deleteTag(id);
      setTags(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // Edit
  const startEditTag = (tag) => {
    setEditingTagId(tag.id);
    setEditTagValue(tag.name);
    setEditTagColor(tag.color || '#ff0000');
  };

  const saveEditTag = async (id) => {
    if (!editTagValue.trim()) return;
    try {
      const updated = await tagsService.updateTag(id, {
        name: editTagValue.trim(),
        color: editTagColor,
      });
      setTags(prev => prev.map(t => t.id === id ? updated : t));
      setEditingTagId(null);
    } catch (err) {
      console.error('Update failed:', err);
    }
  };

  const cancelEdit = () => setEditingTagId(null);

  return (
    <div className="stackLarge">
      <SettingsSectionHeader
        icon={Tag}
        title="Tags"
        description="Create and manage tags for organizing and categorizing your content"
        iconColor="purple"
      />
      
      <div className={cardStyles.card}>
        {/* Controls */}
        <div className="rowBetweenStart">
          <div className="grow">
            <div className={formStyles.inputFrame}>
              <Search size={18} className={formStyles.inputIcon} />
              <input
                type="search"
                placeholder="Search tags..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={formStyles.iconInput}
              />
            </div>
          </div>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className={`${formStyles.select} ${formStyles.selectInline}`}
          >
            {categories.map(c => (
              <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>
            ))}
          </select>
          <Button onClick={() => setIsCreatingTag(true)} variant="primary">
            <PlusCircle size={18} /> New Tag
          </Button>
        </div>

        {/* New Tag Form */}
        {isCreatingTag && (
          <div className={cardStyles.section}>
            <div className="rowBetween">
              <h3>Create New Tag</h3>
              <Button onClick={() => setIsCreatingTag(false)} size="icon" aria-label="Close create tag form">
                <X size={20} />
              </Button>
            </div>
            <div className="gridThree">
              <div className={formStyles.field}>
                <label className={formStyles.label}>Tag Name</label>
                <input
                  type="text"
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  placeholder="Enter tag name"
                  className={formStyles.input}
                />
              </div>
              <div className={formStyles.field}>
                <label className={formStyles.label}>Category</label>
                <select
                  value={newTagCategory}
                  onChange={e => setNewTagCategory(e.target.value)}
                  className={formStyles.select}
                >
                  {categories.filter(c => c !== 'All').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className={formStyles.field}>
                <label className={formStyles.label}>Color</label>
                <input
                  type="color"
                  value={newTagColor}
                  onChange={e => setNewTagColor(e.target.value)}
                  className={formStyles.input}
                />
              </div>
            </div>
            <div className="rowBetween">
              <div />
              <div className="row">
                <Button onClick={() => setIsCreatingTag(false)}>Cancel</Button>
                <Button onClick={handleAddTag} disabled={!newTag.trim()} variant="primary">
                  <Check size={18} /> Create Tag
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tag List */}
        <div className={cardStyles.section}>
          <div className="rowBetween">
            <h2>
              {selectedCategory === 'All' ? 'All Tags' : `${selectedCategory} Tags`}{' '}
              <span className="pill">{filteredTags.length}</span>
            </h2>
          </div>
          {filteredTags.length > 0 ? (
            <div className={tableStyles.scroll}>
              <table className={tableStyles.table}>
                <thead>
                  <tr>
                    <th className={tableStyles.header}>Tag</th>
                    <th className={tableStyles.header}>Category</th>
                    <th className={tableStyles.header}>Usage</th>
                    <th className={tableStyles.header}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTags.map(tag => (
                    <tr key={tag.id} className={tableStyles.row}>
                      <td className={tableStyles.cell}>
                        {editingTagId === tag.id ? (
                          <div className="row">
                            <input
                              type="text"
                              value={editTagValue}
                              onChange={e => setEditTagValue(e.target.value)}
                              className={formStyles.input}
                              autoFocus
                            />
                            <input
                              type="color"
                              value={editTagColor}
                              onChange={e => setEditTagColor(e.target.value)}
                              className={formStyles.input}
                            />
                          </div>
                        ) : (
                          <div className="row">
                            <span className="pill" style={{ backgroundColor: tag.color }} aria-hidden="true" />
                            <span>{tag.name}</span>
                          </div>
                        )}
                      </td>
                      <td className={tableStyles.cellMuted}>{tag.category}</td>
                      <td className={tableStyles.cellMuted}>{tag.usageCount}</td>
                      <td className={tableStyles.cell}>
                        {editingTagId === tag.id ? (
                          <div className="row">
                            <Button onClick={() => saveEditTag(tag.id)} size="icon" variant="success" aria-label={`Save ${tag.name}`}>
                              <Check size={16} />
                            </Button>
                            <Button onClick={cancelEdit} size="icon" variant="danger" aria-label={`Cancel editing ${tag.name}`}>
                              <X size={16} />
                            </Button>
                          </div>
                        ) : (
                          <div className="row">
                            <Button onClick={() => startEditTag(tag)} size="icon" aria-label={`Edit ${tag.name}`}>
                              <Edit size={16} />
                            </Button>
                            <Button onClick={() => handleRemoveTag(tag.id)} size="icon" variant="danger" aria-label={`Delete ${tag.name}`}>
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="centeredContent">
              <div className="stackCompact">
                <Tag size={24} />
                <h3>No tags found</h3>
                <p className={cardStyles.description}>
                  {searchQuery
                    ? `No tags match your search "${searchQuery}"`
                    : 'No tags available in this category. Create a new tag to get started.'}
                </p>
                {!isCreatingTag && (
                  <Button onClick={() => setIsCreatingTag(true)} variant="primary">
                    <PlusCircle size={16} /> Create New Tag
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}