
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  AlertCircle,
  CarFront,
  CheckCircle2,
  Eye,
  FileText,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { db } from "../firebase";
import "./Citizens.css";

// Change to "users" if that is the actual Firestore collection.
const CITIZENS_COLLECTION = "citizens";

type Citizen = {
  id: string;
  fullName?: string;
  idNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  postalAddress?: string;
  birthDate?: string;
  gender?: string;
  lastLoginAt?: string;
  driverLicense?: {
    number?: string;
    class?: string;
    status?: string;
    expiryDate?: string;
  };
  digitalLicense?: {
    enabled?: boolean;
  };
  vehicles?: Array<{
    vehicleId?: string;
    make?: string;
    model?: string;
    registrationNumber?: string;
    year?: number;
    colour?: string;
    verified?: boolean;
  }>;
  vehicleCount?: number;
  ownership?: {
    verified?: boolean;
  };
};

type FilterType = "all" | "vehicles" | "licences";

function readCitizen(
  doc: QueryDocumentSnapshot<DocumentData>,
): Citizen {
  const data = doc.data();

  return {
    ...data,
    id: doc.id,
  } as Citizen;
}

function maskId(value?: string) {
  if (!value) return "Not provided";
  if (value.length <= 4) return value;
  return `${"•".repeat(Math.min(value.length - 4, 10))}${value.slice(-4)}`;
}

function formatDate(value?: string) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function licenceIsValid(citizen: Citizen) {
  const licence = citizen.driverLicense;
  if (!licence) return false;

  const expiry = licence.expiryDate
    ? new Date(`${licence.expiryDate}T23:59:59`)
    : null;

  return (
    licence.status?.toLowerCase() === "valid" &&
    !!expiry &&
    !Number.isNaN(expiry.getTime()) &&
    expiry.getTime() >= Date.now()
  );
}

export default function Citizens() {
  const [citizens, setCitizens] = useState<Citizen[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedCitizen, setSelectedCitizen] =
    useState<Citizen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    const unsubscribe = onSnapshot(
      collection(db, CITIZENS_COLLECTION),
      (snapshot) => {
        const records = snapshot.docs.map(readCitizen);

        records.sort((a, b) =>
          (a.fullName || "").localeCompare(b.fullName || ""),
        );

        setCitizens(records);
        setLoading(false);
        setError("");
      },
      (err) => {
        console.error("Citizens Firestore error:", err);
        setError(
          "Could not load citizen records. Check the collection name, Firebase connection and Firestore security rules.",
        );
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const filteredCitizens = useMemo(() => {
    const term = search.trim().toLowerCase();

    return citizens.filter((citizen) => {
      const matchesSearch =
        !term ||
        [
          citizen.fullName,
          citizen.idNumber,
          citizen.phone,
          citizen.email,
          citizen.address,
          citizen.postalAddress,
          citizen.driverLicense?.number,
          citizen.vehicles
            ?.map((vehicle) => vehicle.registrationNumber)
            .join(" "),
        ].some((value) => String(value ?? "").toLowerCase().includes(term));

      const matchesFilter =
        filter === "all" ||
        (filter === "vehicles" &&
          ((citizen.vehicles?.length ?? 0) > 0 ||
            (citizen.vehicleCount ?? 0) > 0)) ||
        (filter === "licences" && !!citizen.driverLicense);

      return matchesSearch && matchesFilter;
    });
  }, [citizens, search, filter]);

  const vehicleOwners = citizens.filter(
    (citizen) =>
      (citizen.vehicles?.length ?? 0) > 0 ||
      (citizen.vehicleCount ?? 0) > 0,
  ).length;

  const licenceHolders = citizens.filter(
    (citizen) => !!citizen.driverLicense,
  ).length;

  return (
    <section className="citizens-page">
      <div className="citizens-heading">
        <div>
          <p className="citizens-eyebrow">
            TRAFFICCONNECT / ADMINISTRATION
          </p>
          <h1>Citizens</h1>
          <p className="citizens-description">
            View and search citizen accounts registered in TrafficConnect SA.
          </p>
        </div>

        <button
          type="button"
          className="citizens-refresh"
          onClick={() => {
            setError("");
            setLoading(true);
            // The Firestore listener will deliver its next snapshot.
            // Reloading the page is not necessary.
          }}
          title="Refresh listener state"
        >
          <RefreshCw size={17} />
          <span>Live records</span>
        </button>
      </div>

      <div className="citizens-stats">
        <article className="citizen-stat-card">
          <div className="citizen-stat-icon blue">
            <UserRound size={22} />
          </div>
          <div>
            <p>Total citizens</p>
            <h2>{loading ? "—" : citizens.length}</h2>
            <span>Registered accounts</span>
          </div>
        </article>

        <article className="citizen-stat-card">
          <div className="citizen-stat-icon green">
            <CarFront size={22} />
          </div>
          <div>
            <p>Vehicle owners</p>
            <h2>{loading ? "—" : vehicleOwners}</h2>
            <span>Records with vehicles</span>
          </div>
        </article>

        <article className="citizen-stat-card">
          <div className="citizen-stat-icon purple">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p>Licence holders</p>
            <h2>{loading ? "—" : licenceHolders}</h2>
            <span>Records with licences</span>
          </div>
        </article>
      </div>

      <div className="citizens-table-panel">
        <div className="citizens-table-heading">
          <div>
            <h2>Citizen registry</h2>
            <p>Search the records available in Firestore.</p>
          </div>
          <span className="citizens-record-count">
            {loading ? "Loading..." : `${filteredCitizens.length} records`}
          </span>
        </div>

        <div className="citizens-controls">
          <div className="citizens-search">
            <Search size={19} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, ID, phone, email or vehicle..."
              aria-label="Search citizens"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X size={17} />
              </button>
            )}
          </div>

          <select
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value as FilterType)
            }
            aria-label="Filter citizens"
          >
            <option value="all">All citizens</option>
            <option value="vehicles">With vehicles</option>
            <option value="licences">With driver licences</option>
          </select>
        </div>

        {error && (
          <div className="citizens-error">
            <AlertCircle size={19} />
            <span>{error}</span>
          </div>
        )}

        <div className="citizens-table-scroll">
          <table className="citizens-table">
            <thead>
              <tr>
                <th>Citizen</th>
                <th>Citizen ID</th>
                <th>Contact</th>
                <th>Vehicles</th>
                <th>Driver licence</th>
                <th>Last login</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="citizens-empty">
                    <RefreshCw className="citizens-loading-icon" size={22} />
                    <span>Loading citizen records from Firebase...</span>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="citizens-empty">
                    Citizen records could not be loaded.
                  </td>
                </tr>
              ) : filteredCitizens.length === 0 ? (
                <tr>
                  <td colSpan={7} className="citizens-empty">
                    No citizens match your search.
                  </td>
                </tr>
              ) : (
                filteredCitizens.map((citizen) => {
                  const vehicleTotal = Math.max(
                    citizen.vehicles?.length ?? 0,
                    citizen.vehicleCount ?? 0,
                  );

                  const validLicence = licenceIsValid(citizen);

                  return (
                    <tr key={citizen.id}>
                      <td>
                        <div className="citizen-name-cell">
                          <div className="citizen-avatar">
                            <UserRound size={19} />
                          </div>
                          <div>
                            <strong>
                              {citizen.fullName || "Name unavailable"}
                            </strong>
                            <span>Ref: {citizen.id}</span>
                          </div>
                        </div>
                      </td>

                      <td className="citizen-id-cell">
                        {maskId(citizen.idNumber)}
                      </td>

                      <td>
                        <div className="citizen-contact-cell">
                          <span>{citizen.phone || "No phone"}</span>
                          <span>{citizen.email || "No email"}</span>
                        </div>
                      </td>

                      <td>
                        <span className="citizen-count-badge">
                          <CarFront size={15} />
                          {vehicleTotal}
                        </span>
                      </td>

                      <td>
                        {citizen.driverLicense ? (
                          <span
                            className={`citizen-status ${
                              validLicence ? "status-valid" : "status-review"
                            }`}
                          >
                            {validLicence ? (
                              <CheckCircle2 size={14} />
                            ) : (
                              <AlertCircle size={14} />
                            )}
                            {validLicence ? "Valid" : "Check status"}
                          </span>
                        ) : (
                          <span className="citizen-status status-neutral">
                            Not recorded
                          </span>
                        )}
                      </td>

                      <td>{formatDate(citizen.lastLoginAt)}</td>

                      <td>
                        <button
                          type="button"
                          className="citizen-view-button"
                          onClick={() => setSelectedCitizen(citizen)}
                        >
                          <Eye size={16} />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="citizens-table-footer">
          <span>
            Showing {filteredCitizens.length} of {citizens.length} records
          </span>
          <span>
            <span className="citizens-live-dot" /> Firestore listener
          </span>
        </div>
      </div>

      {selectedCitizen && (
        <div
          className="citizen-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedCitizen(null);
            }
          }}
        >
          <section
            className="citizen-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="citizen-modal-title"
          >
            <div className="citizen-modal-header">
              <div className="citizen-modal-person">
                <div className="citizen-avatar citizen-avatar-large">
                  <UserRound size={25} />
                </div>
                <div>
                  <h2 id="citizen-modal-title">
                    {selectedCitizen.fullName || "Citizen details"}
                  </h2>
                  <p>Citizen record · {selectedCitizen.id}</p>
                </div>
              </div>

              <button
                type="button"
                className="citizen-modal-close"
                onClick={() => setSelectedCitizen(null)}
                aria-label="Close citizen details"
              >
                <X size={21} />
              </button>
            </div>

            <div className="citizen-modal-body">
              <h3>Personal information</h3>
              <div className="citizen-detail-grid">
                <Detail label="Full name" value={selectedCitizen.fullName} />
                <Detail
                  label="Citizen ID"
                  value={selectedCitizen.idNumber}
                />
                <Detail label="Phone" value={selectedCitizen.phone} />
                <Detail label="Email" value={selectedCitizen.email} />
                <Detail
                  label="Date of birth"
                  value={selectedCitizen.birthDate}
                />
                <Detail label="Gender" value={selectedCitizen.gender} />
                <Detail
                  label="Residential address"
                  value={selectedCitizen.address}
                />
                <Detail
                  label="Postal address"
                  value={selectedCitizen.postalAddress}
                />
                <Detail
                  label="Last login"
                  value={formatDate(selectedCitizen.lastLoginAt)}
                />
              </div>

              <h3>Driving licence</h3>
              {selectedCitizen.driverLicense ? (
                <div className="citizen-license-panel">
                  <div className="citizen-license-icon">
                    <ShieldCheck size={22} />
                  </div>
                  <div className="citizen-license-copy">
                    <strong>
                      {selectedCitizen.driverLicense.number || "Number unavailable"}
                    </strong>
                    <span>
                      Class {selectedCitizen.driverLicense.class || "N/A"}
                    </span>
                    <span>
                      Expiry:{" "}
                      {formatDate(selectedCitizen.driverLicense.expiryDate)}
                    </span>
                    <span>
                      Status: {selectedCitizen.driverLicense.status || "Not recorded"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="citizen-detail-empty">
                  No driver licence is recorded on this profile.
                </p>
              )}

              <h3>Vehicles ({selectedCitizen.vehicles?.length ?? 0})</h3>
              {selectedCitizen.vehicles?.length ? (
                <div className="citizen-vehicle-list">
                  {selectedCitizen.vehicles.map((vehicle, index) => (
                    <div
                      className="citizen-vehicle-card"
                      key={vehicle.vehicleId || vehicle.registrationNumber || index}
                    >
                      <CarFront size={21} />
                      <div>
                        <strong>
                          {[vehicle.make, vehicle.model]
                            .filter(Boolean)
                            .join(" ") || "Vehicle"}
                        </strong>
                        <span>
                          Registration: {vehicle.registrationNumber || "N/A"}
                        </span>
                        <span>
                          {vehicle.year || "Year unknown"} ·{" "}
                          {vehicle.colour || "Colour unknown"}
                        </span>
                      </div>
                      <span
                        className={`citizen-status ${
                          vehicle.verified ? "status-valid" : "status-neutral"
                        }`}
                      >
                        {vehicle.verified ? "Verified" : "Unverified"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="citizen-detail-empty">
                  No vehicle details are stored in this citizen document.
                  {selectedCitizen.vehicleCount
                    ? ` The record reports ${selectedCitizen.vehicleCount} vehicle(s).`
                    : ""}
                </p>
              )}

              <h3>Digital licence</h3>
              <div className="citizen-digital-license">
                <FileText size={19} />
                <span>
                  {selectedCitizen.digitalLicense?.enabled
                    ? "Digital licence enabled"
                    : "Digital licence not enabled or not recorded"}
                </span>
              </div>
            </div>

            <div className="citizen-modal-footer">
              <span>Read-only profile</span>
              <button
                type="button"
                onClick={() => setSelectedCitizen(null)}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value?: string | number;
}) {
  return (
    <div className="citizen-detail-item">
      <span>{label}</span>
      <strong>{value || "Not provided"}</strong>
    </div>
  );
}
