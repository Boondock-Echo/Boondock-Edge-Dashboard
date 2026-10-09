import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../utils/apiClient';
import { useAuth } from '../AuthContext';
import MFAReminderModal from '../MFAReminderModal';

const InboxMfaReminder = () => {
  const { user } = useAuth();
  const principal = user?.user ?? user;
  const [showReminder, setShowReminder] = useState(false);

  useEffect(() => {
    if (!principal?.id && !principal?.email && !principal?.username) return undefined;

    let mounted = true;
    const controller = new AbortController();

    const check = async () => {
      try {
        const response = await apiFetch('/mfa/status', { signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        if (
          mounted &&
          data.mfa_enforced &&
          !data.mfa_enabled &&
          sessionStorage.getItem('mfa_reminder_dismissed') !== 'true'
        ) {
          setShowReminder(true);
        }
      } catch {
        // MFA reminder failure must not block the inbox.
      }
    };

    void check();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [principal?.id, principal?.email, principal?.username]);

  return (
    <MFAReminderModal
      isOpen={showReminder}
      onClose={() => {
        setShowReminder(false);
        sessionStorage.setItem('mfa_reminder_dismissed', 'true');
      }}
      onSetup={() => {
        setShowReminder(false);
        sessionStorage.removeItem('mfa_reminder_dismissed');
      }}
      user={principal}
    />
  );
};

export default InboxMfaReminder;
