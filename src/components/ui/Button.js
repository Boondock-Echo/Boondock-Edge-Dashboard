import React from "react";
import styles from "./Button.module.css";

const joinClasses = (...classes) => classes.filter(Boolean).join(" ");

/** A theme-aware application button with centralized visual variants. */
const Button = React.forwardRef(({
  children,
  className,
  size = "medium",
  variant = "secondary",
  type = "button",
  ...props
}, ref) => (
  <button
    ref={ref}
    type={type}
    className={joinClasses(styles.button, styles[size], styles[variant], className)}
    {...props}
  >
    {children}
  </button>
));

Button.displayName = "Button";

export default Button;
