import { apiFetch } from '../../utils/apiClient';
import React, { useState, useEffect } from 'react';
import { Zap, PlusCircle, ToggleLeft, EyeOff, Copy } from 'lucide-react';
import SettingsSectionHeader from './SettingsSectionHeader';

const Toggle = ({ checked, onChange, label, icon: Icon, description, isDarkMode }) => (
  <div className="group relative">
    <button
      onClick={() => onChange(!checked)}
      className={`w-full p-5 rounded-xl border-2 transition-all duration-300 transform hover:scale-102 ${
        checked 
          ? isDarkMode
            ? 'bg-blue-900/30 border-blue-400 shadow-lg'
            : 'bg-blue-50 border-blue-500 shadow-lg'
          : isDarkMode
            ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
            : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className={`p-3 rounded-xl transition-all duration-300 ${
            checked 
              ? isDarkMode 
                ? 'bg-blue-500/20 shadow-inner' 
                : 'bg-blue-500 shadow-inner'
              : isDarkMode 
                ? 'bg-gray-700' 
                : 'bg-gray-100'
          }`}>
            <Icon size={24} className={checked 
              ? isDarkMode 
                ? 'text-blue-300' 
                : 'text-white'
              : isDarkMode 
                ? 'text-gray-400' 
                : 'text-gray-500'
            } />
          </div>
          <div className="text-left">
            <h4 className={`font-semibold text-lg ${
              isDarkMode 
                ? checked 
                  ? 'text-blue-300' 
                  : 'text-gray-300'
                : checked 
                  ? 'text-blue-900' 
                  : 'text-gray-700'
            }`}>
              {label}
            </h4>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {description}
            </p>
          </div>
        </div>
        <div className="relative">
          <div className={`w-12 h-6 rounded-full transition-colors duration-300 ${
            checked 
              ? isDarkMode 
                ? 'bg-blue-500' 
                : 'bg-blue-500'
              : isDarkMode 
                ? 'bg-gray-700' 
                : 'bg-gray-200'
          }`}>
            <div className={`absolute w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 top-0.5 ${
              checked ? 'translate-x-6 left-1' : 'translate-x-0 left-1'
            }`} />
          </div>
        </div>
      </div>
    </button>
  </div>
);

const HallucinationsSection = ({ isDarkMode, globalSettings = {}, handleGlobalChange = () => {} }) => {
  const [hallucinations, setHallucinations] = useState([]);
  const [newHallucination, setNewHallucination] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isRegex, setIsRegex] = useState(false);
  const [isWildcard, setIsWildcard] = useState(false);
  const [error, setError] = useState(null);

  // Fetch existing hallucinations on component mount
  useEffect(() => {
    const fetchHallucinations = async () => {
      try {
        const response = await apiFetch(`/hallucinations`);
        if (!response.ok) {
          throw new Error('Failed to fetch hallucinations');
        }
        const data = await response.json();
        setHallucinations(data);
      } catch (err) {
        console.error('Error fetching hallucinations:', err);
        setError('Failed to load hallucinations');
      }
    };
    fetchHallucinations();
  }, []);

  const handleAddHallucination = async () => {
    if (!newHallucination.trim()) return;

    const hallucinationObj = {
      text: newHallucination,
      type: ['regex'], // Always use regex type for hallucinations
      created_by: 'user', // Replace with actual user if available
    };

    try {
      const response = await apiFetch(`/hallucinations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(hallucinationObj),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add hallucination');
      }

      const newHallucinationFromServer = await response.json();
      setHallucinations([...hallucinations, newHallucinationFromServer]);
      setNewHallucination('');
      setError(null);
    } catch (err) {
      console.error('Error adding hallucination:', err);
      setError(err.message);
    }
  };

  const handleRemoveHallucination = async (hallucinationToRemove) => {
    try {
      const response = await apiFetch(`/hallucinations/${hallucinationToRemove.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete hallucination');
      }

      setHallucinations(
        hallucinations.filter((h) => h.id !== hallucinationToRemove.id)
      );
      setError(null);
    } catch (err) {
      console.error('Error deleting hallucination:', err);
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsSectionHeader
        icon={EyeOff}
        title="Audio post processing"
        description="Manage hallucination detection and filtering settings for audio transcriptions"
        isDarkMode={isDarkMode}
        iconColor="purple"
      />
      
      <div
        className={`rounded-2xl shadow-lg transition-all duration-300 border ${
          isDarkMode
            ? 'bg-gray-900/60 border-gray-800'
            : 'bg-white border-gray-200'
        }`}
      >
        <div className="p-8">

        {/* Content Filtering Section */}
        <div className={`mb-8 p-6 rounded-xl border-2 transition-all duration-300 ${
          isDarkMode
            ? 'bg-slate-800/50 border-slate-700'
            : 'bg-white border-slate-200'
        }`}>
          <div className="mb-4">
            <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              Content Filtering
            </h3>
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Control how hallucination filtering works in your transcriptions
            </p>
          </div>
          <Toggle
            checked={globalSettings.global_hallucination}
            onChange={(checked) => handleGlobalChange("global_hallucination", checked)}
            label="Hide Hallucinations"
            icon={ToggleLeft}
            description="When enabled, automatically filters out AI-generated text that doesn't match the actual audio. This helps remove false transcriptions and improves accuracy."
            isDarkMode={isDarkMode}
          />
          <Toggle
            checked={globalSettings.global_show_duplicate_files}
            onChange={(checked) => handleGlobalChange("global_show_duplicate_files", checked)}
            label="Show Duplicate Files"
            icon={Copy}
            description="Display duplicate audio files in the inbox. When disabled, duplicates are hidden by default."
            isDarkMode={isDarkMode}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-700">
            {error}
          </div>
        )}

        {/* Input Area */}
        <div
          className={`flex flex-col gap-3 p-1 rounded-xl transition-all duration-300 ${
            isFocused ? (isDarkMode ? 'bg-slate-700/50' : 'bg-purple-50/50') : ''
          }`}
        >
          <div className="flex gap-3">
            <input
              type="text"
              value={newHallucination}
              onChange={(e) => setNewHallucination(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && newHallucination.trim() && handleAddHallucination()}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Enter new hallucination pattern"
              className={`flex-1 p-3 rounded-lg transition-all duration-300 ${
                isDarkMode
                  ? 'bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 focus:border-purple-500/70'
                  : 'bg-white border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-purple-400/70'
              } focus:outline-none`}
            />
            <button
              onClick={handleAddHallucination}
              disabled={!newHallucination.trim()}
              aria-label="Add hallucination"
              className={`px-5 py-3 rounded-lg flex items-center gap-2 font-medium transition-all duration-300 ${
                newHallucination.trim()
                  ? isDarkMode
                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                    : 'bg-purple-500 hover:bg-purple-600 text-white'
                  : isDarkMode
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <PlusCircle size={18} />
              <span>Add</span>
            </button>
          </div>

        </div>

        {/* Hallucination Patterns Section */}
        <div className="mt-6">
          <div className="mb-4">
            <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              Hallucination Patterns
            </h3>
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Add patterns to detect potential hallucinations in transcriptions
            </p>
          </div>
          <h4 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {hallucinations.length > 0
              ? `${hallucinations.length} Pattern${hallucinations.length > 1 ? 's' : ''} Configured`
              : 'No hallucination patterns added yet'}
          </h4>

          {hallucinations.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {hallucinations.map((hallucination, index) => (
                <div
                  key={`${hallucination.text}-${index}`}
                  className={`group px-4 py-2 rounded-full flex items-center gap-2 transition-all duration-300 ${
                    isDarkMode
                      ? 'bg-slate-800/80 border border-slate-700 hover:border-purple-500/50'
                      : 'bg-white border border-slate-200 hover:border-purple-400/50 hover:shadow-sm'
                  }`}
                >
                  <span className={`font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    {hallucination.text}
                    {(Array.isArray(hallucination.type) ? hallucination.type : []).includes('regex') && (
                      <span className="ml-1 text-xs text-purple-500">[Hallucination]</span>
                    )}
                  </span>
                  <button
                    onClick={() => handleRemoveHallucination(hallucination)}
                    className={`flex items-center justify-center w-5 h-5 rounded-full ${
                      isDarkMode
                        ? 'text-slate-500 hover:text-white hover:bg-red-500'
                        : 'text-slate-400 hover:text-white hover:bg-red-500'
                    } transition-colors duration-300`}
                    aria-label={`Remove hallucination ${hallucination.text}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div
              className={`text-center py-10 rounded-xl ${
                isDarkMode ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-50 border border-dashed border-slate-200'
              }`}
            >
              <p className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Add hallucination patterns to detect potential errors in your transcriptions
              </p>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default HallucinationsSection;
