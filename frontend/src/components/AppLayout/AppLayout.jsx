import Icon from "../../pages/Overview/OverviewIcon.jsx";
import styles from "./AppLayout.module.css";
import Topbar from "./Topbar.jsx";

const navigationItems = [
  { page: "home", href: "/", icon: "home", label: "Home" },
  {
    page: "overview",
    href: "/overview",
    icon: "chart",
    label: "Live overview",
  },
  { page: "ai", href: "/ai", icon: "sparkles", label: "Receipt inbox" },
];

const pageStatuses = {
  home: "Mock records · sample metrics",
  overview: "Mock records · live measurements",
  ai: "Perceptron · Gemini",
};

function Sidebar({ activePage, sidebarFooter }) {
  return (
    <aside className={styles.sidebar} aria-label="Main navigation">
      <a className={styles.brand} href="/">
        <span className={styles.brandMark}>
          <Icon name="workflow" size={23} />
        </span>
        <span>Mise</span>
      </a>
      <p className={styles.navLabel}>Workspace</p>
      <nav className={styles.navigation}>
        {navigationItems.map(({ page, href, icon, label }) => {
          const isActive = activePage === page;
          return (
            <a
              key={page}
              className={`${styles.navItem}${isActive ? ` ${styles.navActive}` : ""}`}
              href={href}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon name={icon} />
              {label}
            </a>
          );
        })}
      </nav>
      {sidebarFooter && (
        <div className={styles.sidebarBottom}>
          <div className={styles.workspaceNote}>{sidebarFooter}</div>
        </div>
      )}
    </aside>
  );
}

export default function AppLayout({ activePage, sidebarFooter, children }) {
  const currentPage = navigationItems.find(({ page }) => page === activePage);

  return (
    <div className={styles.layout}>
      <Sidebar activePage={activePage} sidebarFooter={sidebarFooter} />
      <div className={styles.pageContent}>
        <Topbar title={currentPage?.label} status={pageStatuses[activePage]} />
        {children}
      </div>
    </div>
  );
}
