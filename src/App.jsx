import { useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

import Sidebar from './Sidebar';
import HomePage from './HomePage';
import ConfigPage from './ConfigPage';
import FundDetailView from './FundDetailView';
import AuthPage from './AuthPage';

import { Menu, TrendingUp, RefreshCw, Home, Settings, Layers, LogOut } from 'lucide-react';
import './App.css';

function getTodayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function App() {
  // Firebase Auth State
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // App Navigation State
  const [currentView, setCurrentView] = useState('home'); // 'home' | 'config' | 'detail'
  const [selectedFundId, setSelectedFundId] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Funds stored in Firebase Firestore (defaults to empty [])
  const [funds, setFunds] = useState([]);
  const [fundsLoading, setFundsLoading] = useState(false);

  const [lastRefreshedDate, setLastRefreshedDate] = useState(null);

  // Map of fundId -> { loading, data, latestNavInfo, error }
  const [fundDataMap, setFundDataMap] = useState({});

  // 1. Listen for Firebase Auth State Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch User Funds from Firebase Firestore when logged in (empty by default)
  useEffect(() => {
    if (!user) {
      setFunds([]);
      setFundDataMap({});
      return;
    }

    let isMounted = true;
    setFundsLoading(true);

    async function loadUserFunds() {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userDocRef);

        if (snap.exists() && Array.isArray(snap.data().funds)) {
          if (isMounted) {
            setFunds(snap.data().funds);
            if (snap.data().lastRefreshedDate) {
              setLastRefreshedDate(snap.data().lastRefreshedDate);
            }
          }
        } else {
          // Initialize new user with empty funds list []
          await setDoc(
            userDocRef,
            {
              funds: [],
              email: user.email,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );

          if (isMounted) {
            setFunds([]);
          }
        }
      } catch (err) {
        console.warn('Firestore load notice:', err.message);
        if (isMounted) {
          setFunds([]);
        }
      } finally {
        if (isMounted) setFundsLoading(false);
      }
    }

    loadUserFunds();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Fetch individual fund data from API
  const fetchSingleFundData = useCallback(async (fund) => {
    if (!fund?.baseUrl) return null;

    setFundDataMap((prev) => ({
      ...prev,
      [fund.id]: {
        ...(prev[fund.id] || {}),
        loading: true,
        error: null,
      },
    }));

    try {
      const baseRes = await fetch(fund.baseUrl);
      if (!baseRes.ok) throw new Error(`HTTP ${baseRes.status}: ${baseRes.statusText}`);
      const baseJson = await baseRes.json();

      let latestNavInfo = null;
      if (fund.latestUrl) {
        try {
          const latestRes = await fetch(fund.latestUrl);
          if (latestRes.ok) {
            const latestJson = await latestRes.json();
            if (latestJson?.data?.[0]) {
              latestNavInfo = {
                nav: parseFloat(latestJson.data[0].nav),
                date: latestJson.data[0].date,
              };
            }
          }
        } catch {}
      }

      if (!latestNavInfo && baseJson.data?.[0]) {
        latestNavInfo = {
          nav: parseFloat(baseJson.data[0].nav),
          date: baseJson.data[0].date,
        };
      }

      const result = {
        loading: false,
        data: baseJson,
        latestNavInfo,
        error: null,
      };

      setFundDataMap((prev) => ({ ...prev, [fund.id]: result }));
      return result;
    } catch (err) {
      const errResult = {
        loading: false,
        data: null,
        latestNavInfo: null,
        error: err.message || 'Failed to fetch',
      };
      setFundDataMap((prev) => ({ ...prev, [fund.id]: errResult }));
      return errResult;
    }
  }, []);

  // Fetch all funds and save refresh date to Firebase
  const fetchAllFunds = useCallback(async () => {
    if (funds.length === 0) return;
    setIsRefreshing(true);
    const today = getTodayString();

    try {
      await Promise.all(funds.map((f) => fetchSingleFundData(f)));
      setLastRefreshedDate(today);

      if (user) {
        try {
          await setDoc(
            doc(db, 'users', user.uid),
            {
              lastRefreshedDate: today,
            },
            { merge: true }
          );
        } catch (e) {
          console.warn('Firebase sync date save:', e.message);
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [funds, fetchSingleFundData, user]);

  // Daily auto-refresh check
  const hasCheckedDailyRefresh = useRef(false);
  useEffect(() => {
    if (!user || funds.length === 0) return;
    if (hasCheckedDailyRefresh.current) return;
    hasCheckedDailyRefresh.current = true;

    const today = getTodayString();
    if (lastRefreshedDate !== today || Object.keys(fundDataMap).length === 0) {
      fetchAllFunds();
    }
  }, [user, funds, lastRefreshedDate, fetchAllFunds, fundDataMap]);

  // When funds change, load data
  useEffect(() => {
    if (funds.length > 0) {
      funds.forEach((f) => {
        if (!fundDataMap[f.id]) {
          fetchSingleFundData(f);
        }
      });
    }
  }, [funds, fetchSingleFundData]);

  // 3. Fund Management — Data stored in Firebase Firestore
  const handleAddFund = async (newFund) => {
    const updated = [newFund, ...funds];
    setFunds(updated);
    fetchSingleFundData(newFund);

    // Save directly to Firebase Firestore
    if (user) {
      try {
        await setDoc(
          doc(db, 'users', user.uid),
          {
            funds: updated,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('Firebase save fund error:', err.message);
      }
    }
  };

  const handleDeleteFund = async (fundId) => {
    const updated = funds.filter((f) => f.id !== fundId);
    setFunds(updated);
    setFundDataMap((prev) => {
      const copy = { ...prev };
      delete copy[fundId];
      return copy;
    });

    if (selectedFundId === fundId) {
      setSelectedFundId(null);
      setCurrentView('home');
    }

    // Update in Firebase Firestore
    if (user) {
      try {
        await setDoc(
          doc(db, 'users', user.uid),
          {
            funds: updated,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('Firebase delete fund error:', err.message);
      }
    }
  };

  const handleSelectFund = (fundId) => {
    setSelectedFundId(fundId);
    setCurrentView('detail');
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Sign out error:', e);
    }
    setUser(null);
    setFunds([]);
    setFundDataMap({});
    setCurrentView('home');
  };

  const selectedFund = funds.find((f) => f.id === selectedFundId);

  // Loading spinner while checking Firebase Auth
  if (authLoading) {
    return (
      <div className="auth-loading-viewport">
        <div className="auth-spinner large" />
        <p>Connecting to Firebase...</p>
      </div>
    );
  }

  // Not logged in -> Show Login and Signup page
  if (!user) {
    return <AuthPage onAuthSuccess={(u) => setUser(u)} />;
  }

  return (
    <div className="app-shell">
      {/* Mobile Top Navbar (shown on mobile/tablet) */}
      <header className="mobile-top-header">
        <button
          className="mobile-menu-btn"
          onClick={() => setIsMobileMenuOpen(true)}
          title="Open menu"
        >
          <Menu size={20} />
        </button>

        <div className="mobile-brand">
          <div className="mobile-logo">
            <TrendingUp size={16} />
          </div>
          <span className="mobile-title">
            MF<strong>Analyze</strong>
          </span>
        </div>

        <div className="mobile-header-right">
          <button
            className="mobile-refresh-btn"
            onClick={fetchAllFunds}
            disabled={isRefreshing}
            title="Refresh data"
          >
            <RefreshCw size={16} className={isRefreshing ? 'spinner-icon' : ''} />
          </button>
          <button
            className="mobile-signout-btn"
            onClick={handleSignOut}
            title="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Side Navbar (Desktop sticky, Mobile drawer) */}
      <Sidebar
        currentView={currentView}
        setCurrentView={(view) => {
          setCurrentView(view);
          if (view !== 'detail') setSelectedFundId(null);
        }}
        funds={funds}
        selectedFundId={selectedFundId}
        onSelectFund={handleSelectFund}
        lastRefreshedDate={lastRefreshedDate}
        isRefreshing={isRefreshing}
        onManualRefresh={fetchAllFunds}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
        user={user}
        onSignOut={handleSignOut}
      />

      {/* Main Content Area */}
      <div className="main-viewport">
        {fundsLoading ? (
          <div className="funds-loading-box">
            <div className="card-spinner" />
            <p>Loading your mutual funds from Firebase...</p>
          </div>
        ) : (
          <>
            {currentView === 'home' && (
              <HomePage
                funds={funds}
                fundDataMap={fundDataMap}
                onSelectFund={handleSelectFund}
                onGoToConfig={() => setCurrentView('config')}
                onRefreshAll={fetchAllFunds}
              />
            )}

            {currentView === 'config' && (
              <ConfigPage
                funds={funds}
                onAddFund={handleAddFund}
                onDeleteFund={handleDeleteFund}
              />
            )}

            {currentView === 'detail' && selectedFund && (
              <FundDetailView
                fund={selectedFund}
                fundDataState={fundDataMap[selectedFund.id]}
                onBack={() => setCurrentView('home')}
                onRefresh={() => fetchSingleFundData(selectedFund)}
              />
            )}
          </>
        )}
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav">
        <button
          className={`bottom-nav-item ${currentView === 'home' ? 'active' : ''}`}
          onClick={() => {
            setCurrentView('home');
            setSelectedFundId(null);
          }}
        >
          <Home size={18} />
          <span>Home</span>
        </button>

        <button
          className="bottom-nav-item"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Layers size={18} />
          <span>Funds ({funds.length})</span>
        </button>

        <button
          className={`bottom-nav-item ${currentView === 'config' ? 'active' : ''}`}
          onClick={() => {
            setCurrentView('config');
            setSelectedFundId(null);
          }}
        >
          <Settings size={18} />
          <span>Config</span>
        </button>
      </nav>
    </div>
  );
}
