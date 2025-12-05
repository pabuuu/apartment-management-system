import React, { useEffect, useState } from "react";
import axios from "axios";
import LoadingScreen from "../../../views/Loading";
import Notification from "../../../components/Notification";
import { Link, useNavigate } from "react-router-dom";

const BASE_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:5050/api"
    : "https://rangeles.online/api";

function AdminAccounts() {
  const navigate = useNavigate();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ type: "", message: "" });
  const [searchTerm, setSearchTerm] = useState("");

  const currentAdminId = sessionStorage.getItem("adminId");

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/users`);
      const data = res.data || [];
      const filteredAdmins = data.filter(
        (u) => u.role === "admin" && u.fullName
      );
      setAdmins(filteredAdmins);
    } catch (err) {
      console.error("Error fetching admins:", err);
      setNotification({ type: "error", message: "Failed to fetch admins." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  // DELETE ADMIN FUNCTION
  const handleDelete = async (id) => {
    if (id === currentAdminId) {
      setNotification({
        type: "error",
        message: "You cannot delete your own account.",
      });
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this admin?"
    );
    if (!confirmed) return;

    try {
      const res = await axios.delete(`${BASE_URL}/users/${id}`);

      if (res.data.success) {
        setNotification({
          type: "success",
          message: "Admin deleted successfully.",
        });
        fetchAdmins(); // Refresh
      } else {
        setNotification({
          type: "error",
          message: res.data.message || "Failed to delete admin.",
        });
      }
    } catch (error) {
      console.error("Delete admin error:", error);
      setNotification({
        type: "error",
        message: "Server error while deleting admin.",
      });
    }
  };

  // Filtering
  const filteredAdmins = admins.filter(
    (admin) =>
      admin.fullName &&
      admin.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sorting
  const handleSort = (type) => {
    const sorted = [...admins];
    if (type === "az") {
      sorted.sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));
    }
    if (type === "za") {
      sorted.sort((a, b) => (b.fullName || "").localeCompare(a.fullName || ""));
    }
    setAdmins(sorted);
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
        <h1>Admin Accounts</h1>
        <span>{filteredAdmins.length} Admin(s) found</span>
      </div>

      <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
        <Link
          to="/accounts/admins/create"
          style={{
            backgroundColor: "#198754",
            color: "white",
            padding: "6px 16px",
            borderRadius: "6px",
            fontWeight: 500,
            textDecoration: "none",
            transition: "all 0.2s ease",
            display: "inline-block",
          }}
          onMouseOver={(e) => (e.target.style.backgroundColor = "#146c43")}
          onMouseOut={(e) => (e.target.style.backgroundColor = "#198754")}
        >
          + Add Admin
        </Link>

        <div className="d-flex flex-wrap gap-2 align-items-center">
          <div className="dropdown">
            <button
              className="btn btn-outline-dark dropdown-toggle"
              type="button"
              data-bs-toggle="dropdown"
            >
              Sort by
            </button>
            <ul className="dropdown-menu">
              <li>
                <button
                  className="dropdown-item"
                  onClick={() => handleSort("az")}
                >
                  Alphabetical ↑
                </button>
              </li>
              <li>
                <button
                  className="dropdown-item"
                  onClick={() => handleSort("za")}
                >
                  Alphabetical ↓
                </button>
              </li>
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

      {filteredAdmins.length > 0 ? (
        <table className="table table-bordered table-hover">
          <thead className="table-dark">
            <tr>
              <th>Full Name</th>
              <th>Role</th>
              <th>Email</th>
              <th>Contact Number</th>
              <th>Verified</th>
              <th style={{ width: "110px", textAlign: "center" }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredAdmins.map((admin) => (
              <tr
                key={admin._id}
                style={{ cursor: "pointer" }}
                onClick={() =>
                  navigate(`/accounts/admins/profile/${admin._id}`)
                }
              >
                <td>{admin.fullName || "N/A"}</td>
                <td>{admin.role || "N/A"}</td>
                <td>{admin.email || "N/A"}</td>
                <td>{admin.contactNumber || "N/A"}</td>
                <td>{admin.isVerified ? "Yes" : "No"}</td>

                <td style={{ textAlign: "center" }}>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={(e) => {
                      e.stopPropagation(); // prevents redirect
                      handleDelete(admin._id);
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="text-center py-4 text-muted">
          No admin accounts found.
        </div>
      )}
    </div>
  );
}

export default AdminAccounts;
