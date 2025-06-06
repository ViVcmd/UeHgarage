import React, { useState, useEffect, createContext, useContext } from "react";
import "./App.css";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext();

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      fetchUserInfo();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUserInfo = async () => {
    try {
      const response = await axios.get(`${API}/user/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = (newToken, userData) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, token }}>
      {children}
    </AuthContext.Provider>
  );
};

// Login Component
const LoginScreen = () => {
  const [showInvitation, setShowInvitation] = useState(false);
  const [showAdminCode, setShowAdminCode] = useState(false);
  const [invitationCode, setInvitationCode] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [pendingAuth, setPendingAuth] = useState(null);
  const { login } = useAuth();

  const handleGoogleLogin = () => {
    window.location.href = `${API}/auth/google`;
  };

  const handleInvitationSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      const response = await axios.post(`${API}/auth/invitation`, {
        invitation_code: invitationCode,
        email: email
      });
      
      if (response.data.access_token) {
        login(response.data.access_token, response.data.user);
        setMessage('Welcome! Registration completed successfully.');
      }
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Invalid invitation code');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminCodeSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      await axios.post(`${API}/auth/admin-code`, {
        admin_code: adminCode,
        email: email
      });
      setMessage('Admin privileges granted! Please sign in with Google now.');
      setTimeout(() => handleGoogleLogin(), 2000);
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Invalid admin code');
    } finally {
      setLoading(false);
    }
  };

  // Handle OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const userData = urlParams.get('user');
    const requiresInvitation = urlParams.get('requires_invitation');
    const userEmail = urlParams.get('email');
    const userName = urlParams.get('name');
    
    if (token && userData) {
      try {
        const user = JSON.parse(decodeURIComponent(userData));
        login(token, user);
        window.history.replaceState({}, document.title, "/");
      } catch (error) {
        console.error('Failed to parse user data:', error);
      }
    } else if (requiresInvitation === 'true') {
      setPendingAuth({ email: userEmail, name: userName });
      setEmail(userEmail);
      setShowInvitation(true);
      setMessage('Please provide your invitation code to complete registration.');
      window.history.replaceState({}, document.title, "/");
    }
  }, [login]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Secure Garage Access</h1>
          <p className="text-gray-600">Sign in to control your garage door</p>
        </div>

        {!showInvitation && !showAdminCode ? (
          <div className="space-y-4">
            <button
              onClick={handleGoogleLogin}
              className="w-full bg-white border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center space-x-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Continue with Google</span>
            </button>
            
            <div className="flex space-x-2">
              <button
                onClick={() => setShowInvitation(true)}
                className="flex-1 text-blue-600 hover:text-blue-800 text-sm underline"
              >
                Have invitation code?
              </button>
              <button
                onClick={() => setShowAdminCode(true)}
                className="flex-1 text-purple-600 hover:text-purple-800 text-sm underline"
              >
                Admin setup?
              </button>
            </div>
          </div>
        ) : showInvitation ? (
          <form onSubmit={handleInvitationSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="your.email@example.com"
                disabled={pendingAuth}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Invitation Code</label>
              <input
                type="text"
                value={invitationCode}
                onChange={(e) => setInvitationCode(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Validating...' : 'Complete Registration'}
            </button>
            <button
              type="button"
              onClick={() => {setShowInvitation(false); setPendingAuth(null);}}
              className="w-full text-gray-600 hover:text-gray-800 text-sm"
            >
              Back to login
            </button>
          </form>
        ) : (
          <form onSubmit={handleAdminCodeSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Admin Code</label>
              <input
                type="password"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                placeholder="Enter admin code"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Validating...' : 'Setup Admin Access'}
            </button>
            <button
              type="button"
              onClick={() => setShowAdminCode(false)}
              className="w-full text-gray-600 hover:text-gray-800 text-sm"
            >
              Back to login
            </button>
          </form>
        )}
        
        {message && (
          <div className={`mt-4 p-3 rounded-lg text-sm ${
            message.includes('success') || message.includes('granted') || message.includes('Welcome')
              ? 'bg-green-100 text-green-700' 
              : 'bg-red-100 text-red-700'
          }`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

// Main Garage Control Screen
const GarageControl = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [lastAction, setLastAction] = useState(null);
  const [currentView, setCurrentView] = useState('garage');
  const { user, token, logout } = useAuth();

  const openGarage = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      const response = await axios.post(`${API}/garage/open`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMessage('Garage door activated successfully!');
      setLastAction(new Date().toLocaleTimeString());
      
      setTimeout(() => setMessage(''), 5000);
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Failed to open garage door');
    } finally {
      setLoading(false);
    }
  };

  if (currentView === 'admin' && user?.is_admin) {
    return <AdminDashboard onBack={() => setCurrentView('garage')} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Garage Control</h1>
              <p className="text-gray-600">Welcome, {user?.name || user?.email}</p>
            </div>
            <div className="flex items-center space-x-4">
              {user?.is_admin && (
                <button
                  onClick={() => setCurrentView('admin')}
                  className="bg-purple-100 text-purple-800 px-4 py-2 rounded-full text-sm font-medium hover:bg-purple-200 transition-colors"
                >
                  Admin Panel
                </button>
              )}
              <button
                onClick={logout}
                className="text-red-600 hover:text-red-800 text-sm underline"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Main Control */}
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-32 h-32 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-8">
            <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Garage Door Control</h2>
          <p className="text-gray-600 mb-8">Press the button below to open your garage door</p>
          
          <button
            onClick={openGarage}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 px-12 rounded-2xl text-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:transform-none shadow-lg"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Opening...
              </span>
            ) : (
              'Open Garage'
            )}
          </button>
          
          {lastAction && (
            <p className="text-gray-500 mt-4 text-sm">
              Last opened: {lastAction}
            </p>
          )}
        </div>

        {/* Status Messages */}
        {message && (
          <div className={`mt-6 p-4 rounded-lg text-center ${
            message.includes('success') 
              ? 'bg-green-100 text-green-700' 
              : 'bg-red-100 text-red-700'
          }`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

// Comprehensive Admin Dashboard
const AdminDashboard = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [invitationCodes, setInvitationCodes] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [blacklist, setBlacklist] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Form states
  const [newEmail, setNewEmail] = useState('');
  const [blacklistReason, setBlacklistReason] = useState('');
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  
  const { token } = useAuth();

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'overview':
          const [statsRes, settingsRes] = await Promise.all([
            axios.get(`${API}/admin/stats`, { headers }),
            axios.get(`${API}/admin/settings`, { headers })
          ]);
          setStats(statsRes.data);
          setSettings(settingsRes.data);
          break;
        case 'users':
          const usersRes = await axios.get(`${API}/admin/users`, { headers });
          setUsers(usersRes.data);
          break;
        case 'invitations':
          const codesRes = await axios.get(`${API}/admin/invitation-codes`, { headers });
          setInvitationCodes(codesRes.data);
          break;
        case 'access':
          const [whitelistRes, blacklistRes] = await Promise.all([
            axios.get(`${API}/admin/whitelist`, { headers }),
            axios.get(`${API}/admin/blacklist`, { headers })
          ]);
          setWhitelist(whitelistRes.data);
          setBlacklist(blacklistRes.data);
          break;
        case 'logs':
          const logsRes = await axios.get(`${API}/admin/audit-logs?limit=50`, { headers });
          setAuditLogs(logsRes.data.logs);
          break;
      }
    } catch (error) {
      setMessage('Failed to fetch data: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const generateInvitationCode = async () => {
    try {
      await axios.post(`${API}/admin/invitation-codes`, {}, { headers });
      setMessage('Invitation code generated successfully!');
      fetchData();
    } catch (error) {
      setMessage('Failed to generate invitation code');
    }
  };

  const addToWhitelist = async () => {
    if (!newEmail) return;
    try {
      await axios.post(`${API}/admin/whitelist`, { email: newEmail }, { headers });
      setMessage(`Email ${newEmail} added to whitelist`);
      setNewEmail('');
      fetchData();
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Failed to add to whitelist');
    }
  };

  const addToBlacklist = async () => {
    if (!newEmail || !blacklistReason) return;
    try {
      await axios.post(`${API}/admin/blacklist`, { 
        email: newEmail, 
        reason: blacklistReason 
      }, { headers });
      setMessage(`Email ${newEmail} added to blacklist`);
      setNewEmail('');
      setBlacklistReason('');
      fetchData();
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Failed to add to blacklist');
    }
  };

  const removeFromWhitelist = async (email) => {
    try {
      await axios.delete(`${API}/admin/whitelist/${email}`, { headers });
      setMessage(`Email ${email} removed from whitelist`);
      fetchData();
    } catch (error) {
      setMessage('Failed to remove from whitelist');
    }
  };

  const removeFromBlacklist = async (email) => {
    try {
      await axios.delete(`${API}/admin/blacklist/${email}`, { headers });
      setMessage(`Email ${email} removed from blacklist`);
      fetchData();
    } catch (error) {
      setMessage('Failed to remove from blacklist');
    }
  };

  const toggleUserStatus = async (userId, isActive) => {
    try {
      await axios.put(`${API}/admin/users/${userId}/status`, { is_active: !isActive }, { headers });
      setMessage('User status updated');
      fetchData();
    } catch (error) {
      setMessage('Failed to update user status');
    }
  };

  const toggleAdminStatus = async (userId, isAdmin) => {
    try {
      await axios.put(`${API}/admin/users/${userId}/admin`, { is_admin: !isAdmin }, { headers });
      setMessage('Admin status updated');
      fetchData();
    } catch (error) {
      setMessage('Failed to update admin status');
    }
  };

  const toggleMaintenanceMode = async () => {
    try {
      await axios.put(`${API}/admin/settings/maintenance`, {
        enabled: !settings?.maintenance_mode,
        message: maintenanceMessage || 'System under maintenance'
      }, { headers });
      setMessage(`Maintenance mode ${!settings?.maintenance_mode ? 'enabled' : 'disabled'}`);
      fetchData();
    } catch (error) {
      setMessage('Failed to toggle maintenance mode');
    }
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: '📊' },
    { id: 'users', name: 'Users', icon: '👥' },
    { id: 'invitations', name: 'Invitations', icon: '🎫' },
    { id: 'access', name: 'Access Control', icon: '🔒' },
    { id: 'logs', name: 'Audit Logs', icon: '📋' },
    { id: 'settings', name: 'Settings', icon: '⚙️' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            {settings?.maintenance_mode && (
              <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                Maintenance Mode Active
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-md ${
            message.includes('success') || message.includes('added') || message.includes('generated')
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message}
            <button 
              onClick={() => setMessage('')}
              className="ml-4 text-sm underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tab Content */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-2">Total Users</h3>
                  <p className="text-3xl font-bold text-blue-600">{stats.users.total}</p>
                  <p className="text-sm text-gray-500">{stats.users.active} active</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-2">Invitations</h3>
                  <p className="text-3xl font-bold text-green-600">{stats.invitations.available}</p>
                  <p className="text-sm text-gray-500">{stats.invitations.used} used</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-2">This Week</h3>
                  <p className="text-lg font-bold">{stats.recent_activity.logins_this_week} logins</p>
                  <p className="text-lg font-bold">{stats.recent_activity.garage_opens_this_week} garage opens</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-2">Access Control</h3>
                  <p className="text-sm">Whitelisted: {stats.access_control.whitelisted_emails}</p>
                  <p className="text-sm">Blacklisted: {stats.access_control.blacklisted_emails}</p>
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b">
                  <h3 className="text-lg font-medium">User Management</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.email}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {user.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              user.is_admin ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {user.is_admin ? 'Admin' : 'User'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                            <button
                              onClick={() => toggleUserStatus(user.id, user.is_active)}
                              className={`px-3 py-1 rounded text-xs ${
                                user.is_active 
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                                  : 'bg-green-100 text-green-700 hover:bg-green-200'
                              }`}
                            >
                              {user.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => toggleAdminStatus(user.id, user.is_admin)}
                              className={`px-3 py-1 rounded text-xs ${
                                user.is_admin 
                                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                              }`}
                            >
                              {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Invitations Tab */}
            {activeTab === 'invitations' && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Invitation Codes</h3>
                    <button
                      onClick={generateInvitationCode}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                      Generate New Code
                    </button>
                  </div>
                  <div className="space-y-3">
                    {invitationCodes.slice(0, 10).map((code) => (
                      <div key={code.id} className="flex justify-between items-center p-3 border rounded">
                        <div className="flex-1">
                          <div className="font-mono text-sm">{code.code}</div>
                          <div className="text-xs text-gray-500">
                            Created: {new Date(code.created_at).toLocaleDateString()} • 
                            Expires: {new Date(code.expires_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs ${
                          code.is_used ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {code.is_used ? 'Used' : 'Available'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Access Control Tab */}
            {activeTab === 'access' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Whitelist */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-medium mb-4">Email Whitelist</h3>
                  <div className="space-y-4">
                    <div className="flex space-x-2">
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="email@example.com"
                        className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <button
                        onClick={addToWhitelist}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                      >
                        Add
                      </button>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {whitelist.map((entry) => (
                        <div key={entry.id} className="flex justify-between items-center p-2 border rounded">
                          <span className="text-sm">{entry.email}</span>
                          <button
                            onClick={() => removeFromWhitelist(entry.email)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Blacklist */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-medium mb-4">Email Blacklist</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="email@example.com"
                        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                      <input
                        type="text"
                        value={blacklistReason}
                        onChange={(e) => setBlacklistReason(e.target.value)}
                        placeholder="Reason for blacklisting"
                        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                      <button
                        onClick={addToBlacklist}
                        className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                      >
                        Add to Blacklist
                      </button>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {blacklist.map((entry) => (
                        <div key={entry.id} className="p-3 border rounded">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="text-sm font-medium">{entry.email}</div>
                              <div className="text-xs text-gray-500">{entry.reason}</div>
                            </div>
                            <button
                              onClick={() => removeFromBlacklist(entry.email)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Audit Logs Tab */}
            {activeTab === 'logs' && (
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b">
                  <h3 className="text-lg font-medium">Audit Logs</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {auditLogs.map((log) => (
                        <tr key={log.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.user_email}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              log.action === 'garage_open' ? 'bg-blue-100 text-blue-800' :
                              log.action === 'login' ? 'bg-green-100 text-green-800' :
                              log.action.includes('admin') ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {Object.keys(log.details).length > 0 ? JSON.stringify(log.details, null, 1).replace(/[\{\}"]/g, '') : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.ip_address || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-medium mb-4">System Settings</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded">
                      <div>
                        <h4 className="font-medium">Maintenance Mode</h4>
                        <p className="text-sm text-gray-500">
                          When enabled, only admins can access the system
                        </p>
                      </div>
                      <button
                        onClick={toggleMaintenanceMode}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings?.maintenance_mode ? 'bg-red-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            settings?.maintenance_mode ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    {settings?.maintenance_mode && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Maintenance Message
                        </label>
                        <input
                          type="text"
                          value={maintenanceMessage}
                          onChange={(e) => setMaintenanceMessage(e.target.value)}
                          placeholder={settings?.maintenance_message}
                          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Main App
const App = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-blue-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="App">
      {!user ? <LoginScreen /> : <GarageControl />}
    </div>
  );
};

const AppWithAuth = () => (
  <AuthProvider>
    <App />
  </AuthProvider>
);

export default AppWithAuth;
