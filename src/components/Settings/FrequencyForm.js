import React from 'react';
import { X, Save } from 'lucide-react';
import Button from '../ui/Button';
import formStyles from '../ui/Form.module.css';
import { CTCSS_TONES, DCS_CODES } from "../tone-codes";

export const FrequencyForm = ({ 
  formData, 
  onSubmit, 
  onChange, 
  onClose, 
  mode
}) => (
  <form onSubmit={onSubmit} className={formStyles.form}>
    <div className={formStyles.field}>
      <label className={formStyles.label}>Name</label>
      <input
        type="text"
        name="name"
        value={formData.name}
        onChange={onChange}
        className={formStyles.input}
      />
    </div>
    {/* Rest of the form fields... */}
    <div className="rowBetween">
      <div />
      <div className="row">
        <Button type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          <Save size={16} />
          <span>{mode === 'create' ? 'Create' : 'Save Changes'}</span>
        </Button>
      </div>
    </div>
  </form>
);