import React, { Component } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import AdvancedAudioPlayer from "./components/Dashboard/AdvancedAudioPlayer";
import InboxRoute from "./components/Dashboard/InboxRoute";
import SettingsPage from "./components/Settings/SettingsPage";
import UserManagement from "./components/Users/index";
import LogsPage from "./components/Logs/LogsPage";
import ReportPage from "./components/ReportPage";
import UserProfile from "./components/UserProfile";
import UserGuidePage from "./components/Documentation/UserGuidePage";
import ReleasePage from "./components/ReleasePage";
import VersionPage from "./components/Version/VersionPage";
import LicenseSubscriptionPage from "./components/Licensing/LicenseSubscriptionPage";
import { PrivateRoute } from "./components/PrivateRoute";
import LoginPage from "./components/LoginPage";
import { ToastContainer } from "react-toastify";
import Button from "./components/ui/Button";
import cardStyles from "./components/ui/Card.module.css";
import "react-toastify/dist/ReactToastify.css";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="centeredContent">
          <div className={`${cardStyles.card} stack`}>
            <h2>Something went wrong.</h2>
            <p className={cardStyles.description}>{this.state.error?.message}</p>
            <Button
              variant="primary"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const App = () => {
  document.title = "Boondock Edge Server";

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<PrivateRoute />}>
            <Route path="/" element={<InboxRoute />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/profile" element={<UserProfile />} />
            <Route path="/advanced-player" element={<AdvancedAudioPlayer />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/user-guide" element={<UserGuidePage />} />
            <Route path="/release" element={<ReleasePage />} />
            <Route path="/version" element={<VersionPage />} />
            <Route path="/license" element={<LicenseSubscriptionPage />} />
          </Route>
        </Routes>
      </Router>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        limit={3}
        enableMultiContainer={false}
      />
    </ErrorBoundary>
  );
};

export default App;
