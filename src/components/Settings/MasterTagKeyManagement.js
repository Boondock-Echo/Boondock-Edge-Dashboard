import React, { useState, useEffect } from 'react';
import {
  Tag, PlusCircle, Search, Trash2,
  Edit, Check, X, ChevronDown
} from 'lucide-react';
import * as tagsService from '../services/tagsService';
import SettingsSectionHeader from './SettingsSectionHeader';

export default function SimpleTagManager({ isDarkMode = false }) {
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
    <div className="space-y-6">
      <SettingsSectionHeader
        icon={Tag}
        title="Tags"
        description="Create and manage tags for organizing and categorizing your content"
        isDarkMode={isDarkMode}
        iconColor="purple"
      />
      
      <div className={`w-full p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md`}>

      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search size={18} className={`${isDarkMode ? 'text-gray-400' : 'text-slate-400'}`} />
          </div>
          <input
            type="search"
            placeholder="Search tags..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600 focus:ring-blue-500 focus:border-blue-500' : 'bg-white border-slate-200 focus:ring-blue-500 focus:border-blue-500'} focus:outline-none`}
          />
        </div>
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          className={`md:w-64 p-2 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600 focus:ring-blue-500 focus:border-blue-500' : 'bg-white border-slate-200 focus:ring-blue-500 focus:border-blue-500'} focus:outline-none`}
        >
          {categories.map(c => (
            <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>
          ))}
        </select>
        <button
          onClick={() => setIsCreatingTag(true)}
          className={`px-4 py-2 rounded-lg ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white flex items-center gap-2 shadow-sm`}
        >
          <PlusCircle size={18} /> New Tag
        </button>
      </div>

      {/* New Tag Form */}
      {isCreatingTag && (
        <div className={`mb-6 p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex justify-between items-center mb-4">
            <h3 className={`font-bold ${isDarkMode ? 'text-gray-100' : 'text-slate-800'}`}>Create New Tag</h3>
            <button
              onClick={() => setIsCreatingTag(false)}
              className={`p-1 rounded-full ${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
            >
              <X size={20} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className={`block mb-1 text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>Tag Name</label>
              <input
                type="text"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                placeholder="Enter tag name"
                className={`w-full p-2 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600 focus:ring-blue-500 focus:border-blue-500' : 'bg-white border-slate-200 focus:ring-blue-500 focus:border-blue-500'} focus:outline-none`}
              />
            </div>
            <div>
              <label className={`block mb-1 text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>Category</label>
              <div className="relative">
                <select
                  value={newTagCategory}
                  onChange={e => setNewTagCategory(e.target.value)}
                  className={`w-full p-2 rounded-lg border appearance-none ${isDarkMode ? 'bg-gray-700 border-gray-600 focus:ring-blue-500 focus:border-blue-500' : 'bg-white border-slate-200 focus:ring-blue-500 focus:border-blue-500'} focus:outline-none`}
                >
                  {categories.filter(c => c !== 'All').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <ChevronDown size={18} className={`${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`} />
                </div>
              </div>
            </div>
            <div>
              <label className={`block mb-1 text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>Color</label>
              <input
                type="color"
                value={newTagColor}
                onChange={e => setNewTagColor(e.target.value)}
                className={`w-full h-10 p-1 border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-slate-200'} rounded-lg`}
              />
            </div>
          </div>
          <div className="flex justify-end mt-4 gap-3">
            <button
              onClick={() => setIsCreatingTag(false)}
              className={`px-4 py-2 rounded-lg ${isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
            >
              Cancel
            </button>
            <button
              onClick={handleAddTag}
              disabled={!newTag.trim()}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                newTag.trim()
                  ? isDarkMode
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                  : isDarkMode
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Check size={18} /> Create Tag
            </button>
          </div>
        </div>
      )}

      {/* Tag List */}
      <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg`}>
        <div className="flex justify-between items-center mb-4 px-4 pt-4">
          <h2 className={`text-lg font-bold ${isDarkMode ? 'text-gray-100' : 'text-slate-800'}`}>
            {selectedCategory === 'All' ? 'All Tags' : `${selectedCategory} Tags`}
            <span className={`ml-2 text-sm py-1 px-2 rounded-full ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-slate-100 text-slate-600'}`}>
              {filteredTags.length}
            </span>
          </h2>
        </div>
        {filteredTags.length > 0 ? (
          <table className="w-full table-auto">
            <thead className={`${isDarkMode ? 'bg-gray-700' : 'bg-slate-50'} text-left`}>
              <tr>
                <th className={`px-4 py-3 text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>Tag</th>
                <th className={`px-4 py-3 text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>Category</th>
                <th className={`px-4 py-3 text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>Usage</th>
                <th className={`px-4 py-3 text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-slate-600'} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-slate-200'}`}>
              {filteredTags.map(tag => (
                <tr key={tag.id}>
                  <td className="px-4 py-3">
                    {editingTagId === tag.id ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={editTagValue}
                          onChange={e => setEditTagValue(e.target.value)}
                          className={`w-full p-1 rounded border ${isDarkMode ? 'bg-gray-700 border-gray-600 focus:ring-blue-500 focus:border-blue-500' : 'bg-white border-slate-200 focus:ring-blue-500 focus:border-blue-500'} focus:outline-none`}
                          autoFocus
                        />
                        <input
                          type="color"
                          value={editTagColor}
                          onChange={e => setEditTagColor(e.target.value)}
                          className={`w-10 h-8 p-0 border-none ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <span
                          className="w-3 h-3 rounded-full mr-3"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className={`${isDarkMode ? 'text-gray-100' : 'text-slate-800'}`}>{tag.name}</span>
                      </div>
                    )}
                  </td>
                  <td className={`px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>{tag.category}</td>
                  <td className={`px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>{tag.usageCount}</td>
                  <td className="px-4 py-3 text-right">
                    {editingTagId === tag.id ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => saveEditTag(tag.id)}
                          className={`p-1 rounded ${isDarkMode ? 'text-green-400 hover:bg-gray-700' : 'text-green-600 hover:bg-slate-100'}`}
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className={`p-1 rounded ${isDarkMode ? 'text-red-400 hover:bg-gray-700' : 'text-red-600 hover:bg-slate-100'}`}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => startEditTag(tag)}
                          className={`p-1 rounded ${isDarkMode ? 'text-gray-400 hover:text-blue-400 hover:bg-gray-700' : 'text-slate-500 hover:text-blue-600 hover:bg-slate-100'}`}
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleRemoveTag(tag.id)}
                          className={`p-1 rounded ${isDarkMode ? 'text-gray-400 hover:text-red-400 hover:bg-gray-700' : 'text-slate-500 hover:text-red-600 hover:bg-slate-100'}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className={`rounded-lg p-8 text-center border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex flex-col items-center">
              <div className={`p-4 rounded-full mb-4 ${isDarkMode ? 'bg-gray-700' : 'bg-slate-100'}`}>
                <Tag size={24} className={`${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`} />
              </div>
              <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-gray-100' : 'text-slate-800'}`}>No tags found</h3>
              <p className={`text-sm max-w-md ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                {searchQuery
                  ? `No tags match your search "${searchQuery}"`
                  : 'No tags available in this category. Create a new tag to get started.'}
              </p>
              {!isCreatingTag && (
                <button
                  onClick={() => setIsCreatingTag(true)}
                  className={`mt-4 px-4 py-2 rounded-lg flex items-center gap-2 ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                >
                  <PlusCircle size={16} /> Create New Tag
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}