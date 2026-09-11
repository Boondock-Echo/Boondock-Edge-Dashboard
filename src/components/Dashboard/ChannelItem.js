import { useEffect, useState } from "react";
import { Info, Volume, Volume1, Volume2 } from "lucide-react";
import LiveAudioPopup from "./LiveAudioPopup";
import Button from "../ui/Button";
import formStyles from "../ui/Form.module.css";
import styles from "../ui/ChannelItem.module.css";

const ChannelItem = ({
  channel,
  isActive,
  channelMessageCounts,
  handleToggleChannel,
  handleSettingsClick,
}) => {
  const messageCount = channelMessageCounts[channel.id] || 0;
  const formattedCount = messageCount < 1000
    ? messageCount.toString()
    : `${(messageCount / 1000).toFixed(2)}K`;

  const [volumeIconIndex, setVolumeIconIndex] = useState(0);
  const [showLivePopup, setShowLivePopup] = useState(false);

  useEffect(() => {
    let interval;

    if (channel.status === "record_begin") {
      interval = setInterval(() => {
        setVolumeIconIndex((prev) => (prev + 1) % 3);
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [channel.status]);

  const VolumeIcons = [Volume, Volume1, Volume2];

  const StatusIcon = () => {
    switch (channel.status) {
      case "recording":
      case "record_begin": {
        const CurrentVolumeIcon = VolumeIcons[volumeIconIndex];
        return (
          <span className={styles.status} style={{ color: "var(--ui-success)" }}>
            <CurrentVolumeIcon className={styles.statusIcon} />
          </span>
        );
      }

      case "error":
      case "offline":
        return (
          <span className={styles.status} style={{ color: "var(--ui-danger)" }}>
            <Volume className={styles.statusIcon} />
            <span className={styles.slash} aria-hidden="true" />
          </span>
        );

      case "warning":
        return (
          <span className={styles.status} style={{ color: "var(--ui-warning)" }}>
            <Volume1 className={styles.statusIcon} />
            <span className={styles.halo} aria-hidden="true" />
          </span>
        );

      case "idle":
      case "record_end":
        return (
          <span className={styles.status} style={{ color: "var(--ui-muted)", opacity: 0.55 }}>
            <Volume2 className={styles.statusIcon} />
          </span>
        );

      case "online":
        return (
          <span className={styles.status} style={{ color: "var(--ui-success)" }}>
            <Volume2 className={styles.statusIcon} />
            <span className={styles.onlineDot} aria-hidden="true" />
          </span>
        );

      case "busy":
        return (
          <span className={`${styles.status} ${styles.busy}`} style={{ color: "var(--ui-warning)" }}>
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className={styles.busyDot}
                style={{ animationDelay: `${index * 0.2}s` }}
                aria-hidden="true"
              />
            ))}
          </span>
        );

      default:
        return (
          <span className={styles.status} style={{ color: "var(--ui-muted)", opacity: 0.55 }}>
            <Volume2 className={styles.statusIcon} />
          </span>
        );
    }
  };

  return (
    <div
      onClick={() => handleSettingsClick(channel)}
      className={`${styles.item} ${isActive ? styles.active : ""}`}
    >
      <div className={styles.info}>
        <label
          className={formStyles.switch}
          onClick={(event) => event.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isActive}
            onChange={() => handleToggleChannel(channel.id)}
            aria-label={`Toggle ${channel.name}`}
          />
          <span className={formStyles.switchTrack} aria-hidden="true">
            <span className={formStyles.switchThumb} />
          </span>
        </label>
        <span className={styles.name}>{channel.name}</span>
      </div>

      <div className={styles.controls}>
        <span className="pill pillAccent">
          {formattedCount}
        </span>

        <StatusIcon />

        {channel.mac && (
          <Button
            size="icon"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              handleSettingsClick(channel);
            }}
            title="Channel Settings"
            aria-label={`Settings for ${channel.name}`}
          >
            <Info size={16} />
          </Button>
        )}

        {channel.audio_stream_enabled && (
          <Button
            size="small"
            variant="danger"
            onClick={(event) => {
              event.stopPropagation();
              setShowLivePopup(true);
            }}
            title="Play live audio"
          >
            Live
          </Button>
        )}
      </div>

      {showLivePopup && (
        <LiveAudioPopup
          channel={channel}
          onClose={() => setShowLivePopup(false)}
        />
      )}
    </div>
  );
};

export default ChannelItem;
