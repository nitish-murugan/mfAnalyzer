import { ArrowUpRight, ArrowDownRight, RefreshCw, PlusCircle, ExternalLink } from 'lucide-react';
import MiniChart from './MiniChart';

export default function HomePage({ funds, fundDataMap, onSelectFund, onGoToConfig, onRefreshAll }) {
  if (funds.length === 0) {
    return (
      <div className="empty-home-container">
        <div className="empty-home-card">
          <div className="empty-icon-wrap">📈</div>
          <h2>No Mutual Funds Configured</h2>
          <p>
            Add mutual fund URLs (Base API URL & Latest NAV URL) from the Configuration menu to track and compare them here.
          </p>
          <button className="primary-action-btn" onClick={onGoToConfig}>
            <PlusCircle size={16} />
            Go to Configuration
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page-container">
      <div className="home-page-header">
        <div>
          <h1 className="home-title">Mutual Funds Overview</h1>
          <p className="home-subtitle">
            Showing 3-Month (3M) trend. Tap any mutual fund name to open its interactive Zerodha chart and 2-point profit calculator.
          </p>
        </div>
        <button className="secondary-action-btn" onClick={onRefreshAll} title="Refresh all data">
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div className="funds-grid">
        {funds.map((fund) => {
          const dataState = fundDataMap[fund.id] || { loading: true, data: null, error: null };
          const meta = dataState.data?.meta || {};
          const history = dataState.data?.data || [];
          const displayName = fund.name || meta.scheme_name || 'Loading Mutual Fund...';

          const latestItem = history[0];
          const prevItem = history[1];
          const currentNav = latestItem ? parseFloat(latestItem.nav) : null;
          const prevNav = prevItem ? parseFloat(prevItem.nav) : null;
          const dayChange = currentNav && prevNav ? currentNav - prevNav : null;
          const dayChangePct = dayChange && prevNav ? (dayChange / prevNav) * 100 : null;
          const isPositive = dayChange != null ? dayChange >= 0 : true;

          return (
            <div key={fund.id} className="home-fund-card">
              {/* Card Header with Fund Name and NAV */}
              <div className="fund-card-header">
                <div className="fund-title-block">
                  <div className="card-badge-row">
                    <span className="card-badge">{meta.fund_house || 'Mutual Fund'}</span>
                    <span className="card-badge-tf">3M Trend</span>
                  </div>
                  {/* Touching / Clicking Fund Name opens full details and graph */}
                  <h3
                    className="clickable-fund-name"
                    onClick={() => onSelectFund(fund.id)}
                    title="Touch to view detailed Zerodha chart"
                  >
                    <span>{displayName}</span>
                    <ExternalLink size={14} className="touch-icon" />
                  </h3>
                </div>

                {currentNav != null && (
                  <div className="fund-card-nav">
                    <span className="card-nav-val">₹{currentNav.toFixed(2)}</span>
                    {dayChange != null && (
                      <span className={`card-change-badge ${isPositive ? 'pos' : 'neg'}`}>
                        {isPositive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                        {isPositive ? '+' : ''}{dayChangePct.toFixed(2)}%
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* 3M Mini Graph */}
              <div
                className="fund-card-graph-wrap"
                onClick={() => onSelectFund(fund.id)}
                title="Touch to expand full Zerodha chart"
              >
                {dataState.loading ? (
                  <div className="chart-loading-placeholder">
                    <div className="card-spinner" />
                    <span>Loading 3M graph...</span>
                  </div>
                ) : dataState.error ? (
                  <div className="chart-error-placeholder">
                    <span>Failed to load graph</span>
                  </div>
                ) : history.length > 0 ? (
                  <MiniChart navHistory={history} height={190} />
                ) : (
                  <div className="chart-empty-placeholder">
                    <span>No data available</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
