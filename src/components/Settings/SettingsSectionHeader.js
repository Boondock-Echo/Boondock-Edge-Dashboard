import React from 'react';

const SettingsSectionHeader = ({ icon: Icon, title, description, isDarkMode, iconColor = 'blue' }) => {
  const colorClasses = {
    blue: isDarkMode ? 'bg-blue-600' : 'bg-blue-500',
    purple: isDarkMode ? 'bg-purple-600' : 'bg-purple-500',
    green: isDarkMode ? 'bg-green-600' : 'bg-green-500',
    red: isDarkMode ? 'bg-red-600' : 'bg-red-500',
    orange: isDarkMode ? 'bg-orange-600' : 'bg-orange-500',
    gray: isDarkMode ? 'bg-gray-600' : 'bg-gray-500',
  };

  const containerClasses = isDarkMode
    ? 'bg-gray-900/60 border border-gray-800'
    : 'bg-gray-50 border border-gray-200';

  return (
    <div className={`rounded-lg shadow-sm p-4 transition-all duration-300 ${containerClasses}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[iconColor]}`}>
          <Icon size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
            {title}
          </h2>
          <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {description}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsSectionHeader;

