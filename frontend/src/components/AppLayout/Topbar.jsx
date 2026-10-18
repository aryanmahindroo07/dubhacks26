import styles from "./Topbar.module.css";

export default function Topbar({ title, status }) {
  return (
    <header className={styles.topbar}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <span>Workspace</span>
        <span aria-hidden="true">/</span>
        <strong aria-current="page">{title}</strong>
      </nav>
      {status && <span className={styles.status}>{status}</span>}
    </header>
  );
}
