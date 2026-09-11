import { apiFetch } from '../../utils/apiClient';
import React, { useState, useEffect } from 'react';
import { Zap, PlusCircle, ToggleLeft, EyeOff, Copy } from 'lucide-react';
import SettingsSectionHeader from './SettingsSectionHeader';

import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import buttonStyles from '../ui/Button.module.css';
import noticeStyles from '../ui/Notice.module.css';
const Toggle = ({ checked, onChange, label, icon: Icon, description }) => (
  <div className={`${formStyles.choiceCard} ${checked ? formStyles.choiceCardSelected : ''}`}>
    <div className="row grow">
      <Icon className="iconMedium" />
      <div className="grow">
        <h4 className={cardStyles.title}>{label}</h4>
        <p className="mutedText smallText">{description}</p>
      </div>
    </div>
    <label className={formStyles.switch}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className={formStyles.switchTrack} aria-hidden="true"><span className={formStyles.switchThumb} /></span>
    </label>
  </div>
);
const HallucinationsSection = ({ globalSettings = {}, handleGlobalChange = () => {} }) => {
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
    <div className="stack stackLarge">
      <SettingsSectionHeader
        icon={EyeOff}
        title="Audio post processing"
        description="Manage hallucination detection and filtering settings for audio transcriptions"
        iconColor="purple"
      />
      
      <div
        className={cardStyles.card}
      >
        <div >

        {/* Content Filtering Section */}
        <div className={cardStyles.card}>
          <div >
            <h3 className={cardStyles.title}>
              Content Filtering
            </h3>
            <p className="mutedText smallText">
              Control how hallucination filtering works in your transcriptions
            </p>
          </div>
          <Toggle
            checked={globalSettings.global_hallucination}
            onChange={(checked) => handleGlobalChange("global_hallucination", checked)}
            label="Hide Hallucinations"
            icon={ToggleLeft}
            description="When enabled, automatically filters out AI-generated text that doesn't match the actual audio. This helps remove false transcriptions and improves accuracy."
              />
          <Toggle
            checked={globalSettings.global_show_duplicate_files}
            onChange={(checked) => handleGlobalChange("global_show_duplicate_files", checked)}
            label="Show Duplicate Files"
            icon={Copy}
            description="Display duplicate audio files in the inbox. When disabled, duplicates are hidden by default."
              />
        </div>

        {/* Error Message */}
        {error && (
          <div className={`${noticeStyles.notice} ${noticeStyles.error}`}>
            {error}
          </div>
        )}

        {/* Input Area */}
        <div
          className="rowWrap"
        >
          <div className="rowWrap">
            <input
              type="text"
              value={newHallucination}
              onChange={(e) => setNewHallucination(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && newHallucination.trim() && handleAddHallucination()}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Enter new hallucination pattern"
              className={formStyles.input}
            />
            <button
              onClick={handleAddHallucination}
              disabled={!newHallucination.trim()}
              aria-label="Add hallucination"
              className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
            >
              <PlusCircle size={18} />
              <span>Add</span>
            </button>
          </div>

        </div>

        {/* Hallucination Patterns Section */}
        <div >
          <div >
            <h3 className={cardStyles.title}>
              Hallucination Patterns
            </h3>
            <p className="mutedText smallText">
              Add patterns to detect potential hallucinations in transcriptions
            </p>
          </div>
          <h4 className={cardStyles.title}>
            {hallucinations.length > 0
              ? `${hallucinations.length} Pattern${hallucinations.length > 1 ? 's' : ''} Configured`
              : 'No hallucination patterns added yet'}
          </h4>

          {hallucinations.length > 0 ? (
            <div className="rowWrap">
              {hallucinations.map((hallucination, index) => (
                <div
                  key={`${hallucination.text}-${index}`}
                  className="row"
                >
                  <span>
                    {hallucination.text}
                    {(Array.isArray(hallucination.type) ? hallucination.type : []).includes('regex') && (
                      <span className="mutedText tinyText">[Hallucination]</span>
                    )}
                  </span>
                  <button
                    onClick={() => handleRemoveHallucination(hallucination)}
                    className={`${buttonStyles.button} ${buttonStyles.danger} ${buttonStyles.medium}`}
                    aria-label={`Remove hallucination ${hallucination.text}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div
              className="centeredContent mutedText smallText"
            >
              <p className="mutedText smallText">
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
