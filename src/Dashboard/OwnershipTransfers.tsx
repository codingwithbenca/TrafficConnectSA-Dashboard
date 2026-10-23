import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownUp,
  ArrowLeftRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Eye,
  FileText,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import "./VehicleApplications.css";

type StaffProfile = {
  email?: string;
  fullName?: string;
  role?: string;
  status?: string;
};

type Person = {
  fullName?: string;
  idNumber?: string;
  phone?: string;
  address?: any;
};

type OwnershipApplication = {
  id: string;
  applicationId?: string;
  type?: string;
  status?: string;
  transferReason?: string;
  vehicle?: {
    registrationNumber?: string;
    make?: string;
    model?: string;
    year?: number | string;
    colour?: string;
    vin?: string;
    engineNumber?: string;
  };
  currentOwner?: Person;
  newOwner?: Person;
  documents?: Record<string, any>;
  review?: {
    reviewedBy?: string | null;
    reviewedAt?: any;
    notes?: string | null;
  };
  createdAt?: any;
  updatedAt?: any;
};

type StatusFilter = "All" | "Pending" | "Approved" | "Rejected";
type Decision = "Approved" | "Rejected";

const DOCUMENT_LABELS: Record<string, string> = {
  buyerIdCopy: "New owner ID copy",
  proofOfOwnership: "Proof of ownership",
  saleAgreement: "Sale agreement / transfer document",
  vehicleLicence: "Vehicle licence / licence disc",
};

const REASON_LABELS: Record<string, string> = {
  sale: "Sale / Purchase",
  donation: "Donation",
  inheritance: "Inheritance",
  other: "Other",
};

function normaliseStatus(status?: string) {
  const value = (status || "Submitted").trim().toLowerCase();
  if (["approved", "accepted"].includes(value)) return "Approved";
  if (["rejected", "declined"].includes(value)) return "Rejected";
  return "Pending";
}

function getDate(value: any): string {
  if (!value) return "Not available";
  try {
    const date =
      typeof value.toDate === "function" ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return "Not available";
    return new Intl.DateTimeFormat("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "Not available";
  }
}

function formatAddress(address: any): string {
  if (!address) return "";
  if (typeof address === "string") return address;
  return [
    address.street,
    address.suburb,
    address.city,
    address.province,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

function getDocumentUrl(value: any): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  return (
    value.downloadURL ||
    value.secure_url ||
    value.url ||
    value.downloadUrl ||
    value.fileUrl ||
    value.uri ||
    ""
  );
}

function getDocumentName(value: any): string {
  if (typeof value === "string") return "Open document";
  return value?.name || value?.fileName || "Open document";
}

export default function OwnershipTransfers({
  staff,
}: {
  staff?: StaffProfile | null;
}) {
  const [applications, setApplications] = useState<OwnershipApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const [selected, setSelected] = useState<OwnershipApplication | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [pendingDecision, setPendingDecision] = useState<Decision | null>(null);
  const [reasonInput, setReasonInput] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const selectedId = selected?.id ?? null;

  useEffect(() => {
    setPendingDecision(null);
    setReasonInput("");
    setActionError("");
    setActionSuccess("");
  }, [selectedId]);

  useEffect(() => {
    setLoading(true);
    setLoadError("");

    // No orderBy here, so no composite index is required. Sorted below.
    const applicationsQuery = query(
      collection(db, "applications"),
      where("type", "==", "ownership_transfer")
    );

    const unsubscribe = onSnapshot(
      applicationsQuery,
      (snapshot) => {
        const rows: OwnershipApplication[] = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data({ serverTimestamps: "estimate" }) as Omit<
            OwnershipApplication,
            "id"
          >),
        }));

        setApplications(rows);
        setLoading(false);
        setLoadError("");

        setSelected((current) => {
          if (!current) return null;
          return rows.find((row) => row.id === current.id) ?? null;
        });
      },
      (error) => {
        console.error("[OwnershipTransfers] listener failed:", error);
        setLoadError(
          `Could not load ownership applications (${error.code}). Check your Firestore permissions.`
        );
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const counts = useMemo(
    () => ({
      all: applications.length,
      pending: applications.filter((a) => normaliseStatus(a.status) === "Pending").length,
      approved: applications.filter((a) => normaliseStatus(a.status) === "Approved").length,
      rejected: applications.filter((a) => normaliseStatus(a.status) === "Rejected").length,
    }),
    [applications]
  );

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const rows = applications.filter((application) => {
      const status = normaliseStatus(application.status);
      if (statusFilter !== "All" && status !== statusFilter) return false;
      if (!term) return true;

      const searchable = [
        application.applicationId,
        application.vehicle?.registrationNumber,
        application.vehicle?.make,
        application.vehicle?.model,
        application.vehicle?.vin,
        application.currentOwner?.fullName,
        application.currentOwner?.idNumber,
        application.newOwner?.fullName,
        application.newOwner?.idNumber,
        application.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(term);
    });

    return [...rows].sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() ?? 0;
      const bTime = b.createdAt?.toMillis?.() ?? 0;
      return sortNewestFirst ? bTime - aTime : aTime - bTime;
    });
  }, [applications, searchTerm, statusFilter, sortNewestFirst]);

  async function submitDecision(application: OwnershipApplication) {
    if (!pendingDecision) return;

    const reason = reasonInput.trim();

    if (pendingDecision === "Rejected" && !reason) {
      setActionError("Please type a reason for the rejection.");
      return;
    }

    setActionError("");
    setActionSuccess("");

    try {
      setProcessingId(application.id);

      await updateDoc(doc(db, "applications", application.id), {
        status: pendingDecision,
        "review.reviewedBy": staff?.email || staff?.fullName || null,
        "review.reviewedAt": serverTimestamp(),
        "review.notes": pendingDecision === "Rejected" ? reason : null,
        updatedAt: serverTimestamp(),
      });

      setActionSuccess(
        pendingDecision === "Approved"
          ? "Transfer approved. The citizen will see the result in the app."
          : "Transfer rejected. The reason was saved and will show in the citizen app."
      );
      setPendingDecision(null);
      setReasonInput("");
    } catch (error: any) {
      console.error("[OwnershipTransfers] decision failed:", error);
      setActionError(
        `Could not save the decision. ${error?.code ? `[${error.code}] ` : ""}${
          error?.message || ""
        }`
      );
    } finally {
      setProcessingId(null);
    }
  }

  function openDocument(value: any) {
    const url = getDocumentUrl(value);
    if (!url) {
      window.alert("No document URL was found for this document.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function renderDocument(
    application: OwnershipApplication,
    key: string,
    label: string
  ) {
    const value = application.documents?.[key];
    const url = getDocumentUrl(value);

    return (
      <div className="va-document-row" key={key}>
        <div className="va-document-icon">
          <FileText size={19} />
        </div>
        <div className="va-document-copy">
          <strong>{label}</strong>
          <span>{value ? getDocumentName(value) : "Not provided"}</span>
        </div>
        {url ? (
          <button
            type="button"
            className="va-document-open"
            onClick={() => openDocument(value)}
            title={`Open ${label}`}
          >
            <ExternalLink size={16} />
            <span>Open</span>
          </button>
        ) : (
          <span className="va-document-missing">Unavailable</span>
        )}
      </div>
    );
  }

  function renderDecisionPanel(application: OwnershipApplication) {
    const status = normaliseStatus(application.status);
    const busy = processingId === application.id;

    return (
      <section className="va-detail-section">
        <h3>
          <ShieldCheck size={18} /> Administrative decision
        </h3>

        {actionSuccess && (
          <div
            style={{
              background: "#ECFDF3",
              border: "1px solid #B7E4C7",
              color: "#18794E",
              padding: "10px 12px",
              borderRadius: 8,
              marginBottom: 12,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {actionSuccess}
          </div>
        )}

        {actionError && (
          <div
            style={{
              background: "#FEF3F2",
              border: "1px solid #FECDCA",
              color: "#B42318",
              padding: "10px 12px",
              borderRadius: 8,
              marginBottom: 12,
              fontSize: 13,
              wordBreak: "break-word",
            }}
          >
            {actionError}
          </div>
        )}

        {pendingDecision === null && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="va-button va-button-approve"
              disabled={busy || status === "Approved"}
              onClick={() => {
                setActionError("");
                setActionSuccess("");
                setPendingDecision("Approved");
              }}
            >
              <CheckCircle2 size={17} />
              Approve
            </button>

            <button
              type="button"
              className="va-button va-button-reject"
              disabled={busy || status === "Rejected"}
              onClick={() => {
                setActionError("");
                setActionSuccess("");
                setPendingDecision("Rejected");
              }}
            >
              <XCircle size={17} />
              Reject
            </button>
          </div>
        )}

        {pendingDecision === "Approved" && (
          <div>
            <p style={{ margin: "0 0 12px", fontSize: 13 }}>
              Approve ownership transfer{" "}
              <strong>{application.applicationId || application.id}</strong>?
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="va-button va-button-secondary"
                disabled={busy}
                onClick={() => setPendingDecision(null)}
              >
                Back
              </button>
              <button
                type="button"
                className="va-button va-button-approve"
                disabled={busy}
                onClick={() => submitDecision(application)}
              >
                {busy ? (
                  <LoaderCircle size={17} className="va-spin" />
                ) : (
                  <CheckCircle2 size={17} />
                )}
                Confirm approval
              </button>
            </div>
          </div>
        )}

        {pendingDecision === "Rejected" && (
          <div>
            <label
              htmlFor="ot-reject-reason"
              style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}
            >
              Reason for rejection *
            </label>
            <textarea
              id="ot-reject-reason"
              value={reasonInput}
              onChange={(event) => setReasonInput(event.target.value)}
              placeholder="Explain why this transfer is being rejected..."
              rows={4}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #D9E0E6",
                fontFamily: "inherit",
                fontSize: 14,
                resize: "vertical",
                marginBottom: 12,
              }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="va-button va-button-secondary"
                disabled={busy}
                onClick={() => {
                  setPendingDecision(null);
                  setActionError("");
                }}
              >
                Back
              </button>
              <button
                type="button"
                className="va-button va-button-reject"
                disabled={busy}
                onClick={() => submitDecision(application)}
              >
                {busy ? (
                  <LoaderCircle size={17} className="va-spin" />
                ) : (
                  <XCircle size={17} />
                )}
                Confirm rejection
              </button>
            </div>
          </div>
        )}
      </section>
    );
  }

  function renderDetails(application: OwnershipApplication) {
    const status = normaliseStatus(application.status);

    return (
      <div
        className="va-modal-backdrop"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelected(null);
        }}
      >
        <section
          className="va-details-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ot-detail-title"
        >
          <header className="va-modal-header">
            <div>
              <span className="va-eyebrow">OWNERSHIP TRANSFER REVIEW</span>
              <h2 id="ot-detail-title">
                {application.applicationId || application.id}
              </h2>
              <p>Submitted {getDate(application.createdAt)}</p>
            </div>

            <button
              type="button"
              className="va-icon-button"
              aria-label="Close application details"
              onClick={() => setSelected(null)}
            >
              <X size={20} />
            </button>
          </header>

          <div className="va-modal-body">
            <div className="va-detail-status">
              <span className={`va-status va-status-${status.toLowerCase()}`}>
                {status === "Approved" ? (
                  <CheckCircle2 size={15} />
                ) : status === "Rejected" ? (
                  <XCircle size={15} />
                ) : (
                  <Clock3 size={15} />
                )}
                {status === "Pending" ? "Awaiting review" : status}
              </span>
              <span className="va-record-id">Record ID: {application.id}</span>
            </div>

            <section className="va-detail-section">
              <h3>
                <ArrowLeftRight size={18} /> Transfer information
              </h3>
              <div className="va-detail-grid">
                <Detail
                  label="Reason"
                  value={
                    REASON_LABELS[application.transferReason || ""] ||
                    application.transferReason
                  }
                />
                <Detail label="Registration number" value={application.vehicle?.registrationNumber} />
                <Detail label="Make" value={application.vehicle?.make} />
                <Detail label="Model" value={application.vehicle?.model} />
                <Detail label="Year" value={application.vehicle?.year} />
                <Detail label="Colour" value={application.vehicle?.colour} />
                <Detail label="VIN / chassis number" value={application.vehicle?.vin} />
                <Detail label="Engine number" value={application.vehicle?.engineNumber} />
              </div>
            </section>

            <section className="va-detail-section">
              <h3>
                <ShieldCheck size={18} /> Current owner
              </h3>
              <div className="va-detail-grid">
                <Detail label="Full name" value={application.currentOwner?.fullName} />
                <Detail label="Identity number" value={application.currentOwner?.idNumber} />
                <Detail label="Contact number" value={application.currentOwner?.phone} />
                <Detail label="Address" value={formatAddress(application.currentOwner?.address)} />
              </div>
            </section>

            <section className="va-detail-section">
              <h3>
                <ShieldCheck size={18} /> New owner
              </h3>
              <div className="va-detail-grid">
                <Detail label="Full name" value={application.newOwner?.fullName} />
                <Detail label="Identity number" value={application.newOwner?.idNumber} />
                <Detail label="Contact number" value={application.newOwner?.phone} />
                <Detail label="Address" value={formatAddress(application.newOwner?.address)} />
              </div>
            </section>

            <section className="va-detail-section">
              <h3>
                <FileText size={18} /> Supporting documents
              </h3>
              <div className="va-document-list">
                {Object.entries(DOCUMENT_LABELS).map(([key, label]) =>
                  renderDocument(application, key, label)
                )}
              </div>
            </section>

            {status === "Rejected" && application.review?.notes && (
              <section className="va-existing-reason">
                <strong>Saved rejection reason</strong>
                <p>{application.review.notes}</p>
              </section>
            )}

            {renderDecisionPanel(application)}
          </div>

          <footer className="va-modal-footer">
            <button
              type="button"
              className="va-button va-button-secondary"
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </footer>
        </section>
      </div>
    );
  }

  return (
    <section className="vehicle-applications">
      <header className="va-page-header">
        <div>
          <div className="va-eyebrow">TRAFFICCONNECT / SERVICES</div>
          <h1>Change of ownership</h1>
          <p>
            Review vehicle ownership-transfer requests and record your
            decisions.
          </p>
        </div>

        <button
          type="button"
          className="va-refresh-button"
          onClick={() => window.location.reload()}
          title="Refresh the workspace"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      <div className="va-metrics">
        <Metric label="Total requests" value={counts.all} icon={<FileText size={21} />} tone="blue" />
        <Metric label="Awaiting review" value={counts.pending} icon={<Clock3 size={21} />} tone="amber" />
        <Metric label="Approved" value={counts.approved} icon={<CheckCircle2 size={21} />} tone="green" />
        <Metric label="Rejected" value={counts.rejected} icon={<XCircle size={21} />} tone="red" />
      </div>

      <div className="va-workspace-card">
        <div className="va-list-heading">
          <div>
            <h2>Ownership transfer requests</h2>
            <p>Live records from the citizen application</p>
          </div>
          <span className="va-live-indicator">
            <span />
            Live updates
          </span>
        </div>

        <div className="va-toolbar">
          <label className="va-search">
            <Search size={18} />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search reference, owner, ID, registration or VIN..."
              aria-label="Search ownership transfers"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            aria-label="Filter by status"
            className="va-filter"
          >
            <option value="All">All statuses</option>
            <option value="Pending">Awaiting review</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>

          <button
            type="button"
            className="va-sort-button"
            onClick={() => setSortNewestFirst((current) => !current)}
            title="Change date order"
          >
            <ArrowDownUp size={16} />
            {sortNewestFirst ? "Newest first" : "Oldest first"}
          </button>
        </div>

        {loadError && (
          <div className="va-error-banner">
            <AlertCircle size={19} />
            <span>{loadError}</span>
          </div>
        )}

        {loading ? (
          <div className="va-empty-state">
            <LoaderCircle size={30} className="va-spin" />
            <strong>Loading requests</strong>
            <span>Connecting to Firestore...</span>
          </div>
        ) : !loadError && filtered.length === 0 ? (
          <div className="va-empty-state">
            <div className="va-empty-icon">
              <ArrowLeftRight size={29} />
            </div>
            <strong>
              {applications.length === 0
                ? "No ownership requests yet"
                : "No matching requests"}
            </strong>
            <span>
              {applications.length === 0
                ? "Requests submitted by citizens will appear here."
                : "Try changing your search or status filter."}
            </span>
          </div>
        ) : (
          <div className="va-table-scroll">
            <table className="va-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Current owner</th>
                  <th>New owner</th>
                  <th>Vehicle</th>
                  <th>Date submitted</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((application) => {
                  const status = normaliseStatus(application.status);

                  return (
                    <tr key={application.id}>
                      <td>
                        <div className="va-reference">
                          <strong>{application.applicationId || application.id}</strong>
                          <span>Ownership transfer</span>
                        </div>
                      </td>

                      <td>
                        <div className="va-applicant-cell">
                          <strong>{application.currentOwner?.fullName || "Name unavailable"}</strong>
                          <span>{application.currentOwner?.idNumber || "No ID supplied"}</span>
                        </div>
                      </td>

                      <td>
                        <div className="va-applicant-cell">
                          <strong>{application.newOwner?.fullName || "Name unavailable"}</strong>
                          <span>{application.newOwner?.idNumber || "No ID supplied"}</span>
                        </div>
                      </td>

                      <td>
                        <div className="va-vehicle-cell">
                          <strong>
                            {[application.vehicle?.make, application.vehicle?.model]
                              .filter(Boolean)
                              .join(" ") || "Vehicle unavailable"}
                          </strong>
                          <span>
                            {application.vehicle?.registrationNumber || "No registration"}
                          </span>
                        </div>
                      </td>

                      <td className="va-date-cell">{getDate(application.createdAt)}</td>

                      <td>
                        <span className={`va-status va-status-${status.toLowerCase()}`}>
                          {status === "Approved" ? (
                            <CheckCircle2 size={14} />
                          ) : status === "Rejected" ? (
                            <XCircle size={14} />
                          ) : (
                            <Clock3 size={14} />
                          )}
                          {status === "Pending" ? "Pending review" : status}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="va-view-button"
                          onClick={() => setSelected(application)}
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

        <footer className="va-table-footer">
          <span>
            Showing {filtered.length} of {applications.length} request
            {applications.length === 1 ? "" : "s"}
          </span>
          <span>Source: Firestore / applications (ownership_transfer)</span>
        </footer>
      </div>

      {selected && renderDetails(selected)}
    </section>
  );
}

function Metric({
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
    <article className={`va-metric va-metric-${tone}`}>
      <div className="va-metric-top">
        <span>{label}</span>
        <div className="va-metric-icon">{icon}</div>
      </div>
      <strong>{value}</strong>
    </article>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | number | undefined;
}) {
  return (
    <div className="va-detail-item">
      <span>{label}</span>
      <strong>{value === undefined || value === "" ? "Not provided" : value}</strong>
    </div>
  );
}