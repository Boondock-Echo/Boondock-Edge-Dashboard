import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import cardStyles from '../ui/Card.module.css';

const ReleasePackageUpload = ({ versionPath = '/version' }) => {
  const { user } = useAuth();
  if ((user?.user ?? user)?.role !== 'admin') return null;
  return (
    <section className={cardStyles.card}>
      <h2 className={cardStyles.title}>Software updates</h2>
      <p>Choose API and dashboard releases independently, or restore an available backup.</p>
      <Link to={versionPath}>Manage software versions and backups</Link>
    </section>
  );
};
export default ReleasePackageUpload;
