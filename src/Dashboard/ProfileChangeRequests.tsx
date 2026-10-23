
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Eye,
  Mail,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import "./ProfileChangeRequests.css";
import { writeBatch } from "firebase/firestore";
type ProfileRequest = {
  id: string;
  userId?: string;
  citizenId?: string;
  userName?: string;
  currentEmail?: string;
  requestedEmail?: string;
  currentPhone?: string;
  requestedPhone?: string;
  status?: string;
  reason?: string;
  rejectionReason?: string;
  adminReason?: string;
  reviewComment?: string;
  createdAt?: any;
  reviewedAt?: any;
};

type StaffProfile = {
  email?: string;
  fullName?: string;
  role?: string;
};

type Props = {
  staff: StaffProfile | null;
};

function formatDate(value: any) {
  if (!value) return "Date unavailable";

  try {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : new Date(value);

    if (Number.isNaN(date.getTime())) return "Date unavailable";

    return date.toLocaleString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Date unavailable";
  }
}

function statusLabel(status?: string) {
  const normalized = (status || "pending").toLowerCase();

  if (normalized === "approved") return "Approved";
  if (normalized === "rejected") return "Rejected";

  return "Pending review";
}

export default function ProfileChangeRequests({ staff }: Props) {
  const [requests, setRequests] = useState<ProfileRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<ProfileRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    setLoading(true);
    setLoadError("");

    const requestsQuery = query(
      collection(db, "profileChangeRequests"),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      requestsQuery,
      (snapshot) => {
        
const rows = snapshot.docs.map((item) => {
  const data = item.data();

  return {
    id: item.id,

    // Citizen details
    userId: data.userId ?? "",
    citizenId: data.userId ?? "",
    userName: data.citizenName ?? "Citizen",

    // Current contact details
    currentEmail: data.currentValues?.email ?? "",
    currentPhone: data.currentValues?.phone ?? "",

    // Requested contact changes
    requestedEmail: data.requestedChanges?.email ?? "",
    requestedPhone: data.requestedChanges?.phone ?? "",

    // Request status and dates
    status: data.status ?? "pending",
    rejectionReason: data.rejectionReason ?? "",
    reason: data.reason ?? "",
    createdAt: data.createdAt ?? null,
    reviewedAt: data.reviewedAt ?? null,
  };
});

setRequests(rows);

        setLoading(false);
      },
      (error) => {
        console.error("Could not load profile change requests:", error);
        setLoadError(
          "Could not load requests. Check your Firestore connection and security rules.",
        );
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const filteredRequests = requests.filter((request) => {
    const searchText = search.trim().toLowerCase();

    const matchesSearch =
      !searchText ||
      [
        request.userName,
        request.userId,
        request.citizenId,
        request.currentEmail,
        request.requestedEmail,
        request.currentPhone,
        request.requestedPhone,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(searchText));

    const status = (request.status || "pending").toLowerCase();

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "pending" &&
        !["approved", "rejected"].includes(status)) ||
      status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const pendingCount = requests.filter(
    (request) =>
      !["approved", "rejected"].includes(
        (request.status || "pending").toLowerCase(),
      ),
  ).length;

  const approvedCount = requests.filter(
    (request) => (request.status || "").toLowerCase() === "approved",
  ).length;

  const rejectedCount = requests.filter(
    (request) => (request.status || "").toLowerCase() === "rejected",
  ).length;


const reviewRequest = async (decision: "approved" | "rejected") => {
  if (!selected) return;

  if (
    decision === "rejected" &&
    !rejectionReason.trim()
  ) {
    alert("Please provide a reason for rejecting this request.");
    return;
  }

  try {
    const requestRef = doc(
      db,
      "profileChangeRequests",
      selected.id
    );

    const citizenRef = doc(
      db,
      "citizens",
      selected.userId
    );

    const update: Record<string, any> = {
      status: decision,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      reviewedBy:
        staff?.email || staff?.fullName || "Admin",
    };

    if (decision === "rejected") {
      update.rejectionReason = rejectionReason.trim();
      update.reason = rejectionReason.trim();

      await updateDoc(requestRef, update);
    } else {
      update.rejectionReason = "";
      update.reason = "";

      const citizenUpdates: Record<string, any> = {
        updatedAt: serverTimestamp(),
      };

      // Apply only the fields the citizen requested to change.
      const requestedEmail =
        selected.requestedEmail?.trim();

      const requestedPhone =
        selected.requestedPhone?.trim();

      if (requestedEmail) {
        citizenUpdates.email = requestedEmail;
      }

      if (requestedPhone) {
        citizenUpdates.phone = requestedPhone;
      }

      if (
        !requestedEmail &&
        !requestedPhone
      ) {
        alert("This request contains no changes to apply.");
        return;
      }

      // Update the citizen and approve the request together.
      const batch = writeBatch(db);

      batch.update(citizenRef, citizenUpdates);
      batch.update(requestRef, update);

      await batch.commit();
    }

    alert(
      decision === "approved"
        ? "Request approved and citizen profile updated."
        : "Request rejected."
    );

    setSelected(null);
    setRejectionReason("");
  } catch (error) {
    console.error("Failed to review profile request:", error);

    alert(
      "Could not process the request. Check that the citizen record exists and your Firestore permissions allow the update."
    );
  }
};


  return (
    <section className="profile-requests-page">
      <div className="profile-requests-heading">
        <div>
          <p className="profile-requests-eyebrow">
            TRAFFICCONNECT / CITIZEN SERVICES
          </p>
          <h1>Profile Change Requests</h1>
          <p className="profile-requests-subtitle">
            Review citizens' requests to update their contact information.
          </p>
        </div>

        <div className="profile-requests-secure">
          <ShieldCheck size={17} />
          Staff review
        </div>
      </div>

      <div className="profile-request-stats">
        <div className="profile-request-stat">
          <span className="profile-request-stat-icon pending">
            <Clock3 size={20} />
          </span>
          <div>
            <span>Pending review</span>
            <strong>{pendingCount}</strong>
          </div>
        </div>

        <div className="profile-request-stat">
          <span className="profile-request-stat-icon approved">
            <CheckCircle2 size={20} />
          </span>
          <div>
            <span>Approved</span>
            <strong>{approvedCount}</strong>
          </div>
        </div>

        <div className="profile-request-stat">
          <span className="profile-request-stat-icon rejected">
            <XCircle size={20} />
          </span>
          <div>
            <span>Rejected</span>
            <strong>{rejectedCount}</strong>
          </div>
        </div>
      </div>

      <div className="profile-requests-panel">
        <div className="profile-requests-toolbar">
          <div>
            <h2>Submitted requests</h2>
            <p>Review each request before making a decision.</p>
          </div>

          <div className="profile-request-filters">
            <label className="profile-request-search">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search citizen or contact..."
                aria-label="Search requests"
              />
            </label>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All requests</option>
              <option value="pending">Pending review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="profile-request-message">
            <RefreshCw className="profile-request-spin" size={22} />
            <span>Loading requests...</span>
          </div>
        ) : loadError ? (
          <div className="profile-request-message error">
            <XCircle size={22} />
            <span>{loadError}</span>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="profile-request-empty">
            <div>
              <Mail size={27} />
            </div>
            <h3>No requests found</h3>
            <p>
              Requests submitted by citizens will appear here.
            </p>
          </div>
        ) : (
          <div className="profile-request-table-wrap">
            <table className="profile-request-table">
              <thead>
                <tr>
                  <th>Citizen</th>
                  <th>Requested changes</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredRequests.map((request) => {
                  const status = (request.status || "pending").toLowerCase();

                  return (
                    <tr key={request.id}>
                      <td>
                        <div className="profile-request-citizen">
                          <div className="profile-request-avatar">
                            {(request.userName || "C")
                              .trim()
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                          <div>
                            <strong>{request.userName || "Citizen"}</strong>
                            <span>
                              ID: {request.citizenId || request.userId || "N/A"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="profile-request-change">
                          {request.requestedEmail &&
                            request.requestedEmail !== request.currentEmail && (
                              <span>
                                <Mail size={14} />
                                {request.requestedEmail}
                              </span>
                            )}
                          {request.requestedPhone &&
                            request.requestedPhone !== request.currentPhone && (
                              <span>
                                <Phone size={14} />
                                {request.requestedPhone}
                              </span>
                            )}
                          {!request.requestedEmail &&
                            !request.requestedPhone && (
                              <span>No contact details provided</span>
                            )}
                        </div>
                      </td>

                      <td>{formatDate(request.createdAt)}</td>

                      <td>
                        <span
                          className={`profile-request-status ${status}`}
                        >
                          {statusLabel(status)}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="profile-request-view-button"
                          onClick={() => {
                            setSelected(request);
                            setRejectionReason("");
                            setActionError("");
                          }}
                        >
                          <Eye size={16} />
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div
          className="profile-request-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !actionLoading) {
              setSelected(null);
            }
          }}
        >
          <section
            className="profile-request-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-request-modal-title"
          >
            <div className="profile-request-modal-heading">
              <div>
                <span>REQUEST REVIEW</span>
                <h2 id="profile-request-modal-title">
                  Citizen contact details
                </h2>
              </div>

              <button
                type="button"
                className="profile-request-close"
                onClick={() => setSelected(null)}
                disabled={actionLoading}
                aria-label="Close review"
              >
                <X size={20} />
              </button>
            </div>

            <div className="profile-request-citizen-banner">
              <div className="profile-request-avatar large">
                {(selected.userName || "C")
                  .trim()
                  .charAt(0)
                  .toUpperCase()}
              </div>
              <div>
                <strong>{selected.userName || "Citizen"}</strong>
                <span>
                  Citizen ID: {selected.citizenId || selected.userId || "N/A"}
                </span>
                <small>Submitted {formatDate(selected.createdAt)}</small>
              </div>
            </div>

            <div className="profile-request-comparison">
              <div className="profile-request-detail">
                <span>Current email</span>
                <strong>{selected.currentEmail || "Not provided"}</strong>
              </div>
              <div className="profile-request-detail requested">
                <span>Requested email</span>
                <strong>{selected.requestedEmail || "No change requested"}</strong>
              </div>
              <div className="profile-request-detail">
                <span>Current phone</span>
                <strong>{selected.currentPhone || "Not provided"}</strong>
              </div>
              <div className="profile-request-detail requested">
                <span>Requested phone</span>
                <strong>{selected.requestedPhone || "No change requested"}</strong>
              </div>
            </div>

            {["approved", "rejected"].includes(
              (selected.status || "pending").toLowerCase(),
            ) ? (
              <div className="profile-request-already-reviewed">
                <ShieldCheck size={18} />
                This request has already been {selected.status?.toLowerCase()}.
                {(selected.rejectionReason || selected.reason) && (
                  <p>
                    Reason:{" "}
                    {selected.rejectionReason || selected.reason}
                  </p>
                )}
              </div>
            ) : (
              <>
                <label className="profile-request-reason-label">
                  Rejection reason
                  <span>Required only when rejecting</span>
                </label>

                <textarea
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  placeholder="Explain why this request is being rejected..."
                  rows={3}
                />

                {actionError && (
                  <p className="profile-request-action-error">
                    {actionError}
                  </p>
                )}

                <div className="profile-request-modal-actions">
                  <button
                    type="button"
                    className="profile-request-reject-button"
                    onClick={() => reviewRequest("rejected")}
                    disabled={actionLoading}
                  >
                    <XCircle size={17} />
                    Reject request
                  </button>

                  <button
                    type="button"
                    className="profile-request-approve-button"
                    onClick={() => reviewRequest("approved")}
                    disabled={actionLoading}
                  >
                    <CheckCircle2 size={17} />
                    {actionLoading ? "Saving..." : "Approve request"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
