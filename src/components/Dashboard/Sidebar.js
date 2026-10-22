import React, { useState, useEffect } from "react";
import SidebarHeader from "./SidebarHeader";
import SidebarSearch from "./SidebarSearch";
import ChannelItem from "./ChannelItem";
import KeywordsSection from "./KeywordsSection";
import SidebarFooter from "./SidebarFooter";
import ChannelSettingsModal from "./ChannelSettingsModal";
import api from '../../utils/apiClient';
import styles from '../ui/Sidebar.module.css';
import { useInboxChannels, useInboxKeywords, useInboxLayout } from "../InboxContext";

const Sidebar = () => {
  const {
    channels,
    activeChannels,
    channelMessageCounts,
    toggleChannel,
    replaceChannel,
  } = useInboxChannels();
  const { searchQuery, setSearchQuery } = useInboxKeywords();
  const { isMobile, setIsSidebarOpen } = useInboxLayout();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [keywordSectionHeight, setKeywordSectionHeight] = useState(styles.keywordScrollLarge);

  useEffect(() => {
    const calculateKeywordHeight = () => {
      const windowHeight = window.innerHeight;
      if (windowHeight < 600) {
        setKeywordSectionHeight(styles.keywordScrollSmall);
      } else if (windowHeight < 800) {
        setKeywordSectionHeight(styles.keywordScrollMedium);
      } else {
        setKeywordSectionHeight(styles.keywordScrollLarge);
      }
    };

    calculateKeywordHeight();
    window.addEventListener('resize', calculateKeywordHeight);
    return () => window.removeEventListener('resize', calculateKeywordHeight);
  }, []);

  const handleSettingsClick = (channel) => {
    setSelectedChannel(channel);
    setIsSettingsOpen(true);
  };

  const handleSave = async (channelId, updatedChannel) => {
    setIsSaving(true);
    try {
      const response = await api.patch(`/channels/${channelId}`, updatedChannel);
      const saved = response.data?.channel || updatedChannel;
      replaceChannel(channelId, saved);
      setSelectedChannel((previous) => previous ? { ...previous, ...saved } : previous);
      setIsSettingsOpen(false);
    } catch (error) {
      console.error("Error updating channel:", error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`${styles.sidebar}${isMobile ? ` ${styles.mobile}` : ''}`}>
      <SidebarHeader
        isMobile={isMobile}
        closeSidebar={() => setIsSidebarOpen(false)}
      />

      <SidebarSearch
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      <div className={styles.content}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Channels</h3>
          <div className={styles.channelList}>
            {Object.entries(channels).map(([channelId, channel]) => (
              <ChannelItem
                key={channelId}
                channel={channel}
                isActive={activeChannels[channelId] !== false}
                channelMessageCounts={channelMessageCounts}
                handleToggleChannel={() => toggleChannel(channelId)}
                handleSettingsClick={handleSettingsClick}
              />
            ))}
          </div>
        </div>

        <div className={styles.sectionGrow}>
          <h3 className={styles.sectionTitle}>Keywords</h3>
          <KeywordsSection maxHeightClass={keywordSectionHeight} />
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

export default Sidebar;
