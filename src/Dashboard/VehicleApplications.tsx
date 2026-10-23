
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownUp,
  CarFront,
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
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";
import "./VehicleApplications.css";

type VehicleApplication = {
  id: string;
  applicationId?: string;
  userId?: string;
  citizenId?: string;
  status?: string;
  rejectionReason?: string;
  applicant?: {
    fullName?: string;
    idNumber?: string;
    phone?: string;
    address?: string;
  };
  vehicle?: {
    vehicleType?: string;
    vin?: string;
    engineNumber?: string;
    make?: string;
    model?: string;
    year?: number | string;
    colour?: string;
  };
  documents?: Record<string, any>;
  createdAt?: any;
  updatedAt?: any;
};

type StatusFilter = "All" | "Pending" | "Approved" | "Rejected";

const DOCUMENT_LABELS: Record<string, string> = {
  idCopy: "Identity document",
  proofOfResidence: "Proof of residence",
  proofOfOwnership: "Proof of ownership",
  policeClearance: "Police clearance",
  roadworthy: "Roadworthy certificate",
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
    const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
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

function getDocumentUrl(value: any): string {
  if (typeof value === "string") return value;

  if (!value || typeof value !== "object") return "";

  return (
    value.secure_url ||
    value.url ||
    value.downloadURL ||
    value.downloadUrl ||
    value.fileUrl ||
    value.uri ||
    ""
  );
}

function getDocumentName(value: any): string {
  if (typeof value === "string") return "Open document";

  return (
    value?.fileName ||
    value?.name ||
    value?.original_filename ||
    "Open document"
  );
}

export default function VehicleApplications() {
  const [applications, setApplications] = useState<VehicleApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [selectedApplication, setSelectedApplication] =
    useState<VehicleApplication | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [sortNewestFirst, setSortNewestFirst] = useState(true);

  useEffect(() => {
    setLoading(true);
    setLoadError("");

    const applicationsQuery = query(
      collection(db, "vehicleApplications"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      applicationsQuery,
      (snapshot) => {
        const rows: VehicleApplication[] = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<VehicleApplication, "id">),
        }));

        setApplications(rows);
        setLoading(false);
        setLoadError("");

        // Keep the open details panel up to date as the record changes.
        setSelectedApplication((current) => {
          if (!current) return null;
          return rows.find((row) => row.id === current.id) ?? null;
        });
      },
      (error) => {
        console.error("[VehicleApplications] Firestore listener failed:", error);
        setLoadError(
          "Could not load vehicle applications. Check your Firebase configuration and Firestore permissions."
        );
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const counts = useMemo(() => {
    return {
      all: applications.length,
      pending: applications.filter(
        (application) => normaliseStatus(application.status) === "Pending"
      ).length,
      approved: applications.filter(
        (application) => normaliseStatus(application.status) === "Approved"
      ).length,
      rejected: applications.filter(
        (application) => normaliseStatus(application.status) === "Rejected"
      ).length,
    };
  }, [applications]);

  const filteredApplications = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const filtered = applications.filter((application) => {
      const status = normaliseStatus(application.status);

      if (statusFilter !== "All" && status !== statusFilter) return false;
      if (!term) return true;

      const searchable = [
        application.applicationId,
        application.applicant?.fullName,
        application.applicant?.idNumber,
        application.applicant?.phone,
        application.vehicle?.make,
        application.vehicle?.model,
        application.vehicle?.vin,
        application.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(term);
    });

    return [...filtered].sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() ?? 0;
      const bTime = b.createdAt?.toMillis?.() ?? 0;

      return sortNewestFirst ? bTime - aTime : aTime - bTime;
    });
  }, [applications, searchTerm, statusFilter, sortNewestFirst]);

  async function handleDecision(
    application: VehicleApplication,
    decision: "Approved" | "Rejected"
  ) {
    const currentStatus = normaliseStatus(application.status);

    if (currentStatus === decision) {
      window.alert(`This application is already ${decision.toLowerCase()}.`);
      return;
    }

    let rejectionReason = "";

    if (decision === "Rejected") {
      const response = window.prompt(
        "Enter the reason for rejecting this vehicle registration application:"
      );

      if (response === null) return;

      rejectionReason = response.trim();

      if (!rejectionReason) {
        window.alert("Please provide a reason for rejection.");
        return;
      }
    } else {
      const confirmed = window.confirm(
        `Approve application ${application.applicationId || application.id}?`
      );

      if (!confirmed) return;
    }

    try {
      setProcessingId(application.id);

      // IMPORTANT: use the real Firestore document ID (application.id),
      // not the display reference such as VR-XXXXXXXX.
      await updateDoc(doc(db, "vehicleApplications", application.id), {
        status: decision,
        rejectionReason: decision === "Rejected" ? rejectionReason : "",
        updatedAt: serverTimestamp(),
      });

      // onSnapshot updates the list and details panel automatically.
      setSelectedApplication((current) =>
        current?.id === application.id
          ? {
              ...current,
              status: decision,
              rejectionReason: decision === "Rejected" ? rejectionReason : "",
            }
          : current
      );

      window.alert(
        decision === "Approved"
          ? "Application approved. The citizen's status will update automatically."
          : "Application rejected. The rejection reason has been saved and will appear in the citizen app."
      );
    } catch (error) {
      console.error("[VehicleApplications] Decision update failed:", error);

      window.alert(
        "The decision could not be saved. Check your Firestore permissions and try again."
      );
    } finally {
      setProcessingId(null);
    }
  }

  function openDocument(value: any) {
    const url = getDocumentUrl(value);

    if (!url) {
      window.alert(
        "No document URL was found. Check that the uploaded document contains a secure_url or url field."
      );
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function renderDocument(
    application: VehicleApplication,
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

  function renderDetails(application: VehicleApplication) {
    const status = normaliseStatus(application.status);
    const busy = processingId === application.id;

    return (
      <div
        className="va-modal-backdrop"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setSelectedApplication(null);
          }
        }}
      >
        <section
          className="va-details-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="va-detail-title"
        >
          <header className="va-modal-header">
            <div>
              <span className="va-eyebrow">APPLICATION REVIEW</span>
              <h2 id="va-detail-title">
                {application.applicationId || application.id}
              </h2>
              <p>Submitted {getDate(application.createdAt)}</p>
            </div>

            <button
              type="button"
              className="va-icon-button"
              aria-label="Close application details"
              onClick={() => setSelectedApplication(null)}
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
                <ShieldCheck size={18} /> Applicant information
              </h3>

              <div className="va-detail-grid">
                <Detail label="Full name" value={application.applicant?.fullName} />
                <Detail label="Identity number" value={application.applicant?.idNumber} />
                <Detail label="Contact number" value={application.applicant?.phone} />
                <Detail label="Address" value={application.applicant?.address} />
              </div>
            </section>

            <section className="va-detail-section">
              <h3>
                <CarFront size={18} /> Vehicle information
              </h3>

              <div className="va-detail-grid">
                <Detail label="Vehicle make" value={application.vehicle?.make} />
                <Detail label="Model" value={application.vehicle?.model} />
                <Detail label="Vehicle type" value={application.vehicle?.vehicleType} />
                <Detail label="Year" value={application.vehicle?.year} />
                <Detail label="Colour" value={application.vehicle?.colour} />
                <Detail label="VIN / chassis number" value={application.vehicle?.vin} />
                <Detail label="Engine number" value={application.vehicle?.engineNumber} />
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

            {status === "Rejected" && application.rejectionReason && (
              <section className="va-existing-reason">
                <strong>Saved rejection reason</strong>
                <p>{application.rejectionReason}</p>
              </section>
            )}

            {status === "Pending" && (
              <div className="va-review-notice">
                <AlertCircle size={19} />
                <p>
                  Review the applicant's details and available documents before
                  recording your decision.
                </p>
              </div>
            )}
          </div>

          <footer className="va-modal-footer">
            <button
              type="button"
              className="va-button va-button-secondary"
              onClick={() => setSelectedApplication(null)}
              disabled={busy}
            >
              Close
            </button>

            <div className="va-decision-buttons">
              <button
                type="button"
                className="va-button va-button-reject"
                disabled={busy || status === "Rejected"}
                onClick={() => handleDecision(application, "Rejected")}
              >
                {busy ? (
                  <LoaderCircle size={17} className="va-spin" />
                ) : (
                  <XCircle size={17} />
                )}
                Reject
              </button>

              <button
                type="button"
                className="va-button va-button-approve"
                disabled={busy || status === "Approved"}
                onClick={() => handleDecision(application, "Approved")}
              >
                {busy ? (
                  <LoaderCircle size={17} className="va-spin" />
                ) : (
                  <CheckCircle2 size={17} />
                )}
                Approve
              </button>
            </div>
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
          <h1>Vehicle applications</h1>
          <p>
            Review vehicle registration submissions and manage administrative
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
        <Metric
          label="Total applications"
          value={counts.all}
          icon={<FileText size={21} />}
          tone="blue"
        />
        <Metric
          label="Awaiting review"
          value={counts.pending}
          icon={<Clock3 size={21} />}
          tone="amber"
        />
        <Metric
          label="Approved"
          value={counts.approved}
          icon={<CheckCircle2 size={21} />}
          tone="green"
        />
        <Metric
          label="Rejected"
          value={counts.rejected}
          icon={<XCircle size={21} />}
          tone="red"
        />
      </div>

      <div className="va-workspace-card">
        <div className="va-list-heading">
          <div>
            <h2>Registration submissions</h2>
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
              placeholder="Search reference, citizen, ID or vehicle..."
              aria-label="Search vehicle applications"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as StatusFilter)
            }
            aria-label="Filter by application status"
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
            <strong>Loading applications</strong>
            <span>Connecting to Firestore...</span>
          </div>
        ) : !loadError && filteredApplications.length === 0 ? (
          <div className="va-empty-state">
            <div className="va-empty-icon">
              <CarFront size={29} />
            </div>
            <strong>
              {applications.length === 0
                ? "No vehicle applications yet"
                : "No matching applications"}
            </strong>
            <span>
              {applications.length === 0
                ? "Applications submitted by citizens will appear here."
                : "Try changing your search or status filter."}
            </span>
          </div>
        ) : (
          <div className="va-table-scroll">
            <table className="va-table">
              <thead>
                <tr>
                  <th>Application</th>
                  <th>Applicant</th>
                  <th>Vehicle</th>
                  <th>Date submitted</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredApplications.map((application) => {
                  const status = normaliseStatus(application.status);

                  return (
                    <tr key={application.id}>
                      <td>
                        <div className="va-reference">
                          <strong>
                            {application.applicationId || application.id}
                          </strong>
                          <span>Vehicle registration</span>
                        </div>
                      </td>

                      <td>
                        <div className="va-applicant-cell">
                          <strong>
                            {application.applicant?.fullName || "Name unavailable"}
                          </strong>
                          <span>
                            {application.applicant?.idNumber || "No ID supplied"}
                          </span>
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
                            {[application.vehicle?.year, application.vehicle?.vehicleType]
                              .filter(Boolean)
                              .join(" · ") || "Details unavailable"}
                          </span>
                        </div>
                      </td>

                      <td className="va-date-cell">
                        {getDate(application.createdAt)}
                      </td>

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
                          onClick={() => setSelectedApplication(application)}
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
            Showing {filteredApplications.length} of {applications.length}{" "}
            application{applications.length === 1 ? "" : "s"}
          </span>
          <span>Source: Firestore / vehicleApplications</span>
        </footer>
      </div>

      {selectedApplication && renderDetails(selectedApplication)}
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
