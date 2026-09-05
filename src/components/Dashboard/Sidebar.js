import React, { useState, useEffect } from "react";
import SidebarHeader from "./SidebarHeader";
import SidebarSearch from "./SidebarSearch";
import ChannelItem from "./ChannelItem";
import KeywordsSection from "./KeywordsSection";
import SidebarFooter from "./SidebarFooter";
import ChannelSettingsModal from "./ChannelSettingsModal";
import api from '../../utils/apiClient';

const TeamsSidebar = ({
  isDarkMode,
  toggleTheme,
  setIsDarkMode,
  channels,
  setChannels,
  activeChannels,
  setActiveChannels,
  activeKeywords,
  toggleKeyword,
  searchQuery,
  setSearchQuery,
  keywordCounts,
  channelMessageCounts,
  isMobile,
  closeSidebar,
  onDocumentationClick
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [keywordSectionHeight, setKeywordSectionHeight] = useState("max-h-96");

  useEffect(() => {
    try {
      const storedActiveChannels = JSON.parse(localStorage.getItem("activeChannels"));
      if (storedActiveChannels) setActiveChannels(storedActiveChannels);
    } catch (e) {
      localStorage.removeItem("activeChannels");
    }
  }, [setActiveChannels]);

  // Dynamic height calculation based on window size
  useEffect(() => {
    const calculateKeywordHeight = () => {
      const windowHeight = window.innerHeight;
      const isSmallScreen = windowHeight < 600;
      const isMediumScreen = windowHeight >= 600 && windowHeight < 800;
      const isLargeScreen = windowHeight >= 800;

      if (isSmallScreen) {
        setKeywordSectionHeight("max-h-48"); // 192px for small screens
      } else if (isMediumScreen) {
        setKeywordSectionHeight("max-h-64"); // 256px for medium screens
      } else {
        setKeywordSectionHeight("max-h-96"); // 384px for large screens
      }
    };

    calculateKeywordHeight();
    window.addEventListener('resize', calculateKeywordHeight);
    
    return () => window.removeEventListener('resize', calculateKeywordHeight);
  }, []);

  const handleToggleChannel = (channelId) => {
    setActiveChannels((prev) => {
      const updatedChannels = { ...prev, [channelId]: !prev[channelId] };
      localStorage.setItem("activeChannels", JSON.stringify(updatedChannels));
      return updatedChannels;
    });
  };

  const handleSettingsClick = (channel) => {
    setSelectedChannel(channel);
    setIsSettingsOpen(true);
  };

  const handleSave = async (channelId, updatedChannel) => {
    setIsSaving(true);
    try {
      const response = await api.put(`/channel/${channelId}`, updatedChannel);
      if (response.data) {
        setChannels((prevChannels) => ({
          ...prevChannels,
          [channelId]: { ...prevChannels[channelId], ...updatedChannel },
        }));
      }
      setIsSettingsOpen(false);
    } catch (error) {
      console.error("Error updating channel:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeywordClick = (keyword) => toggleKeyword(keyword);

  return (
    <div
      className={`flex h-full max-h-screen flex-col overflow-y-auto border-r transition-colors duration-300 ${
        isDarkMode ? "border-slate-800 bg-slate-900" : "border-slate-200/70 bg-slate-50"
      } ${isMobile ? "w-full" : "w-72"}`}
    >
      <SidebarHeader 
        isDarkMode={isDarkMode} 
        toggleTheme={toggleTheme}
        isMobile={isMobile}
        closeSidebar={closeSidebar}
      />
      <SidebarSearch 
        searchQuery={searchQuery} 
        setSearchQuery={setSearchQuery} 
        isDarkMode={isDarkMode}
      />

      <div className={`flex-grow overflow-hidden px-6 pb-6 ${isDarkMode ? "dark-mode-scrollbar" : ""}`}>
        <div className="mb-4 mt-2">
          <h3
            className={`mb-3 text-xs font-semibold ${
              isDarkMode ? "text-slate-400" : "text-slate-600"
            }`}
          >
            Channels
          </h3>
          <div className="max-h-60 space-y-3 overflow-y-auto pr-1">
            {Object.entries(channels).map(([channelId, channel]) => (
              <ChannelItem
                key={channelId}
                channel={channel}
                isActive={activeChannels[channelId]}
                channelMessageCounts={channelMessageCounts}
                isDarkMode={isDarkMode}
                handleToggleChannel={() => handleToggleChannel(channelId)}
                handleSettingsClick={handleSettingsClick}
              />
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <h3
            className={`mb-3 text-xs font-semibold ${
              isDarkMode ? "text-slate-400" : "text-slate-600"
            }`}
          >
            Keywords
          </h3>
          <KeywordsSection
            keywordCounts={keywordCounts}
            activeKeywords={activeKeywords}
            handleKeywordClick={handleKeywordClick}
            isDarkMode={isDarkMode}
            maxHeightClass={keywordSectionHeight}
          />
        </div>

        
      </div>

      <SidebarFooter isDarkMode={isDarkMode} />
      <ChannelSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        channel={selectedChannel}
        onSave={handleSave}
        isSaving={isSaving}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

export default TeamsSidebar;