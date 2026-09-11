import React, { useState, useEffect } from "react";
import SidebarHeader from "./SidebarHeader";
import SidebarSearch from "./SidebarSearch";
import ChannelItem from "./ChannelItem";
import KeywordsSection from "./KeywordsSection";
import SidebarFooter from "./SidebarFooter";
import ChannelSettingsModal from "./ChannelSettingsModal";
import api from '../../utils/apiClient';
import styles from '../ui/Sidebar.module.css';

const TeamsSidebar = ({
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
  const [keywordSectionHeight, setKeywordSectionHeight] = useState(styles.keywordScrollLarge);

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
        setKeywordSectionHeight(styles.keywordScrollSmall); // 192px for small screens
      } else if (isMediumScreen) {
        setKeywordSectionHeight(styles.keywordScrollMedium); // 256px for medium screens
      } else {
        setKeywordSectionHeight(styles.keywordScrollLarge); // 384px for large screens
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
    <div className={`${styles.sidebar}${isMobile ? ` ${styles.mobile}` : ''}`}>
      <SidebarHeader 
        isMobile={isMobile}
        closeSidebar={closeSidebar}
      />
      <SidebarSearch 
        searchQuery={searchQuery} 
        setSearchQuery={setSearchQuery}
      />

      <div className={styles.content}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            Channels
          </h3>
          <div className={styles.channelList}>
            {Object.entries(channels).map(([channelId, channel]) => (
              <ChannelItem
                key={channelId}
                channel={channel}
                isActive={activeChannels[channelId]}
                channelMessageCounts={channelMessageCounts}
                handleToggleChannel={() => handleToggleChannel(channelId)}
                handleSettingsClick={handleSettingsClick}
              />
            ))}
          </div>
        </div>

        <div className={styles.sectionGrow}>
          <h3 className={styles.sectionTitle}>
            Keywords
          </h3>
          <KeywordsSection
            keywordCounts={keywordCounts}
            activeKeywords={activeKeywords}
            handleKeywordClick={handleKeywordClick}
            maxHeightClass={keywordSectionHeight}
          />
        </div>

        
      </div>

      <SidebarFooter />
      <ChannelSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        channel={selectedChannel}
        onSave={handleSave}
        isSaving={isSaving}
      />
    </div>
  );
};

export default TeamsSidebar;
