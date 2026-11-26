import { Home, Settings, TrendingUp, PlusCircle, ChevronRight, CheckCircle2, RefreshCw, X } from 'lucide-react';

export default function Sidebar({
  currentView,
  setCurrentView,
  funds,
  selectedFundId,
  onSelectFund,
  lastRefreshedDate,
  isRefreshing,
  onManualRefresh,
  isMobileOpen,
  setIsMobileOpen,
}) {
  const isRefreshedToday = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const today = `${y}-${m}-${d}`;
    return lastRefreshedDate === today;
  })();

  const handleNavClick = (view) => {
    setCurrentView(view);
    if (setIsMobileOpen) setIsMobileOpen(false);
  };

  const handleFundSelect = (fundId) => {
    onSelectFund(fundId);
    if (setIsMobileOpen) setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop overlay */}
      {isMobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`app-sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <TrendingUp size={18} />
          </div>
          <div className="sidebar-title-group">
            <span className="sidebar-title">MF<strong>Analyze</strong></span>
            <span className="sidebar-version">Zerodha Style Mutual Funds</span>
          </div>
          {/* Close button for mobile drawer */}
          <button
            className="mobile-close-btn"
            onClick={() => setIsMobileOpen(false)}
            title="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Daily Refresh Status Bar in Sidebar */}
        <div className="sidebar-daily-status">
          <div className="daily-status-row">
            {isRefreshing ? (
              <span className="daily-status-badge updating">
                <RefreshCw size={11} className="spinner-icon" />
                <span>Refreshing data...</span>
              </span>
            ) : isRefreshedToday ? (
              <span className="daily-status-badge synced">
                <CheckCircle2 size={12} />
                <span>Refreshed for Today</span>
              </span>
            ) : (
              <span className="daily-status-badge pending">
                <RefreshCw size={11} />
                <span>Refresh Needed</span>
              </span>
            )}
            <button
              className="sidebar-sync-btn"
              title="Force refresh now"
              disabled={isRefreshing}
              onClick={onManualRefresh}
            >
              <RefreshCw size={12} className={isRefreshing ? 'spinner-icon' : ''} />
            </button>
          </div>
          {lastRefreshedDate && (
            <div className="daily-status-date">
              Last sync: {lastRefreshedDate}
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${currentView === 'home' || currentView === 'detail' ? 'active' : ''}`}
            onClick={() => handleNavClick('home')}
          >
            <Home size={18} />
            <span>Home</span>
            {funds.length > 0 && <span className="nav-badge">{funds.length}</span>}
          </button>

          <button
            className={`nav-item ${currentView === 'config' ? 'active' : ''}`}
            onClick={() => handleNavClick('config')}
          >
            <Settings size={18} />
            <span>Configuration</span>
          </button>
        </nav>

        {/* Quick Fund List in Sidebar */}
        <div className="sidebar-funds-section">
          <div className="sidebar-section-header">
            <span>Configured Funds ({funds.length})</span>
            <button
              className="sidebar-add-btn"
              title="Add new fund"
              onClick={() => handleNavClick('config')}
            >
              <PlusCircle size={14} />
            </button>
          </div>

          <div className="sidebar-funds-list">
            {funds.map((f) => {
              const isSelected = currentView === 'detail' && selectedFundId === f.id;
              return (
                <button
                  key={f.id}
                  className={`sidebar-fund-chip ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleFundSelect(f.id)}
                  title={f.name || f.baseUrl}
                >
                  <span className="chip-indicator" />
                  <span className="chip-name">{f.name || `Fund ${f.id.slice(-4)}`}</span>
                  <ChevronRight size={13} className="chip-arrow" />
                </button>
              );
            })}
            {funds.length === 0 && (
              <div className="sidebar-empty-funds">
                No funds added yet.
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
