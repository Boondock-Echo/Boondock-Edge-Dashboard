import React from "react";
import styles from "./Spinner.module.css";

export const Spinner = ({ label = "Loading", size = "medium" }) => (
  <span className={`${styles.spinner} ${styles[size]}`} role="status" aria-label={label} />
);
