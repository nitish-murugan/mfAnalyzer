import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './Sidebar';
import HomePage from './HomePage';
import ConfigPage from './ConfigPage';
import FundDetailView from './FundDetailView';
import { Menu, TrendingUp, RefreshCw, Home, Settings, Layers } from 'lucide-react';
import './App.css';

const DEFAULT_FUNDS = [
  {
    id: 'fund_hdfc_midcap',
    name: 'HDFC Mid Cap Fund - Direct Plan - Growth Option',
    baseUrl: 'https://api.mfapi.in/mf/118989',
    latestUrl: 'https://api.mfapi.in/mf/118989/latest',
  },
  {
    id: 'fund_parag_parikh',
    name: 'Parag Parikh Flexi Cap Fund - Direct Plan - Growth',
    baseUrl: 'https://api.mfapi.in/mf/122639',
    latestUrl: 'https://api.mfapi.in/mf/122639/latest',
  },
];

function getTodayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function App() {
  const [currentView, setCurrentView] = useState('home'); // 'home' | 'config' | 'detail'
  const [selectedFundId, setSelectedFundId] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [lastRefreshedDate, setLastRefreshedDate] = useState(() => {
    return localStorage.getItem('mf_last_refreshed_date') || null;
  });

  const [funds, setFunds] = useState(() => {
    try {
      const saved = localStorage.getItem('mf_configured_funds');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_FUNDS;
  });

  // Map of fundId -> { loading, data, latestNavInfo, error }
  const [fundDataMap, setFundDataMap] = useState(() => {
    try {
      const cached = localStorage.getItem('mf_cached_fund_data');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // fallback
    }
    return {};
  });

  // Fetch individual fund data
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
        } catch {
          // Ignore latest nav fetch failure and fallback
        }
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

      setFundDataMap((prev) => {
        const next = { ...prev, [fund.id]: result };
        try {
          localStorage.setItem('mf_cached_fund_data', JSON.stringify(next));
        } catch {}
        return next;
      });

      return result;
    } catch (err) {
      const errResult = {
        loading: false,
        data: null,
        latestNavInfo: null,
        error: err.message || 'Failed to fetch',
      };
      setFundDataMap((prev) => ({
        ...prev,
        [fund.id]: errResult,
      }));
      return errResult;
    }
  }, []);

  // Fetch all funds and update daily refresh marker
  const fetchAllFunds = useCallback(async () => {
    setIsRefreshing(true);
    const today = getTodayString();

    try {
      await Promise.all(funds.map((f) => fetchSingleFundData(f)));
      setLastRefreshedDate(today);
      localStorage.setItem('mf_last_refreshed_date', today);
    } finally {
      setIsRefreshing(false);
    }
  }, [funds, fetchSingleFundData]);

  // DAILY AUTO-REFRESH CHECK
  const hasCheckedDailyRefresh = useRef(false);
  useEffect(() => {
    if (hasCheckedDailyRefresh.current) return;
    hasCheckedDailyRefresh.current = true;

    const today = getTodayString();
    const storedLastDate = localStorage.getItem('mf_last_refreshed_date');

    if (storedLastDate !== today || Object.keys(fundDataMap).length === 0) {
      fetchAllFunds();
    }
  }, [fetchAllFunds, fundDataMap]);

  // Save funds list to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('mf_configured_funds', JSON.stringify(funds));
    } catch {}
  }, [funds]);

  // Fund management callbacks
  const handleAddFund = (newFund) => {
    setFunds((prev) => [newFund, ...prev]);
    fetchSingleFundData(newFund);
  };

  const handleDeleteFund = (fundId) => {
    setFunds((prev) => prev.filter((f) => f.id !== fundId));
    setFundDataMap((prev) => {
      const copy = { ...prev };
      delete copy[fundId];
      try {
        localStorage.setItem('mf_cached_fund_data', JSON.stringify(copy));
      } catch {}
      return copy;
    });
    if (selectedFundId === fundId) {
      setSelectedFundId(null);
      setCurrentView('home');
    }
  };

  const handleResetDefaults = () => {
    setFunds(DEFAULT_FUNDS);
    setCurrentView('home');
    fetchAllFunds();
  };

  const handleSelectFund = (fundId) => {
    setSelectedFundId(fundId);
    setCurrentView('detail');
  };

  const selectedFund = funds.find((f) => f.id === selectedFundId);

  return (
    <div className="app-shell">
      {/* Mobile Top Navbar (shown only on mobile/tablet) */}
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
          <span className="mobile-title">MF<strong>Analyze</strong></span>
        </div>

        <button
          className="mobile-refresh-btn"
          onClick={fetchAllFunds}
          disabled={isRefreshing}
          title="Refresh data"
        >
          <RefreshCw size={16} className={isRefreshing ? 'spinner-icon' : ''} />
        </button>
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
      />

      {/* Main Content Area */}
      <div className="main-viewport">
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
            onResetDefaults={handleResetDefaults}
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
