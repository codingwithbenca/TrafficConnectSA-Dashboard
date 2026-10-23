import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeftRight,
  CalendarDays,
  CarFront,
  ChevronRight,
  FileText,
  RefreshCw,
  Users,
} from "lucide-react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";

type StaffProfile = {
  email?: string;
  fullName?: string;
  role?: string;
  status?: string;
};

type SourceState = {
  docs: any[];
  loading: boolean;
  error: boolean;
};

const DECIDED = [
  "approved",
  "accepted",
  "rejected",
  "declined",
  "completed",
  "cancelled",
  "canceled",
  "paid",
];

const isPending = (status?: string) =>
  !DECIDED.includes((status || "submitted").trim().toLowerCase());

// Live Firestore listener
function useLive(getQuery: () => any): SourceState {
  const [state, setState] = useState<SourceState>({
    docs: [],
    loading: true,
    error: false,
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(
      getQuery(),
      (snapshot: any) =>
        setState({
          docs: snapshot.docs.map((item: any) => ({
            id: item.id,
            ...item.data({ serverTimestamps: "estimate" }),
          })),
          loading: false,
          error: false,
        }),
      (error: any) => {
        console.error("[DashboardOverview] listener failed:", error);
        setState({ docs: [], loading: false, error: true });
      }
    );

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}

function formatDate(value: any): string {
  if (!value) return "";
  try {
    const date =
      typeof value.toDate === "function" ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-ZA", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "";
  }
}

export default function DashboardOverview({
  staff,
  onNavigate,
}: {
  staff?: StaffProfile | null;
  onNavigate: (section: string) => void;
}) {
  const citizens = useLive(() => query(collection(db, "citizens")));
  const registrations = useLive(() =>
    query(collection(db, "vehicleApplications"))
  );
  const ownership = useLive(() =>
    query(
      collection(db, "applications"),
      where("type", "==", "ownership_transfer")
    )
  );
  const renewals = useLive(() =>
    query(collection(db, "vehicleRenewalRequests"))
  );
  const appointments = useLive(() => query(collection(db, "appointments")));

  const pending = useMemo(
    () => ({
      registrations: registrations.docs.filter((d) => isPending(d.status))
        .length,
      ownership: ownership.docs.filter((d) => isPending(d.status)).length,
      renewals: renewals.docs.filter((d) => isPending(d.status)).length,
    }),
    [registrations.docs, ownership.docs, renewals.docs]
  );

  const recent = useMemo(() => {
    const rows = [
      ...registrations.docs.map((d) => ({
        id: `reg-${d.id}`,
        reference: d.applicationId || d.id,
        name: d.applicant?.fullName || "Name unavailable",
        kind: "Vehicle registration",
        section: "Vehicle applications",
        status: d.status,
        createdAt: d.createdAt,
      })),
      ...ownership.docs.map((d) => ({
        id: `own-${d.id}`,
        reference: d.applicationId || d.id,
        name: d.currentOwner?.fullName || "Name unavailable",
        kind: "Ownership transfer",
        section: "Change of ownership",
        status: d.status,
        createdAt: d.createdAt,
      })),
    ];

    return rows
      .sort(
        (a, b) =>
          (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
      )
      .slice(0, 6);
  }, [registrations.docs, ownership.docs]);

  const show = (source: SourceState, value: number) =>
    source.loading ? "…" : source.error ? "—" : value;

  const summaryCards = [
    {
      title: "Registered citizens",
      description: "Citizen records",
      icon: Users,
      value: show(citizens, citizens.docs.length),
      note: "Total",
      section: "Citizens",
    },
    {
      title: "Vehicle applications",
      description: "Registrations awaiting review",
      icon: CarFront,
      value: show(registrations, pending.registrations),
      note: `${registrations.docs.length} received`,
      section: "Vehicle applications",
    },
    {
      title: "Change of ownership",
      description: "Transfers awaiting review",
      icon: ArrowLeftRight,
      value: show(ownership, pending.ownership),
      note: `${ownership.docs.length} received`,
      section: "Change of ownership",
    },
    {
      title: "Vehicle renewals",
      description: "Renewals awaiting processing",
      icon: RefreshCw,
      value: show(renewals, pending.renewals),
      note: `${renewals.docs.length} received`,
      section: "Vehicle renewals",
    },
  ];

  const quickAccess = [
    {
      label: "Citizens",
      icon: Users,
      value: citizens.error ? "" : `${citizens.docs.length} total`,
    },
    {
      label: "Vehicle applications",
      icon: CarFront,
      value: registrations.error ? "" : `${pending.registrations} pending`,
      alert: pending.registrations > 0,
    },
    {
      label: "Vehicle renewals",
      icon: RefreshCw,
      value: renewals.error ? "" : `${pending.renewals} pending`,
      alert: pending.renewals > 0,
    },
    {
      label: "Change of ownership",
      icon: ArrowLeftRight,
      value: ownership.error ? "" : `${pending.ownership} pending`,
      alert: pending.ownership > 0,
    },
    {
      label: "Appointments",
      icon: CalendarDays,
      value: appointments.error ? "" : `${appointments.docs.length} booked`,
    },
    {
      label: "Requests",
      icon: FileText,
      value: "",
    },
  ];

  return (
    <div className="dashboard-overview">
      <div className="page-heading">
        <div>
          <p className="page-eyebrow">WORKSPACE / OVERVIEW</p>
          <h1>Dashboard overview</h1>
          <p className="page-description">
            {staff?.fullName
              ? `Welcome back, ${staff.fullName.split(" ")[0]}. `
              : "Welcome. "}
            Here is what needs your attention today.
          </p>
        </div>

        <div className="overview-status">
          <span className="status-dot" />
          Live data
        </div>
      </div>

      <section className="summary-grid" aria-label="System summary">
        {summaryCards.map((card) => {
          const Icon = card.icon;

          return (
            <button
              type="button"
              className="summary-card summary-card-link"
              key={card.title}
              onClick={() => onNavigate(card.section)}
            >
              <div className="summary-card-top">
                <div className="summary-icon">
                  <Icon size={21} />
                </div>
                <span className="summary-placeholder">{card.note}</span>
              </div>

              <h2>{card.value}</h2>
              <p className="summary-title">{card.title}</p>
              <p className="summary-description">{card.description}</p>
            </button>
          );
        })}
      </section>

      <section className="overview-lower-grid">
        <article className="workspace-panel">
          <div className="panel-heading">
            <div className="panel-heading-icon">
              <Activity size={19} />
            </div>
            <div>
              <h2>Recent activity</h2>
              <p>Latest registrations and ownership transfers.</p>
            </div>
          </div>

          {recent.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Activity size={25} />
              </div>
              <h3>No activity to display yet</h3>
              <p>New citizen submissions will appear here as they arrive.</p>
            </div>
          ) : (
            <div className="information-list">
              {recent.map((row) => {
                const key = (row.status || "submitted").trim().toLowerCase();
                const label = ["approved", "accepted"].includes(key)
                  ? "Approved"
                  : ["rejected", "declined"].includes(key)
                    ? "Rejected"
                    : "Pending";

                return (
                  <button
                    type="button"
                    key={row.id}
                    className="information-row overview-link-row"
                    onClick={() => onNavigate(row.section)}
                  >
                    <span className="overview-row-copy">
                      <strong>{row.name}</strong>
                      <small>
                        {row.kind} · {row.reference}
                      </small>
                    </span>

                    <span className="overview-row-meta">
                      <span
                        className={`overview-pill overview-pill-${label.toLowerCase()}`}
                      >
                        {label}
                      </span>
                      <small>{formatDate(row.createdAt)}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </article>

        <article className="workspace-panel">
          <div className="panel-heading">
            <div className="panel-heading-icon">
              <FileText size={19} />
            </div>
            <div>
              <h2>Quick access</h2>
              <p>Jump straight to a workspace.</p>
            </div>
          </div>

          <div className="information-list">
            {quickAccess.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  type="button"
                  key={item.label}
                  className="information-row overview-link-row"
                  onClick={() => onNavigate(item.label)}
                >
                  <span className="overview-row-label">
                    <Icon size={17} />
                    {item.label}
                  </span>

                  <span className="overview-row-meta">
                    {item.value && (
                      <span
                        className={`overview-pill ${
                          item.alert ? "overview-pill-pending" : ""
                        }`}
                      >
                        {item.value}
                      </span>
                    )}
                    <ChevronRight size={16} />
                  </span>
                </button>
              );
            })}
          </div>

          <p className="panel-footnote">
            Counts update automatically as citizens submit requests.
          </p>
        </article>
      </section>
    </div>
  );
}