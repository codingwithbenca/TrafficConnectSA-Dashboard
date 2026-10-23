import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  CalendarDays,
  CarFront,
  ChevronDown,
  CircleHelp,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import DashboardOverview from "./DashboardOverview";
import AppointmentsDashboard from "./AppointmentsDashboard";
import "./Dashboard.css";
import Citizens from "./Citizens";
import ProfileChangeRequests from "./ProfileChangeRequests";
import VehicleRenewals from "./VehicleRenewals";
import VehicleApplications from "./VehicleApplications";
import OwnershipTransfers from "./OwnershipTransfers";

type StaffProfile = {
  email?: string;
  fullName?: string;
  role?: string;
  status?: string;
};

type DashboardLayoutProps = {
  staff: StaffProfile | null;
  onLogout: () => void;
};

const SIDEBAR_DEFAULT = 290;
const SIDEBAR_MIN = 240;
const SIDEBAR_MAX = 460;
const SIDEBAR_COLLAPSED = 80;

const navigationItems = [
  { label: "Overview", icon: LayoutDashboard, group: "WORKSPACE" },
  { label: "Citizens", icon: Users, group: "WORKSPACE" },
  { label: "Vehicle applications", icon: CarFront, group: "SERVICES" },
  { label: "Vehicle renewals", icon: RefreshCw, group: "SERVICES" },
  { label: "Change of ownership", icon: ArrowLeftRight, group: "SERVICES" },
  { label: "Appointments", icon: CalendarDays, group: "SERVICES" },
  { label: "Requests", icon: FileText, group: "SERVICES" },
];

const navigationGroups = ["WORKSPACE", "SERVICES"];

export default function DashboardLayout({
  staff,
  onLogout,
}: DashboardLayoutProps) {
  const [activeSection, setActiveSection] = useState("Overview");
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [isResizing, setIsResizing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Drag to resize the sidebar (mouse + touch)
  useEffect(() => {
    if (!isResizing) return;

    function clamp(value: number) {
      return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, value));
    }

    function handleMouseMove(event: MouseEvent) {
      setSidebarWidth(clamp(event.clientX));
    }

    function handleTouchMove(event: TouchEvent) {
      if (event.touches[0]) {
        setSidebarWidth(clamp(event.touches[0].clientX));
      }
    }

    function stopResizing() {
      setIsResizing(false);
    }

    document.body.classList.add("resizing-sidebar");
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopResizing);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", stopResizing);

    return () => {
      document.body.classList.remove("resizing-sidebar");
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopResizing);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", stopResizing);
    };
  }, [isResizing]);

  // Escape closes the profile menu
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const activeItem = navigationItems.find(
    (item) => item.label === activeSection,
  );

  function renderContent() {
    if (activeSection === "Overview") {
      return <DashboardOverview staff={staff} onNavigate={setActiveSection} />;
    }

    if (activeSection === "Citizens") {
      return <Citizens />;
    }

    if (activeSection === "Appointments") {
      return <AppointmentsDashboard />;
    }

    if (activeSection === "Requests") {
      return <ProfileChangeRequests staff={staff} />;
    }

    if (activeSection === "Vehicle renewals") {
      return <VehicleRenewals staff={staff} />;
    }

    if (activeSection === "Vehicle applications") {
      return <VehicleApplications />;
    }

    if (activeSection === "Change of ownership") {
      return <OwnershipTransfers staff={staff} />;
    }

    return (
      <section className="module-placeholder">
        <div className="module-placeholder-icon">
          {activeItem && <activeItem.icon size={34} />}
        </div>
        <p className="page-eyebrow">
          TRAFFICCONNECT / {activeSection.toUpperCase()}
        </p>
        <h1>{activeSection}</h1>
        <p>This workspace is not available yet.</p>
        <button
          type="button"
          className="return-overview-button"
          onClick={() => setActiveSection("Overview")}
        >
          Return to overview
        </button>
      </section>
    );
  }

  return (
    <div
      className={`dashboard-shell ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as React.CSSProperties
      }
    >
      <header className="dashboard-topbar">
        <div className="topbar-brand">
          <div className="topbar-brand-icon">
            <ShieldCheck size={25} />
          </div>
          <div className="topbar-brand-copy">
            <strong>
              TrafficConnect <span>SA</span>
            </strong>
            <small>ADMINISTRATION PORTAL</small>
          </div>
        </div>

        <div className="topbar-divider" />

        <button
          type="button"
          className="topbar-sidebar-toggle"
          onClick={() => setSidebarCollapsed((current) => !current)}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <Menu size={21} /> : <PanelLeftClose size={21} />}
        </button>

        <div className="topbar-current-page">
          <span>Workspace</span>
          <span className="breadcrumb-chevron">/</span>
          <strong>{activeSection}</strong>
        </div>

        <div className="topbar-spacer" />

        <div className="topbar-secure-label">
          <ShieldCheck size={17} />
          <span>Secure session</span>
        </div>

        <div className="profile-menu-wrapper">
          <button
            type="button"
            className="profile-trigger"
            onClick={() => setProfileMenuOpen((current) => !current)}
            aria-expanded={profileMenuOpen}
          >
            <div className="profile-avatar">
              <UserRound size={20} />
            </div>
            <div className="profile-trigger-copy">
              <strong>{staff?.fullName || "Staff member"}</strong>
              <span>{staff?.role || "staff"}</span>
            </div>
            <ChevronDown size={17} />
          </button>

          {profileMenuOpen && (
            <div className="profile-dropdown">
              <div className="profile-dropdown-heading">
                <strong>{staff?.fullName || "Staff member"}</strong>
                <span>{staff?.email}</span>
              </div>
              <div className="profile-dropdown-divider" />
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  onLogout();
                }}
              >
                <LogOut size={17} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="dashboard-body">
        <aside
          className="dashboard-sidebar"
          style={{ width: sidebarCollapsed ? SIDEBAR_COLLAPSED : sidebarWidth }}
        >
          <div className="sidebar-section-label">
            {sidebarCollapsed ? (
              <span className="sidebar-label-dot" />
            ) : (
              "NAVIGATION"
            )}
          </div>

          <nav className="sidebar-navigation" aria-label="Dashboard navigation">
            {navigationGroups.map((group) => {
              const items = navigationItems.filter(
                (item) => item.group === group,
              );

              if (!items.length) return null;

              return (
                <div className="navigation-group" key={group}>
                  {!sidebarCollapsed && (
                    <div className="navigation-group-title">{group}</div>
                  )}

                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.label;

                    return (
                      <button
                        key={item.label}
                        type="button"
                        className={`navigation-item ${isActive ? "active" : ""}`}
                        onClick={() => setActiveSection(item.label)}
                        title={sidebarCollapsed ? item.label : undefined}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <Icon size={21} strokeWidth={isActive ? 2.2 : 1.8} />
                        {!sidebarCollapsed && <span>{item.label}</span>}
                        {!sidebarCollapsed && isActive && (
                          <span className="navigation-active-indicator" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          <div className="sidebar-bottom">
            <div className="sidebar-help-icon">
              <CircleHelp size={20} />
            </div>
            {!sidebarCollapsed && (
              <div className="sidebar-help-copy">
                <strong>Need assistance?</strong>
                <span>Contact your system administrator.</span>
              </div>
            )}
          </div>
        </aside>

        {!sidebarCollapsed && (
          <div
            className={`sidebar-resizer ${isResizing ? "resizing" : ""}`}
            role="separator"
            aria-label="Resize navigation sidebar (double-click to reset)"
            aria-orientation="vertical"
            aria-valuemin={SIDEBAR_MIN}
            aria-valuemax={SIDEBAR_MAX}
            aria-valuenow={sidebarWidth}
            tabIndex={0}
            title="Drag to resize · double-click to reset"
            onMouseDown={(event) => {
              event.preventDefault();
              setIsResizing(true);
            }}
            onTouchStart={() => setIsResizing(true)}
            onDoubleClick={() => setSidebarWidth(SIDEBAR_DEFAULT)}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                setSidebarWidth((width) => Math.max(SIDEBAR_MIN, width - 10));
              }
              if (event.key === "ArrowRight") {
                setSidebarWidth((width) => Math.min(SIDEBAR_MAX, width + 10));
              }
            }}
          >
            <span />
          </div>
        )}

        <main className="dashboard-main">
          <div className="workspace-toolbar">
            <div className="workspace-tab">
              {activeItem && <activeItem.icon size={17} />}
              <span>{activeSection}</span>
              <span className="workspace-tab-dot" />
            </div>
            <div className="workspace-toolbar-right">
              <span>TrafficConnect SA</span>
              <span className="toolbar-separator">·</span>
              <span>Admin workspace</span>
            </div>
          </div>

          <div className="workspace-content" key={activeSection}>
            {renderContent()}
          </div>

          <footer className="dashboard-statusbar">
            <div className="statusbar-left">
              <span>
                <ShieldCheck size={14} /> Authorized session
              </span>
              <span>Role: {staff?.role || "staff"}</span>
            </div>
            <div className="statusbar-right">
              <span>TrafficConnect SA</span>
              <span>Administration</span>
            </div>
          </footer>
        </main>
      </div>

      {isResizing && <div className="resize-cursor-overlay" />}
      <button
        type="button"
        className="mobile-sidebar-close"
        onClick={() => setSidebarCollapsed(true)}
        aria-label="Close sidebar"
      >
        <X size={18} />
      </button>
    </div>
  );
}