import React, { useState } from 'react';
import { Tag, PlusCircle, Siren } from 'lucide-react';
import SettingsSectionHeader from './SettingsSectionHeader';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';

const KeywordsSection = ({
  keywords = [],
  newKeyword = '',
  setNewKeyword,
  handleAddKeyword,
  handleRemoveKeyword
}) => {
  const [isFocused, setIsFocused] = useState(false);
  
  return (
    <div className="stackLarge">
      <SettingsSectionHeader
        icon={Siren}
        title="Keywords"
        description="Add important words to highlight in transcriptions"
        iconColor="blue"
      />
      
      <div className={cardStyles.card}>
        {/* Input Area */}
        <div className="stackLarge">
          <div className="row">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && newKeyword.trim() && handleAddKeyword()}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Enter new keyword"
              className={formStyles.input}
            />
            <Button
              onClick={handleAddKeyword}
              disabled={!newKeyword.trim()}
              aria-label="Add keyword"
              variant="primary"
            >
              <PlusCircle size={18} />
              <span>Add</span>
            </Button>
          </div>

          {/* Keywords Display */}
          <div className="stackCompact">
            <h3>{keywords.length > 0 ? `${keywords.length} Keywords` : 'No keywords added yet'}</h3>
            
            {keywords.length > 0 ? (
              <div className="rowWrap">
                {keywords.map((keyword, index) => (
                  <span key={`${keyword}-${index}`} className="pill">
                    <span>{keyword}</span>
                    <Button
                      onClick={() => handleRemoveKeyword(keyword)}
                      size="icon"
                      variant="danger"
                      aria-label={`Remove keyword ${keyword}`}
                    >
                      ×
                    </Button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="centeredContent">
                <p className={cardStyles.description}>
                  Add keywords to help identify important terms in your transcriptions
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeywordsSection;