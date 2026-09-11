import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import Button from '../ui/Button';
import formStyles from '../ui/Form.module.css';
import styles from '../ui/ColorPalettePicker.module.css';

const ColorPalettePicker = ({ 
  label, 
  color, 
  onChange
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const presetColors = [
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Amber', value: '#f59e0b' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Lime', value: '#84cc16' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Teal', value: '#14b8a6' },
    { name: 'Cyan', value: '#06b6d4' },
    { name: 'Sky', value: '#0ea5e9' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Violet', value: '#8b5cf6' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Fuchsia', value: '#d946ef' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Rose', value: '#f43f5e' },
    { name: 'Gray', value: '#6b7280' }
  ];

  return (
    <div className={formStyles.field}>
      <label className={formStyles.label}>{label}</label>
      
      <div className={styles.picker}>
        <div className="row">
          <Button onClick={() => setIsOpen(!isOpen)}>
            <span className={styles.currentSwatch} style={{ backgroundColor: color }} />
            <span>{color}</span>
            <ChevronDown size={16} />
          </Button>
          
          <input
            type="color"
            value={color}
            onChange={(e) => onChange(e.target.value)}
            className={styles.nativePicker}
          />
        </div>

        {isOpen && (
          <div className={styles.popover}>
            <div className={styles.swatches}>
              {presetColors.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => {
                    onChange(preset.value);
                    setIsOpen(false);
                  }}
                  className={styles.swatch}
                  style={{ backgroundColor: preset.value }}
                  aria-label={preset.name}
                >
                  {color === preset.value && <Check size={16} aria-hidden="true" />}
                </button>
              ))}
            </div>
            
            <input
              type="text"
              value={color}
              onChange={(e) => onChange(e.target.value)}
              className={formStyles.input}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ColorPalettePicker;