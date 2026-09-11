import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { LogOut } from "lucide-react";
import Button from '../ui/Button';
import styles from '../ui/Sidebar.module.css';

const SidebarFooter = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const appVersion = process.env.REACT_APP_VERSION || "v1.0.0";
  const releaseDate = process.env.REACT_APP_BUILD_DATE;

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
            {user?.avatar ? (
              <img src={user.avatar} alt="" />
            ) : (
              getInitials(user?.name || user?.username || "User")
            )}
          </div>
          <div className={styles.profileText}>
            <span className={styles.profileName}>
              {user?.name || user?.username || "Guest"}
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
