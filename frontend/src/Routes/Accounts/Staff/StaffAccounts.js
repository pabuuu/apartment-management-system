import React, { useEffect, useState } from "react";
import axios from "axios";
import LoadingScreen from "../../../views/Loading";
import Notification from "../../../components/Notification";
import { Link, useNavigate } from "react-router-dom";

const BASE_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:5050/api"
    : "https://rangeles.online/api";

function StaffAccounts() {
  const navigate = useNavigate();
  const [staffs, setStaffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ type: "", message: "" });
  const [searchTerm, setSearchTerm] = useState("");

  const fetchStaffs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/users`);
      const data = res.data || [];

      // Only staff with fullName
      const filtered = data.filter((u) => u.role === "staff" && u.fullName);
      setStaffs(filtered);
    } catch (err) {
      console.error("Error fetching staff:", err);
      setNotification({ type: "error", message: "Failed to fetch staff accounts." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffs();
  }, []);

  const filteredStaff = staffs.filter(
    (s) =>
      s.fullName &&
      s.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sorting
  const handleSort = (type) => {
    const sorted = [...staffs];
    if (type === "az") {
      sorted.sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));
    }
    if (type === "za") {
      sorted.sort((a, b) => (b.fullName || "").localeCompare(a.fullName || ""));
    }
    setStaffs(sorted);
  };

  // ============================
  // DELETE STAFF ACCOUNT
  // ============================
  const handleDelete = async (id) => {
    const confirmed = window.confirm("Are you sure you want to delete this staff?");
    if (!confirmed) return;

    try {
      const res = await axios.delete(`${BASE_URL}/users/${id}`);

      if (res.data.success) {
        setNotification({ type: "success", message: "Staff deleted successfully" });
        fetchStaffs(); // Refresh list
      } else {
        setNotification({ type: "error", message: res.data.message });
      }
    } catch (err) {
      console.error("Error deleting staff:", err);
      setNotification({ type: "error", message: "Failed to delete staff." });
    }
  };

  if (loading)
    return (
      <div className="d-flex vh-100 w-100 align-items-center justify-content-center">
        <LoadingScreen />
      </div>
    );

  return (
    <div className="container-fluid">
      <Notification
        type={notification.type}
        message={notification.message}
        onClose={() => setNotification({ type: "", message: "" })}
      />

      <div className="mb-4">
        <h1>Staff Accounts</h1>
        <span>{filteredStaff.length} Staff(s) found</span>
      </div>

      <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
        <Link
          to="/accounts/staff/create"
          style={{
            backgroundColor: "#198754",
            color: "white",
            padding: "6px 16px",
            borderRadius: "6px",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          + Add Staff
        </Link>

        <div className="d-flex flex-wrap gap-2 align-items-center">
          <div className="dropdown">
            <button className="btn btn-outline-dark dropdown-toggle" type="button" data-bs-toggle="dropdown">
              Sort by
            </button>
            <ul className="dropdown-menu">
              <li><button className="dropdown-item" onClick={() => handleSort("az")}>Alphabetical ↑</button></li>
              <li><button className="dropdown-item" onClick={() => handleSort("za")}>Alphabetical ↓</button></li>
            </ul>
          </div>

          <input
            placeholder="Search Name"
            className="custom-input my-1"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {filteredStaff.length > 0 ? (
        <table className="table table-bordered table-hover">
          <thead className="table-dark">
            <tr>
              <th>Full Name</th>
              <th>Role</th>
              <th>Email</th>
              <th>Contact Number</th>
              <th>Verified</th>
              <th>Actions</th> {/* ADDED */}
            </tr>
          </thead>
          <tbody>
            {filteredStaff.map((staff) => (
              <tr
                key={staff._id}
                style={{ cursor: "pointer" }}
                onClick={() => navigate(`/accounts/staff/profile/${staff._id}`)}
              >
                <td>{staff.fullName || "N/A"}</td>
                <td>{staff.role || "N/A"}</td>
                <td>{staff.email || "N/A"}</td>
                <td>{staff.contactNumber || "N/A"}</td>
                <td>{staff.isVerified ? "Yes" : "No"}</td>

                {/* ACTION BUTTONS */}
                <td onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(staff._id)}
                  >
                    Delete
                  </button>
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="text-center py-4 text-muted">No staff accounts found.</div>
      )}
    </div>
  );
}

export default StaffAccounts;
