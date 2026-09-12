import React from 'react';
import F1TerminalLogs from './F1TerminalLogs';
import pageStyles from '../ui/Page.module.css';

const LogsPage = () => {
  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.container}>
        <div className={pageStyles.header}>
          <div>
            <h1 className={pageStyles.title}>Logs</h1>
            <p className={pageStyles.subtitle}>Real-time system monitoring and telemetry</p>
          </div>
        </div>

        <F1TerminalLogs />
      </div>
    </div>
  );
};

export default LogsPage;
