import { apiFetch } from '../../utils/apiClient';
import React, { useState, useEffect, useCallback } from 'react';

import { X, AlertCircle, AlertTriangle, Info, WifiOff } from 'lucide-react';



const NotificationBanner = ({ isDarkMode }) => {

  const [visibleNotification, setVisibleNotification] = useState(null);

  const [stackedCount, setStackedCount] = useState(0);



  const fetchNotifications = useCallback(async () => {

    try {

      const response = await apiFetch(`/notifications`);

      if (!response.ok) throw new Error('Failed to fetch notifications');

      const data = await response.json();

      

      const allNotifications = data.notifications || [];

      

      // Separate stacked and non-stacked notifications

      const stacked = allNotifications.filter(n => n.mode === 'stacked');

      const nonStacked = allNotifications.filter(n => n.mode !== 'stacked');

      

      // For stacked, show the first visible one

      const visibleStacked = stacked.find(n => n.is_visible !== false) || stacked[0];

      

      // Combine: show visible stacked first, then non-stacked

      const toDisplay = [];

      if (visibleStacked) {

        toDisplay.push(visibleStacked);

      }

      toDisplay.push(...nonStacked);

      

      setVisibleNotification(toDisplay[0] || null);

      setStackedCount(stacked.length);

    } catch (error) {

      console.error('Error fetching notifications:', error);

    }

  }, []);



  useEffect(() => {

    fetchNotifications();

    // Poll every 5 seconds for new notifications

    const interval = setInterval(fetchNotifications, 5000);

    return () => clearInterval(interval);

  }, [fetchNotifications]);



  const handleClear = useCallback(async (notificationId) => {

    try {

      const response = await apiFetch(`/notifications/${notificationId}`, {

        method: 'DELETE'

      });

      if (!response.ok) throw new Error('Failed to clear notification');

      

      // Refresh notifications

      await fetchNotifications();

    } catch (error) {

      console.error('Error clearing notification:', error);

    }

  }, [fetchNotifications]);



  // Auto-dismiss temporary notifications

  useEffect(() => {

    if (visibleNotification && visibleNotification.mode === 'temporary') {

      const timer = setTimeout(() => {

        handleClear(visibleNotification.id);

      }, 10000); // 10 seconds

      return () => clearTimeout(timer);

    }

  }, [visibleNotification, handleClear]);



  const getIcon = (type) => {

    switch (type) {

      case 'system_error':

        return <AlertCircle className="w-5 h-5 text-red-600" />;

      case 'device_disconnection':

        return <WifiOff className="w-5 h-5 text-orange-600" />;

      case 'warning':

        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;

      case 'info':

        return <Info className="w-5 h-5 text-blue-600" />;

      default:

        return <Info className="w-5 h-5 text-gray-600" />;

    }

  };



  const getBackgroundColor = useCallback((type, isDarkMode) => {

    if (isDarkMode) {

      switch (type) {

        case 'system_error':

          return 'bg-red-900/20 border-red-700/30';

        case 'device_disconnection':

          return 'bg-orange-900/20 border-orange-700/30';

        case 'warning':

          return 'bg-yellow-900/20 border-yellow-700/30';

        case 'info':

          return 'bg-blue-900/20 border-blue-700/30';

        default:

          return 'bg-gray-900/20 border-gray-700/30';

      }

    } else {

      switch (type) {

        case 'system_error':

          return 'bg-red-50 border-red-200';

        case 'device_disconnection':

          return 'bg-orange-50 border-orange-200';

        case 'warning':

          return 'bg-yellow-50 border-yellow-200';

        case 'info':

          return 'bg-blue-50 border-blue-200';

        default:

          return 'bg-gray-50 border-gray-200';

      }

    }

  }, []);



  const getTextColor = useCallback((type, isDarkMode) => {

    if (isDarkMode) {

      switch (type) {

        case 'system_error':

          return 'text-red-300';

        case 'device_disconnection':

          return 'text-orange-300';

        case 'warning':

          return 'text-yellow-300';

        case 'info':

          return 'text-blue-300';

        default:

          return 'text-gray-300';

      }

    } else {

      switch (type) {

        case 'system_error':

          return 'text-red-800';

        case 'device_disconnection':

          return 'text-orange-800';

        case 'warning':

          return 'text-yellow-800';

        case 'info':

          return 'text-blue-800';

        default:

          return 'text-gray-800';

      }

    }

  }, []);



  if (!visibleNotification) {

    return null;

  }



  return (

    <div className={`sticky top-16 z-10 ${getBackgroundColor(visibleNotification.type, isDarkMode)} border-b px-4 py-2 flex items-center justify-between`}>

      <div className="flex items-center gap-3 flex-1">

        {getIcon(visibleNotification.type)}

        <div className="flex-1">

          <div className={`text-sm font-medium ${getTextColor(visibleNotification.type, isDarkMode)}`}>

            {visibleNotification.title}

          </div>

          <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>

            {visibleNotification.message}

          </div>

        </div>

        {stackedCount > 1 && (

          <div className={`text-xs px-2 py-1 rounded ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>

            {stackedCount} more

          </div>

        )}

      </div>

      <button

        onClick={() => handleClear(visibleNotification.id)}

        className={`ml-4 p-1 rounded hover:bg-opacity-20 ${getTextColor(visibleNotification.type, isDarkMode)} hover:opacity-80 transition-opacity`}

        aria-label="Clear notification"

      >

        <X className="w-4 h-4" />

      </button>

    </div>

  );

};



export default NotificationBanner;



