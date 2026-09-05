import React from 'react';
import F1TerminalLogs from './F1TerminalLogs';

const LogsPage = ({ timezone, timeFormat }) => {
  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-mono text-gray-100">Logs</h1>
          <p className="text-gray-400 font-mono">Real-time system monitoring and telemetry</p>
        </div>

        <F1TerminalLogs timezone={timezone} timeFormat={timeFormat} />
      </div>
    </div>
  );
};

export default LogsPage;