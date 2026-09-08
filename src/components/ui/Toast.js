import styles from "./Toast.module.css";

const TYPE_CONFIG = {
  success: { className: styles.success, icon: "✓", role: "status" },
  error: { className: styles.error, icon: "!", role: "alert" },
  info: { className: styles.info, icon: "i", role: "status" },
};

/**
 * Display a short, theme-aware notification from UI code that cannot render
 * through React. Prefer the application's toast provider where it is available.
 */
export const showToast = (message, type = "success") => {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.info;
  const toast = document.createElement("div");
  const icon = document.createElement("span");
  const text = document.createElement("span");

  toast.className = `${styles.toast} ${config.className}`;
  toast.setAttribute("role", config.role);
  toast.setAttribute("aria-live", type === "error" ? "assertive" : "polite");

  icon.className = styles.icon;
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = config.icon;

  text.className = styles.message;
  text.textContent = String(message);

  toast.append(icon, text);
  document.body.appendChild(toast);

  const showTimer = window.setTimeout(() => {
    toast.classList.add(styles.visible);
  }, 100);
  const hideTimer = window.setTimeout(() => {
    toast.classList.remove(styles.visible);
    window.setTimeout(() => toast.remove(), 300);
  }, type === "error" ? 5000 : 3000);

  return () => {
    window.clearTimeout(showTimer);
    window.clearTimeout(hideTimer);
    toast.remove();
  };
};
