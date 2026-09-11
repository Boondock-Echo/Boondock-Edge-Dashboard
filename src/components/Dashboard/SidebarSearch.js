import React from "react";
import formStyles from '../ui/Form.module.css';
import styles from '../ui/Sidebar.module.css';

const SidebarSearch = ({ searchQuery, setSearchQuery }) => (
  <div className={styles.search}>
    <span className={`material-symbols-outlined ${styles.searchIcon}`} aria-hidden="true">
      search
    </span>
    <input
      type="text"
      placeholder="Search"
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className={`${formStyles.input} ${styles.searchInput}`}
    />
  </div>
);

export default SidebarSearch;
