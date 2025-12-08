import React, { useEffect, useState } from "react";
import Card from "./components/Card";
import VerificationModal from "./components/VerificationModal.js";
import axios from "axios";
import LoadingScreen from "./views/Loading";
import { Link, useNavigate } from "react-router-dom";
import MonthlyIncomeChart from "./components/Charts/MonthlyIncomeChart.js";
import ExpenseOutput from "./components/Charts/ExpenseChart.js";
import MaintenanceChart from "./components/Charts/MaintenanceChart.js";
import OccupancyChart from "./components/Charts/OccupancyChart.js";
import { jwtDecode } from "jwt-decode";

const BASE_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:5050/api"
    : "https://rangeles.online/api";

function Dashboard() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [units, setUnits] = useState([]);
  const [occupancyRate, setOccupancyRate] = useState(0);
  const [maintenances, setMaintenances] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [overdueTenants, setOverdueTenants] = useState([]);
  const [showVerification, setShowVerification] = useState(false);

  const navigate = useNavigate();

// ========================
// 🔐 VERIFY ADMIN / STAFF ONCE PER SESSION
// ========================
useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) return;

    try {
      const decoded = jwtDecode(token);
      const modalShown = sessionStorage.getItem("verificationShown");

      // Fetch full user info from backend
      axios
        .get(`${BASE_URL}/users/${decoded.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => {
          const userData = res.data; // user data includes isVerified
          setCurrentUser(userData);

          if (
            (userData.role === "admin" || userData.role === "staff") &&
            !modalShown &&
            !userData.isVerified // only show modal if NOT verified
          ) {
            setShowVerification(true);
            sessionStorage.setItem("verificationShown", "true");
          }
        })
        .catch((err) => console.error("Error fetching user data:", err));
    } catch (err) {
      console.error("Invalid token", err);
    }
  }, []);


  const handleConfirmVerification = () => {
    setShowVerification(false);

    // ✅ Automatically redirect based on role
    if (currentUser?.role === "admin") {
      navigate("/admin");
    } else if (currentUser?.role === "staff") {
      navigate("/staff");
    }
  };

  const handleCloseVerification = () => {
    setShowVerification(false);
  };

  // ========================
  // 📊 FETCH DASHBOARD DATA
  // ========================
  useEffect(() => {
    axios
      .get(`${BASE_URL}/tenants`)
      .then((res) => {
        const allTenants = res.data.data || [];
        const overdueTenants = allTenants.filter((t) => t.status === "Overdue");
        setTenants(allTenants);
        setOverdueTenants(overdueTenants);
      })
      .catch((err) => console.error("Error fetching tenants:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tenantsRes, paymentsRes] = await Promise.all([
          axios.get(`${BASE_URL}/tenants`),
          axios.get(`${BASE_URL}/payments/all`),
        ]);

        const tenants = tenantsRes.data.data;
        const allPayments = paymentsRes.data.data;

        const todayUTC = new Date(
          Date.UTC(
            new Date().getUTCFullYear(),
            new Date().getUTCMonth(),
            new Date().getUTCDate()
          )
        );
        const last30DaysUTC = new Date(todayUTC);
        last30DaysUTC.setUTCDate(todayUTC.getUTCDate() - 30);

        const recentPayments = allPayments.filter((payment) => {
          const paymentDate = new Date(payment.paymentDate);
          return paymentDate.getTime() >= last30DaysUTC.getTime();
        });

        recentPayments.sort(
          (a, b) =>
            new Date(b.paymentDate).getTime() -
            new Date(a.paymentDate).getTime()
        );

        const paymentsWithNames = recentPayments.map((payment) => {
          // If tenantId is populated
          const tenant = payment.tenantId;
        
          return {
            ...payment,
            tenantName: tenant
              ? `${tenant.firstName} ${tenant.lastName}`
              : "Unknown Tenant",
          };
        });
        
        setPayments(paymentsWithNames);
        console.log("Tenants:", tenants);
        console.log("Payments:", recentPayments);

      } catch (err) {
        console.error("Error fetching payments with tenant names:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    axios
      .get(`${BASE_URL}/units`)
      .then((res) => {
        const allUnits = res.data.data;
        const occupiedCount = allUnits.filter(
          (unit) => unit.status === "Occupied"
        ).length;
        const rate =
          allUnits.length > 0 ? (occupiedCount / allUnits.length) * 100 : 0;
        setOccupancyRate(rate.toFixed(0));
        setUnits(res.data.data);
      })
      .catch((err) => console.error("Error fetching Units:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const fetchMaintenances = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${BASE_URL}/maintenances`);
        const pendingMaintenances = (res.data.data || []).filter(
          (item) => item.status === "Pending"
        );
        setMaintenances(pendingMaintenances);
        const completedMaintenances = (res.data.data || []).filter(
          (item) => item.status === "Completed"
        );
        setCompleted(completedMaintenances);
      } catch (err) {
        console.error("Failed to fetch maintenances:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMaintenances();
  }, []);

  if (loading)
    return (
      <div className="d-flex vh-100 w-100 align-items-center justify-content-center">
        <LoadingScreen />
      </div>
    );

  // ========================
  // 🧭 MAIN DASHBOARD UI
  // ========================
  return (
    <div className="container-fluid position-relative">
      {/* ✅ Show Verification Modal for Admin/Staff */}
      {showVerification && currentUser && (
        <VerificationModal
          show={showVerification}
          user={currentUser}
          onConfirm={handleConfirmVerification}
          onClose={handleCloseVerification}
        />
      )}

      <Card width="100%" height="100%" outline="none" border="none">
        <div className="my-2">
          <div className="justify-content-between d-flex align-items-center m-0">
            <h1 className="numeral-text">Dashboard</h1>
            <div className="border rounded px-3 py-1">
              <span className="text-uppercase fw-bold">
                {currentUser ? currentUser.role : ""}
              </span>
            </div>
          </div>
          <p className="mb-2 text-muted">Overview of your units and tenants.</p>
        </div>

        {/* --- DASHBOARD CARDS --- */}
        <div className="row g-2">
          <div className="col-12 col-md-3">
            <Link to="/tenants" className="text-decoration-none">
              <Card width="100%" height="200px" className="hover-card m-0 p-0">
                <div className="d-flex flex-column justify-content-center">
                  <div className="d-flex align-items-center gap-2">
                    <i className="fs-5 fa fa-solid fa-user-group"></i>
                    <p className="fs-5 my-1">Active Tenants</p>
                    <i className="ms-auto fs-5 fa fa-solid fa-up-right-from-square"></i>
                  </div>
                  <h3 className="mb-0 numeral-text">{tenants.length}</h3>
                </div>
              </Card>
            </Link>
          </div>

          <div className="col-12 col-md-3">
            <Link to="/units" className="text-decoration-none">
              <Card width="100%" height="200px" className="hover-card">
                <div className="w-100 h-100 d-flex flex-column justify-content-center">
                  <div className="d-flex align-items-center gap-2">
                    <i className="fs-5 fa fa-solid fa-chart-simple"></i>
                    <p className="fs-5 my-1">Occupancy Rate</p>
                    <i className="ms-auto fs-5 fa fa-solid fa-up-right-from-square"></i>
                  </div>
                  <OccupancyChart />
                </div>
              </Card>
            </Link>
          </div>

          <div className="col-12 col-md-3">
            <Card width="100%" height="200px" className="hover-card">
              <div className="d-flex flex-column justify-content-center">
                <div className="d-flex align-items-center gap-2">
                  <i className="fs-5 fa fa-solid fa-warning"></i>
                  <p className="fs-5 my-1">Overdue Tenants</p>
                </div>
                <h3 className="mb-0 numeral-text">{overdueTenants.length}</h3>
              </div>
            </Card>
          </div>

          <div className="col-12 col-md-3">
            <Link to="/maintenance" className="text-decoration-none">
              <Card width="100%" height="200px" className="hover-card">
                <div className="w-100 h-100 d-flex flex-column justify-content-center">
                  <div className="d-flex flex-row align-items-center mb-2">
                    <i className="fs-5 fa fa-solid fa-wrench"></i>
                    <p className="fs-5 my-1">Maintenance</p>
                    <i className="ms-auto fs-5 fa fa-solid fa-up-right-from-square"></i>
                  </div>
                  <MaintenanceChart />
                </div>
              </Card>
            </Link>
          </div>
        </div>

        {/* --- CHARTS --- */}
        <div className="row g-2 mt-3 mb-3 align-items-stretch">
          <div className="col-12 col-md-9 d-flex">
            <Card className="py-4 px-0 flex-fill">
              <div className="px-3 d-flex flex-column h-100">
                <div className="d-flex flex-row gap-2 align-items-center mb-2">
                  <i className="fs-4 fa-solid fa-chart-simple"></i>
                  <h4 className="mb-0">Income Tracker</h4>
                </div>
                <span className="mb-3 d-block">
                  Track changes in income over time on all payments received
                </span>
                <div className="flex-grow-1">
                  <MonthlyIncomeChart />
                </div>
              </div>
            </Card>
          </div>

          <div className="col-12 col-md-3 d-flex">
            <Card className="p-1 px-0 flex-fill">
              <div className="px-1 d-flex flex-column h-100">
                <div className="d-flex flex-row align-items-center mb-2">
                  <i className="fa me-3 fs-5 fa-solid fa-history text-dark"></i>
                  <span className="mb-0 fs-5">Recent Payments</span>
                </div>
                <div className="flex-grow-1" style={{ overflowY: "auto" }}>
                  {payments.length > 0 ? (
                    <ul className="list-unstyled mb-0">
                      {payments.slice(0, 8).map((payment) => (
                        <li key={payment._id} className="mb-2 hide-scrollbar">
                          <div className="w-100">
                            <span>
                              {payment.tenantName || "Deleted Tenant"}
                            </span>
                            <br />
                            <div className="d-flex flex-row justify-content-between">
                              <span>₱{payment.amount.toLocaleString()}</span>
                              <em>{payment.paymentMethod || "N/A"}</em>
                            </div>
                            <span className="text-muted">
                              {payment.paymentDate
                                ? new Date(
                                    payment.paymentDate
                                  ).toLocaleDateString()
                                : "No Date"}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted">No recent payments</p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* --- OUTPUT TRACKER --- */}
        <Card className="py-4 px-0 flex-fill w-100">
          <div className="px-3 d-flex flex-column h-100">
            <div className="d-flex flex-row gap-2 align-items-center mb-2">
              <i className="fs-4 fa-solid fa-chart-simple"></i>
              <h4 className="mb-0">Output Tracker</h4>
            </div>
            <span className="mb-3 d-block">
              Track changes in outputs over time on all payments made
            </span>
            <div className="flex-grow-1">
              <ExpenseOutput />
            </div>
          </div>
        </Card>
      </Card>
    </div>
  );
}

export default Dashboard;
