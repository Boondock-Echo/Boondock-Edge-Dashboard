import { useState, useEffect } from "react";
import { Volume, Volume1, Volume2, Info } from "lucide-react";
import LiveAudioPopup from "./LiveAudioPopup";

const ChannelItem = ({ 
  channel, 
  isActive, 
  channelMessageCounts, 
  isDarkMode, 
  handleToggleChannel, 
  handleSettingsClick
}) => {
  const messageCount = channelMessageCounts[channel.id] || 0;
  const formattedCount = messageCount < 1000 ? messageCount.toString() : `${(messageCount / 1000).toFixed(2)}K`;
  
  // State for volume icon animation
  const [volumeIconIndex, setVolumeIconIndex] = useState(0);
  
  // State for live audio popup
  const [showLivePopup, setShowLivePopup] = useState(false);
  
  // Animation effect for volume icons when recording
  useEffect(() => {
    let interval;
    if (channel.status === 'record_begin') {
      interval = setInterval(() => {
        setVolumeIconIndex((prev) => (prev + 1) % 3);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [channel.status]);

  // Volume icons array for animation
  const VolumeIcons = [Volume, Volume1, Volume2];

  // Render the status already held in React's channel state.
  const StatusIcon = () => {
    const state = channel.status;
    
    switch (state) {
      case 'recording':
      case 'record_begin': {
        const CurrentVolumeIcon = VolumeIcons[volumeIconIndex];
        return (
          <div className="relative">
            <div className="relative">
              <CurrentVolumeIcon 
                className={`h-4 w-4 transition-all duration-300 ${
                  isDarkMode ? "text-green-400" : "text-green-600"
                }`}
              />
            </div>
          </div>
        );
      }
      case 'error': {
        return (
          <div className="relative">
            <Volume 
              className={`h-4 w-4 transition-colors duration-300 ${
                isDarkMode ? "text-red-400" : "text-red-500"
              }`}
            />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-px bg-red-500 rotate-45" />
          </div>
        );
      }
      case 'warning': {
        return (
          <div className="relative">
            <Volume1
              className={`h-4 w-4 transition-colors duration-300 ${
                isDarkMode ? "text-yellow-400" : "text-yellow-500"
              }`}
            />
            <div className="absolute -inset-1 rounded-full border border-yellow-400 opacity-50" />
          </div>
        );
      }
      case 'idle':
      case 'record_end':
        return (
          <div className="relative">
            <Volume2 
              className={`h-4 w-4 transition-colors duration-300 ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              } opacity-50`}
            />
          </div>
        );
      case 'offline':
        return (
          <div className="relative">
            <Volume 
              className={`h-4 w-4 transition-colors duration-300 ${
                isDarkMode ? "text-red-400" : "text-red-500"
              }`}
            />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-px bg-red-500 rotate-45" />
          </div>
        );
      case 'online':
        return (
          <div className="relative">
            <Volume2
              className={`h-4 w-4 transition-colors duration-300 ${
                isDarkMode ? "text-green-400" : "text-green-500"
              }`}
            />
            <div className="absolute -right-1 -top-1">
              <div className="h-1.5 w-1.5 rounded-full text-green-400 bg-current animate-pulse opacity-75" />
            </div>
          </div>
        );
      case 'busy':
        return (
          <div className="relative">
            <div className="right-0 top-0 flex space-x-0.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`w-1 h-1 rounded-full ${
                    isDarkMode ? "bg-amber-400" : "bg-amber-500"
                  }`}
                  style={{
                    animation: `bounce 1s ease-in-out infinite ${i * 0.2}s`
                  }}
                />
              ))}
            </div>
          </div>
        );
      default:
        // Default state: solid dark gray speaker icon
        return (
          <Volume2
            className={`h-4 w-4 ${isDarkMode ? "text-gray-600" : "text-gray-600"}`}
          />
        );
    }
  };

  return (
    <div
      onClick={() => handleSettingsClick(channel)}
      className={`group flex justify-between items-center p-2 rounded-md transition-all duration-300 cursor-pointer text-sm ${
        isDarkMode
          ? isActive
            ? "bg-gray-700/90 shadow-lg shadow-blue-800/10"
            : "hover:bg-gray-700/80"
          : isActive
            ? "bg-white/90 shadow-sm"
            : "hover:bg-gray-100/80"
      }`}
    >
      {/* Left: Toggle Switch + Channel Info */}
      <div className="flex items-center space-x-2 truncate min-w-0 flex-1">
        {/* Toggle Switch */}
        <label 
          className="relative inline-flex items-center flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <input 
            type="checkbox" 
            className="sr-only peer" 
            checked={isActive} 
            onChange={() => handleToggleChannel(channel.id)} 
          />
          <div className={`w-8 h-4 rounded-full peer transition-all duration-300 ${
            isDarkMode 
              ? "bg-gray-600 peer-checked:bg-blue-600" 
              : "bg-gray-300 peer-checked:bg-blue-500"
          } after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all after:duration-300 peer-checked:after:translate-x-4`} />
        </label>
        
        {/* Channel Name */}
        <span className={`truncate ${
          isDarkMode 
            ? (isActive ? "text-white" : "text-gray-400") 
            : (isActive ? "text-gray-800" : "text-gray-500")
        }`}>
          {channel.name}
        </span>
      </div>
      
      {/* Right: Stats and Controls */}
      <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-900/50 text-blue-300">
          {formattedCount}
        </span>
        
        <StatusIcon />

        {/* Channel Settings Button - opens settings modal in a single click */}
        {channel.mac && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSettingsClick(channel);
            }}
            className={`p-1.5 rounded transition-colors ${
              isDarkMode
                ? "text-gray-400 hover:text-blue-400 hover:bg-gray-700/50"
                : "text-gray-500 hover:text-blue-600 hover:bg-gray-100"
            }`}
            title="Channel Settings"
          >
            <Info className="h-4 w-4" />
          </button>
        )}

        {/* Live Button - Show only if audio_stream_enabled */}
        {channel.audio_stream_enabled && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowLivePopup(true);
            }}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
              isDarkMode
                ? "bg-red-900/50 hover:bg-red-800 text-red-300"
                : "bg-red-100 hover:bg-red-200 text-red-700"
            }`}
            title="Play live audio"
          >
            Live
          </button>
        )}
      </div>

      {/* Live Audio Popup Modal */}
      {showLivePopup && (
        <LiveAudioPopup
          channel={channel}
          isDarkMode={isDarkMode}
          onClose={() => setShowLivePopup(false)}
        />
      )}
    </div>
  );
};

export default ChannelItem;
