
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  RefreshCw,
  Search,
  X,
  XCircle,
} from "lucide-react";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

// IMPORTANT:
// Use the same Firebase db import path as ProfileChangeRequests.tsx.
import { db } from "../firebase";

import "./VehicleRenewals.css";

type StaffProfile = {
  email?: string;
  fullName?: string;
  role?: string;
  status?: string;
};

type RenewalStatus = "Pending" | "Approved" | "Rejected";

type VehicleRenewal = {
  id: string;
  citizenId?: string;
  fullName?: string;
  vehicleId?: string;
  registrationNumber?: string;
  make?: string;
  model?: string;
  licenceDisk?: {
    number?: string;
    expiryDate?: string;
    status?: string;
  } | null;
  submittedAt?: string | { toDate?: () => Date } | null;
  status?: RenewalStatus | string;
  rejectionReason?: string;
  reviewedAt?: unknown;
  reviewedBy?: string;
};

type Props = {
  staff?: StaffProfile | null;
};

type FilterType = "All" | RenewalStatus;

export default function VehicleRenewals({ staff }: Props) {
  const [requests, setRequests] = useState<VehicleRenewal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("All");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Listen for changes in Firestore in real time.
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "vehicleRenewalRequests"),
      (snapshot) => {
        const loadedRequests = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as VehicleRenewal[];

        loadedRequests.sort(
          (a, b) =>
            getTimestamp(b.submittedAt) -
            getTimestamp(a.submittedAt),
        );

        setRequests(loadedRequests);
        setLoading(false);
        setError("");
      },
      (err) => {
        console.error("[VehicleRenewals] Firestore error:", err);
        setError(
          "Could not load renewal requests. Check your Firebase connection and Firestore security rules.",
        );
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const counts = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter(
        (item) => normalizeStatus(item.status) === "Pending",
      ).length,
      approved: requests.filter(
        (item) => normalizeStatus(item.status) === "Approved",
      ).length,
      rejected: requests.filter(
        (item) => normalizeStatus(item.status) === "Rejected",
      ).length,
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesFilter =
        filter === "All" ||
        normalizeStatus(request.status) === filter;

      const searchableText = [
        request.fullName,
        request.citizenId,
        request.registrationNumber,
        request.make,
        request.model,
        request.vehicleId,
        request.licenceDisk?.number,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesFilter &&
        (!term || searchableText.includes(term));
    });
  }, [requests, search, filter]);

  async function approveRequest(request: VehicleRenewal) {
    if (normalizeStatus(request.status) !== "Pending") {
      window.alert("Only pending requests can be approved.");
      return;
    }

    const confirmed = window.confirm(
      `Approve the vehicle licence renewal for ${
        request.registrationNumber || request.vehicleId || "this vehicle"
      }?`,
    );

    if (!confirmed) return;

    setProcessingId(request.id);

    try {
      await updateDoc(
        doc(db, "vehicleRenewalRequests", request.id),
        {
          status: "Approved",
          reviewedAt: serverTimestamp(),
          reviewedBy: staff?.email || staff?.fullName || "Admin",
          rejectionReason: "",
          updatedAt: serverTimestamp(),
        },
      );

      window.alert("Renewal request approved successfully.");
    } catch (err) {
      console.error("[VehicleRenewals] Approval failed:", err);
      window.alert(
        "Could not approve this request. Check your connection and Firestore permissions.",
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function rejectRequest(request: VehicleRenewal) {
    if (normalizeStatus(request.status) !== "Pending") {
      window.alert("Only pending requests can be rejected.");
      return;
    }

    const reason = window.prompt(
      `Enter the reason for rejecting the renewal for ${
        request.registrationNumber || request.vehicleId || "this vehicle"
      }:`,
    );

    // Cancel was clicked.
    if (reason === null) return;

    if (!reason.trim()) {
      window.alert("Please enter a rejection reason.");
      return;
    }

    const confirmed = window.confirm(
      "Confirm rejection? The request will be marked as Rejected.",
    );

    if (!confirmed) return;

    setProcessingId(request.id);

    try {
      await updateDoc(
        doc(db, "vehicleRenewalRequests", request.id),
        {
          status: "Rejected",
          rejectionReason: reason.trim(),
          reviewedAt: serverTimestamp(),
          reviewedBy: staff?.email || staff?.fullName || "Admin",
          updatedAt: serverTimestamp(),
        },
      );

      window.alert("Renewal request rejected.");
    } catch (err) {
      console.error("[VehicleRenewals] Rejection failed:", err);
      window.alert(
        "Could not reject this request. Check your connection and Firestore permissions.",
      );
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <section className="renewals-page">
      <div className="renewals-heading">
        <div>
          <p className="renewals-eyebrow">VEHICLE SERVICES</p>
          <h1>Vehicle Renewals</h1>
          <p className="renewals-description">
            Review citizen requests to renew vehicle licence disks.
          </p>
        </div>

        <div className="renewals-live-indicator">
          <span />
          Live Firestore data
        </div>
      </div>

      <div className="renewals-stats">
        <StatCard
          label="Total requests"
          value={counts.total}
          icon={<FileText size={21} />}
          tone="blue"
        />
        <StatCard
          label="Awaiting review"
          value={counts.pending}
          icon={<Clock size={21} />}
          tone="amber"
        />
        <StatCard
          label="Approved"
          value={counts.approved}
          icon={<CheckCircle2 size={21} />}
          tone="green"
        />
        <StatCard
          label="Rejected"
          value={counts.rejected}
          icon={<XCircle size={21} />}
          tone="red"
        />
      </div>

      <div className="renewals-panel">
        <div className="renewals-panel-heading">
          <div>
            <h2>Renewal requests</h2>
            <p>
              Review each request and choose the appropriate action.
            </p>
          </div>
          <span className="renewals-result-count">
            {filteredRequests.length} shown
          </span>
        </div>

        <div className="renewals-toolbar">
          <div className="renewals-search">
            <Search size={18} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search citizen, registration or vehicle..."
              aria-label="Search renewal requests"
            />
          </div>

          <div className="renewals-filters" aria-label="Filter requests">
            {(["All", "Pending", "Approved", "Rejected"] as FilterType[]).map(
              (option) => (
                <button
                  type="button"
                  key={option}
                  className={filter === option ? "selected" : ""}
                  onClick={() => setFilter(option)}
                >
                  {option}
                  {option === "Pending" && counts.pending > 0 && (
                    <span className="filter-count">{counts.pending}</span>
                  )}
                </button>
              ),
            )}
          </div>
        </div>

        {loading ? (
          <div className="renewals-state">
            <RefreshCw className="renewals-spinner" size={26} />
            <strong>Loading renewal requests</strong>
            <span>Connecting to Firestore...</span>
          </div>
        ) : error ? (
          <div className="renewals-state renewals-error">
            <AlertCircle size={30} />
            <strong>Unable to load requests</strong>
            <span>{error}</span>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="renewals-state">
            <FileText size={32} />
            <strong>No renewal requests found</strong>
            <span>
              {search || filter !== "All"
                ? "Try a different search term or status filter."
                : "New requests submitted by citizens will appear here."}
            </span>
          </div>
        ) : (
          <div className="renewals-table-wrapper">
            <table className="renewals-table">
              <thead>
                <tr>
                  <th>Citizen</th>
                  <th>Vehicle</th>
                  <th>Licence disk</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredRequests.map((request) => {
                  const status = normalizeStatus(request.status);
                  const isProcessing = processingId === request.id;

                  return (
                    <tr key={request.id}>
                      <td>
                        <div className="renewals-citizen">
                          <div className="renewals-avatar">
                            {(request.fullName || "C")
                              .trim()
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                          <div>
                            <strong>{request.fullName || "Unknown citizen"}</strong>
                            <span>
                              ID: {request.citizenId || "Not provided"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="renewals-vehicle">
                          <strong>
                            {[request.make, request.model]
                              .filter(Boolean)
                              .join(" ") || "Vehicle details unavailable"}
                          </strong>
                          <span>
                            {request.registrationNumber || "No registration"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="renewals-disk">
                          <strong>
                            {request.licenceDisk?.number || "Not provided"}
                          </strong>
                          <span>
                            Expires:{" "}
                            {formatDate(request.licenceDisk?.expiryDate)}
                          </span>
                        </div>
                      </td>

                      <td>{formatDateTime(request.submittedAt)}</td>

                      <td>
                        <StatusBadge status={status} />
                        {status === "Rejected" && request.rejectionReason && (
                          <span
                            className="renewals-rejection-note"
                            title={request.rejectionReason}
                          >
                            Reason: {request.rejectionReason}
                          </span>
                        )}
                      </td>

                      <td>
                        {status === "Pending" ? (
                          <div className="renewals-actions">
                            <button
                              type="button"
                              className="renewal-approve-button"
                              disabled={isProcessing}
                              onClick={() => approveRequest(request)}
                              title="Approve request"
                            >
                              <Check size={16} />
                              {isProcessing ? "Saving..." : "Accept"}
                            </button>

                            <button
                              type="button"
                              className="renewal-reject-button"
                              disabled={isProcessing}
                              onClick={() => rejectRequest(request)}
                              title="Reject request"
                            >
                              <X size={16} />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="renewals-reviewed">
                            <CheckCircle2 size={15} />
                            Reviewed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="renewals-panel-footer">
          <span>
            <span className="renewals-footer-dot" />
            Changes sync automatically
          </span>
          <span>Collection: vehicleRenewalRequests</span>
        </div>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "blue" | "amber" | "green" | "red";
}) {
  return (
    <div className="renewals-stat-card">
      <div className={`renewals-stat-icon ${tone}`}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: RenewalStatus }) {
  const icon =
    status === "Pending" ? (
      <Clock size={14} />
    ) : status === "Approved" ? (
      <CheckCircle2 size={14} />
    ) : (
      <XCircle size={14} />
    );

  return (
    <span className={`renewals-status ${status.toLowerCase()}`}>
      {icon}
      {status}
    </span>
  );
}

function normalizeStatus(status?: string): RenewalStatus {
  const value = (status || "Pending").toLowerCase();

  if (value === "approved" || value === "accepted") return "Approved";
  if (value === "rejected" || value === "declined") return "Rejected";

  return "Pending";
}

function getTimestamp(value: VehicleRenewal["submittedAt"]): number {
  if (!value) return 0;

  if (typeof value === "string") {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  if (typeof value === "object" && value.toDate) {
    return value.toDate().getTime();
  }

  return 0;
}

function formatDate(value?: string): string {
  if (!value) return "Not provided";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: VehicleRenewal["submittedAt"]): string {
  const timestamp = getTimestamp(value);
  if (!timestamp) return "Not available";

  return new Date(timestamp).toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
