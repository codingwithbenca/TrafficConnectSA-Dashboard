import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Filter,
  RefreshCw,
  Search,
  ShieldCheck,
  X, // <-- this was missing and caused the blank screen
  XCircle,
} from "lucide-react";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import "./AppointmentsDashboard.css";

type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "unknown";

type FirestoreTimestamp = {
  toDate?: () => Date;
  seconds?: number;
};

type Appointment = {
  id: string;
  appointmentNumber?: string;
  userId?: string;
  citizenId?: string;
  status?: string;
  date?: string;
  time?: string;
  createdAt?: string | Date | FirestoreTimestamp;
  updatedAt?: string | Date | FirestoreTimestamp;
  service?: {
    id?: string;
    name?: string;
    description?: string;
    duration?: string;
  };
  branch?: {
    id?: string;
    name?: string;
    address?: string;
    city?: string;
    province?: string;
  };
  [key: string]: unknown;
};

type StatusFilter =
  | "all"
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled";

function normaliseStatus(value?: string): AppointmentStatus {
  const status = String(value ?? "").toLowerCase().trim();

  if (["pending", "submitted", "awaiting approval"].includes(status)) {
    return "pending";
  }

  if (["confirmed", "approved", "accepted"].includes(status)) {
    return "confirmed";
  }

  if (status === "completed") return "completed";
  if (status === "cancelled" || status === "canceled") return "cancelled";

  return "unknown";
}

function toDate(value: Appointment["createdAt"]): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "object") {
    if (typeof value.toDate === "function") {
      const result = value.toDate();
      return Number.isNaN(result.getTime()) ? null : result;
    }

    if (typeof value.seconds === "number") {
      return new Date(value.seconds * 1000);
    }
  }

  if (typeof value === "string") {
    const result = new Date(value);
    return Number.isNaN(result.getTime()) ? null : result;
  }

  return null;
}

function formatDate(value?: string | Date | FirestoreTimestamp) {
  const date = toDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getAppointmentDate(appointment: Appointment): string {
  // The appointment's scheduled date takes priority over creation date.
  if (
    typeof appointment.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(appointment.date)
  ) {
    return appointment.date;
  }

  const created = toDate(appointment.createdAt);
  if (!created) return "";

  const year = created.getFullYear();
  const month = String(created.getMonth() + 1).padStart(2, "0");
  const day = String(created.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getStatusLabel(status: AppointmentStatus) {
  const labels: Record<AppointmentStatus, string> = {
    pending: "Pending approval",
    confirmed: "Approved",
    completed: "Completed",
    cancelled: "Cancelled",
    unknown: "Needs review",
  };

  return labels[status];
}

function getServiceName(appointment: Appointment) {
  return (
    appointment.service?.name ||
    appointment.service?.description ||
    appointment.service?.id ||
    "Service not specified"
  );
}

function getBranchName(appointment: Appointment) {
  return (
    appointment.branch?.name ||
    appointment.branch?.city ||
    "Branch not specified"
  );
}

export default function AppointmentsDashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError("");

    const unsubscribe = onSnapshot(
      collection(db, "appointments"),
      (snapshot) => {
        const rows = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Appointment[];

        rows.sort((a, b) => {
          const aDate = getAppointmentDate(a);
          const bDate = getAppointmentDate(b);

          if (aDate !== bDate) return bDate.localeCompare(aDate);

          return String(b.time ?? "").localeCompare(String(a.time ?? ""));
        });

        setAppointments(rows);
        setSelectedAppointment((current) =>
          current ? rows.find((row) => row.id === current.id) ?? null : null
        );
        setLoading(false);
      },
      (error) => {
        console.error("Could not load appointments:", error);
        setLoadError(
          "Appointments could not be loaded. Check your Firebase connection and Firestore permissions."
        );
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const stats = useMemo(() => {
    const result = {
      total: appointments.length,
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    };

    appointments.forEach((appointment) => {
      const status = normaliseStatus(appointment.status);

      if (status === "pending") result.pending += 1;
      if (status === "confirmed") result.confirmed += 1;
      if (status === "completed") result.completed += 1;
      if (status === "cancelled") result.cancelled += 1;
    });

    return result;
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return appointments.filter((appointment) => {
      const status = normaliseStatus(appointment.status);
      const appointmentDate = getAppointmentDate(appointment);

      const matchesStatus = statusFilter === "all" || status === statusFilter;

      const matchesFrom = !dateFrom || appointmentDate >= dateFrom;
      const matchesTo = !dateTo || appointmentDate <= dateTo;

      const searchableText = [
        appointment.appointmentNumber,
        appointment.id,
        appointment.userId,
        appointment.citizenId,
        appointment.status,
        appointment.service?.name,
        appointment.service?.description,
        appointment.service?.id,
        appointment.branch?.name,
        appointment.branch?.city,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchableText.includes(query);

      return matchesStatus && matchesFrom && matchesTo && matchesSearch;
    });
  }, [appointments, search, statusFilter, dateFrom, dateTo]);

  async function approveAppointment(
    appointment: Appointment
  ): Promise<boolean> {
    if (normaliseStatus(appointment.status) !== "pending") {
      setActionMessage("Only pending appointments can be approved.");
      return false;
    }

    const confirmed = window.confirm(
      `Approve appointment ${appointment.appointmentNumber || appointment.id}?`
    );

    if (!confirmed) return false;

    setApprovingId(appointment.id);
    setActionMessage("");

    try {
      const update: Record<string, unknown> = {
        status: "confirmed",
        updatedAt: serverTimestamp(),
        approvedAt: serverTimestamp(),
      };

      const adminId = auth.currentUser?.uid;
      if (adminId) {
        update.approvedBy = adminId;
      }

      await updateDoc(doc(db, "appointments", appointment.id), update);

      setActionMessage(
        `Appointment ${
          appointment.appointmentNumber || appointment.id
        } approved successfully.`
      );

      return true;
    } catch (error) {
      console.error("Appointment approval failed:", error);
      setActionMessage("Approval failed. Check your permissions and try again.");
      return false;
    } finally {
      setApprovingId(null);
    }
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  const isErrorMessage =
    actionMessage.toLowerCase().includes("failed") ||
    actionMessage.toLowerCase().includes("only pending");

  return (
    <main className="appointments-page">
      <header className="appointments-heading">
        <div>
          <div className="appointments-eyebrow">
            <ShieldCheck size={15} />
            TRAFFICCONNECT SA · ADMINISTRATION
          </div>
          <h1>Appointments</h1>
          <p>
            Review bookings, approve pending requests and monitor appointment
            activity across your branches.
          </p>
        </div>

        <div className="appointments-live-indicator">
          <span className="live-dot" />
          Live Firestore data
        </div>
      </header>

      <section className="appointment-stats" aria-label="Appointment statistics">
        <StatCard
          title="Total appointments"
          value={stats.total}
          icon={<CalendarDays size={20} />}
          tone="blue"
        />
        <StatCard
          title="Awaiting approval"
          value={stats.pending}
          icon={<Clock3 size={20} />}
          tone="amber"
        />
        <StatCard
          title="Approved bookings"
          value={stats.confirmed}
          icon={<CheckCircle2 size={20} />}
          tone="green"
        />
        <StatCard
          title="Cancelled"
          value={stats.cancelled}
          icon={<XCircle size={20} />}
          tone="red"
        />
      </section>

      <section className="appointments-panel">
        <div className="appointments-panel-heading">
          <div>
            <h2>Appointment register</h2>
            <p>
              Search records, filter scheduled dates and review approval status.
            </p>
          </div>

          <div className="register-count">
            {filteredAppointments.length}{" "}
            {filteredAppointments.length === 1 ? "record" : "records"}
          </div>
        </div>

        <div className="appointment-filters">
          <label className="appointment-search">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search appointment, citizen ID, service..."
              aria-label="Search appointments"
            />
          </label>

          <label className="appointment-select-wrap">
            <Filter size={16} />
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
              aria-label="Filter by appointment status"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending approval</option>
              <option value="confirmed">Approved</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <ChevronDown size={15} />
          </label>

          <label className="appointment-date">
            <span>From</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => setDateFrom(event.target.value)}
              aria-label="Filter appointments from date"
            />
          </label>

          <label className="appointment-date">
            <span>To</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => setDateTo(event.target.value)}
              aria-label="Filter appointments to date"
            />
          </label>

          <button
            className="clear-filters-button"
            type="button"
            onClick={clearFilters}
            title="Clear search and filters"
          >
            <RefreshCw size={15} />
            Reset
          </button>
        </div>

        {actionMessage && (
          <div
            className={`appointment-message ${
              isErrorMessage ? "message-error" : "message-success"
            }`}
            role="status"
          >
            {isErrorMessage ? (
              <XCircle size={17} />
            ) : (
              <CheckCircle2 size={17} />
            )}
            {actionMessage}
            <button
              type="button"
              onClick={() => setActionMessage("")}
              aria-label="Dismiss message"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {loadError && (
          <div className="appointment-error" role="alert">
            <XCircle size={20} />
            <div>
              <strong>Connection problem</strong>
              <p>{loadError}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="appointments-loading">
            <span className="loading-spinner" />
            <strong>Loading appointments</strong>
            <span>Connecting to the appointment register...</span>
          </div>
        ) : !loadError && filteredAppointments.length === 0 ? (
          <div className="appointments-empty">
            <div className="empty-icon">
              <CalendarDays size={25} />
            </div>
            <h3>No appointments found</h3>
            <p>
              Try another search, choose a different status, or widen the
              selected date range.
            </p>
            <button type="button" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        ) : (
          <div className="appointments-table-scroll">
            <table className="appointments-table">
              <thead>
                <tr>
                  <th>Appointment</th>
                  <th>Citizen reference</th>
                  <th>Service and branch</th>
                  <th>Scheduled date</th>
                  <th>Status</th>
                  <th className="actions-heading">Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredAppointments.map((appointment) => {
                  const status = normaliseStatus(appointment.status);
                  const isApproving = approvingId === appointment.id;

                  return (
                    <tr key={appointment.id}>
                      <td>
                        <button
                          className="appointment-reference"
                          type="button"
                          onClick={() => setSelectedAppointment(appointment)}
                          title="View appointment details"
                        >
                          {appointment.appointmentNumber ||
                            `APT-${appointment.id.slice(0, 8).toUpperCase()}`}
                        </button>
                        <span className="cell-subtext">
                          Added {formatDate(appointment.createdAt)}
                        </span>
                      </td>

                      <td>
                        <span className="citizen-reference">
                          {appointment.userId ||
                            appointment.citizenId ||
                            "Not linked"}
                        </span>
                      </td>

                      <td>
                        <span className="cell-main">
                          {getServiceName(appointment)}
                        </span>
                        <span className="cell-subtext">
                          {getBranchName(appointment)}
                        </span>
                      </td>

                      <td>
                        <span className="cell-main">
                          {formatDate(appointment.date || appointment.createdAt)}
                        </span>
                        <span className="cell-subtext">
                          {appointment.time || "Time not specified"}
                        </span>
                      </td>

                      <td>
                        <span className={`appointment-status status-${status}`}>
                          <span className="status-dot" />
                          {getStatusLabel(status)}
                        </span>
                      </td>

                      <td className="appointment-action-cell">
                        {status === "pending" ? (
                          <button
                            type="button"
                            className="approve-appointment-button"
                            onClick={() => approveAppointment(appointment)}
                            disabled={Boolean(approvingId)}
                          >
                            {isApproving ? (
                              <>
                                <span className="button-spinner" />
                                Approving
                              </>
                            ) : (
                              <>
                                <Check size={16} />
                                Approve
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="view-appointment-button"
                            onClick={() => setSelectedAppointment(appointment)}
                          >
                            View details
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className="appointments-panel-footer">
          <span>
            Showing {filteredAppointments.length} of {appointments.length}{" "}
            appointments
          </span>
          <span>
            <ShieldCheck size={14} />
            Changes are saved to Firestore
          </span>
        </footer>
      </section>

      {selectedAppointment && (
        <div
          className="appointment-modal-backdrop"
          onClick={() => setSelectedAppointment(null)}
        >
          <section
            className="appointment-details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="appointment-details-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="appointment-modal-header">
              <div>
                <span className="modal-eyebrow">BOOKING DETAILS</span>
                <h2 id="appointment-details-title">
                  {selectedAppointment.appointmentNumber ||
                    selectedAppointment.id}
                </h2>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={() => setSelectedAppointment(null)}
                aria-label="Close appointment details"
              >
                <X size={20} />
              </button>
            </header>

            <div className="appointment-modal-content">
              <div className="detail-status-row">
                <span className="detail-label">Current status</span>
                <span
                  className={`appointment-status status-${normaliseStatus(
                    selectedAppointment.status
                  )}`}
                >
                  <span className="status-dot" />
                  {getStatusLabel(normaliseStatus(selectedAppointment.status))}
                </span>
              </div>

              <DetailRow
                label="Citizen user ID"
                value={
                  selectedAppointment.userId ||
                  selectedAppointment.citizenId ||
                  "Not linked"
                }
              />

              <DetailRow
                label="Service"
                value={getServiceName(selectedAppointment)}
              />

              <DetailRow
                label="Branch"
                value={getBranchName(selectedAppointment)}
              />

              <DetailRow
                label="Branch address"
                value={selectedAppointment.branch?.address || "Not supplied"}
              />

              <DetailRow
                label="Scheduled date"
                value={formatDate(
                  selectedAppointment.date || selectedAppointment.createdAt
                )}
              />

              <DetailRow
                label="Scheduled time"
                value={selectedAppointment.time || "Not specified"}
              />

              <DetailRow
                label="Duration"
                value={selectedAppointment.service?.duration || "Not specified"}
              />

              <DetailRow
                label="Created"
                value={formatDate(selectedAppointment.createdAt)}
              />

              {normaliseStatus(selectedAppointment.status) === "pending" && (
                <button
                  type="button"
                  className="modal-approve-button"
                  disabled={Boolean(approvingId)}
                  onClick={async () => {
                    const approved = await approveAppointment(
                      selectedAppointment
                    );

                    if (approved) {
                      setSelectedAppointment((current) =>
                        current ? { ...current, status: "confirmed" } : null
                      );
                    }
                  }}
                >
                  {approvingId === selectedAppointment.id ? (
                    <>
                      <span className="button-spinner" />
                      Approving appointment...
                    </>
                  ) : (
                    <>
                      <Check size={17} />
                      Approve appointment
                    </>
                  )}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function StatCard({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: number;
  icon: ReactNode;
  tone: "blue" | "amber" | "green" | "red";
}) {
  return (
    <article className="appointment-stat-card">
      <div className={`stat-icon stat-${tone}`}>{icon}</div>
      <div className="stat-card-content">
        <span>{title}</span>
        <strong>{value.toLocaleString("en-ZA")}</strong>
      </div>
    </article>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="appointment-detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
