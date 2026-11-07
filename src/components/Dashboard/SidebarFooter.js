import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { LogOut } from "lucide-react";
import Button from '../ui/Button';
import styles from '../ui/Sidebar.module.css';

const SidebarFooter = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const principal = user?.user || user;
  const displayName = principal?.name?.trim()
    || principal?.username?.trim()
    || principal?.email?.trim()
    || "User";
  const [buildInfo, setBuildInfo] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${process.env.PUBLIC_URL || ''}/build-info.json`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load dashboard build information');
        return response.json();
      })
      .then((info) => {
        if (info.component === 'dashboard' && typeof info.version === 'string') {
          setBuildInfo(info);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(/\s+/)
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const appVersion = buildInfo?.version || 'Version unavailable';
  const releaseDate = buildInfo?.built_at?.split('T')[0];

  return (
    <div className={styles.footer}>
      <div className="rowBetween">
        <button
          type="button"
          onClick={() => navigate("/profile")}
          className={styles.profileButton}
          title="View profile"
        >
          <div className={styles.avatar}>
            {principal?.avatar ? (
              <img src={principal.avatar} alt="" />
            ) : (
              getInitials(displayName)
            )}
          </div>
          <div className={styles.profileText}>
            <span className={styles.profileName}>
              {displayName}
            </span>
            <span className={styles.version}>
              {releaseDate ? `${appVersion} | ${releaseDate}` : appVersion}
            </span>
          </div>
        </button>
        <Button
          type="button"
          onClick={() => logout()}
          variant="ghost"
          size="icon"
          title="Log out"
          aria-label="Log out"
        >
          <LogOut aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
};

export default SidebarFooter;
