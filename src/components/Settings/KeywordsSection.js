import React, { useState } from 'react';
import { Tag, PlusCircle, Siren } from 'lucide-react';
import SettingsSectionHeader from './SettingsSectionHeader';

const KeywordsSection = ({
  keywords = [],
  newKeyword = '',
  setNewKeyword,
  handleAddKeyword,
  handleRemoveKeyword,
  isDarkMode
}) => {
  const [isFocused, setIsFocused] = useState(false);
  
  return (
    <div className="space-y-6">
      <SettingsSectionHeader
        icon={Siren}
        title="Keywords"
        description="Add important words to highlight in transcriptions"
        isDarkMode={isDarkMode}
        iconColor="blue"
      />
      
      <div className={`rounded-2xl shadow-lg transition-all duration-300 border ${
        isDarkMode 
          ? 'bg-gray-900/60 border-gray-800' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="p-8">

        {/* Input Area */}
        <div className="space-y-6">
          <div className={`flex gap-3 p-1 rounded-xl transition-all duration-300 ${
            isFocused ? (isDarkMode ? 'bg-slate-700/50' : 'bg-blue-50/50') : ''
          }`}>
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && newKeyword.trim() && handleAddKeyword()}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Enter new keyword"
              className={`flex-1 p-3 rounded-lg transition-all duration-300 ${
                isDarkMode 
                  ? 'bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 focus:border-blue-500/70' 
                  : 'bg-white border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-blue-400/70'
              } focus:outline-none`}
            />
            <button
              onClick={handleAddKeyword}
              disabled={!newKeyword.trim()}
              aria-label="Add keyword"
              className={`px-5 py-3 rounded-lg flex items-center gap-2 font-medium transition-all duration-300 ${
                newKeyword.trim() 
                  ? isDarkMode
                    ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                  : isDarkMode
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <PlusCircle size={18} />
              <span>Add</span>
            </button>
          </div>

          {/* Keywords Display */}
          <div className="mt-6">
            <h3 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {keywords.length > 0 ? `${keywords.length} Keywords` : 'No keywords added yet'}
            </h3>
            
            {keywords.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {keywords.map((keyword, index) => (
                  <div
                    key={`${keyword}-${index}`}
                    className={`group px-4 py-2 rounded-full flex items-center gap-2 transition-all duration-300 ${
                      isDarkMode 
                        ? 'bg-slate-800/80 border border-slate-700 hover:border-blue-500/50' 
                        : 'bg-white border border-slate-200 hover:border-blue-400/50 hover:shadow-sm'
                    }`}
                  >
                    <span className={`font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      {keyword}
                    </span>
                    <button
                      onClick={() => handleRemoveKeyword(keyword)}
                      className={`flex items-center justify-center w-5 h-5 rounded-full ${
                        isDarkMode 
                          ? 'text-slate-500 hover:text-white hover:bg-red-500' 
                          : 'text-slate-400 hover:text-white hover:bg-red-500'
                      } transition-colors duration-300`}
                      aria-label={`Remove keyword ${keyword}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`text-center py-10 rounded-xl ${
                isDarkMode ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-50 border border-dashed border-slate-200'
              }`}>
                <p className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Add keywords to help identify important terms in your transcriptions
                </p>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default KeywordsSection;