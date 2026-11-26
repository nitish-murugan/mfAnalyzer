import { useState, useMemo } from 'react';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Tag, Layers, RefreshCw } from 'lucide-react';
import MFChart from './MFChart';
import FundAnalysisCard from './FundAnalysisCard';

const TIMEFRAMES_MAP = {
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
  '3Y': 1095,
  '5Y': 1825,
  'ALL': null,
};

function parseDateToISO(dStr) {
  if (!dStr) return '';
  const parts = dStr.split('-');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return dStr;
}

export default function FundDetailView({ fund, fundDataState, onBack, onRefresh }) {
  const [activeRange, setActiveRange] = useState('1Y');

  const loading = fundDataState?.loading;
  const error = fundDataState?.error;
  const fundDetails = fundDataState?.data;
  const latestNavInfo = fundDataState?.latestNavInfo;

  const meta = fundDetails?.meta || {};
  const data = fundDetails?.data || [];

  const currentNav = latestNavInfo?.nav ?? (data[0] ? parseFloat(data[0].nav) : null);
  const prevNav = data[1] ? parseFloat(data[1].nav) : null;
  const dayChange = currentNav && prevNav ? currentNav - prevNav : null;
  const dayChangePct = dayChange && prevNav ? (dayChange / prevNav) * 100 : null;
  const isPositiveDay = dayChange != null ? dayChange >= 0 : true;

  // Chronologically sorted data (oldest to newest)
  const fullData = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    const map = new Map();
    const reversed = [...data].reverse();
    for (const item of reversed) {
      if (!item.date || item.nav == null) continue;
      const isoTime = parseDateToISO(item.date);
      const val = parseFloat(item.nav);
      if (!isNaN(val) && isoTime) {
        map.set(isoTime, { time: isoTime, value: val });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.time.localeCompare(b.time));
  }, [data]);

  // All-time High & All-time Low across the whole duration (all years)
  const { allTimeHigh, allTimeLow } = useMemo(() => {
    if (fullData.length === 0) return { allTimeHigh: null, allTimeLow: null };
    const values = fullData.map((d) => d.value);
    return {
      allTimeHigh: Math.max(...values),
      allTimeLow: Math.min(...values),
    };
  }, [fullData]);

  // Duration High, Low and Return for the selected timeframe (1M, 3M, 6M, 1Y, 3Y, 5Y, ALL)
  const { durationHigh, durationLow, durationReturnPct } = useMemo(() => {
    if (fullData.length === 0) return { durationHigh: null, durationLow: null, durationReturnPct: null };
    const days = TIMEFRAMES_MAP[activeRange];

    let rangeItems = fullData;
    if (days !== null) {
      const lastItem = fullData[fullData.length - 1];
      const [ly, lm, ld] = lastItem.time.split('-').map(Number);
      const endDate = new Date(ly, lm - 1, ld);
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - days);
      const startIso = startDate.toISOString().split('T')[0];
      const filtered = fullData.filter((d) => d.time >= startIso);
      if (filtered.length > 0) rangeItems = filtered;
    }

    const values = rangeItems.map((d) => d.value);
    const high = Math.max(...values);
    const low = Math.min(...values);

    const startVal = rangeItems[0].value;
    const endVal = rangeItems[rangeItems.length - 1].value;
    const returnPct = ((endVal - startVal) / startVal) * 100;

    return {
      durationHigh: high,
      durationLow: low,
      durationReturnPct: returnPct,
    };
  }, [fullData, activeRange]);

  return (
    <div className="fund-detail-container">
      {/* Top back navigation bar */}
      <div className="detail-action-bar">
        <button className="back-link-btn" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back to All Funds</span>
        </button>

        <button className="secondary-action-btn" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spinner-icon' : ''} />
          <span>{loading ? 'Refreshing...' : 'Refresh Data'}</span>
        </button>
      </div>

      {loading && !fundDetails && (
        <div className="detail-loading-box">
          <div className="card-spinner" />
          <p>Loading fund historical data from {fund.baseUrl}...</p>
        </div>
      )}

      {error && (
        <div className="error-card">
          <strong>Failed to load fund</strong>
          <p>{error}</p>
        </div>
      )}

      {fundDetails && (
        <div className="dashboard-content">
          {/* Header Summary Card */}
          <div className="fund-summary-card">
            <div className="fund-header-split">
              <div className="fund-titles">
                <div className="tags-row">
                  {meta.fund_house && <span className="chip amc-chip">{meta.fund_house}</span>}
                  {meta.scheme_category && <span className="chip category-chip">{meta.scheme_category}</span>}
                  {meta.scheme_type && <span className="chip type-chip">{meta.scheme_type}</span>}
                </div>
                <h1 className="scheme-name">{meta.scheme_name || fund.name || 'Mutual Fund Scheme'}</h1>
                <div className="scheme-meta-row">
                  {meta.scheme_code && (
                    <span className="meta-item">
                      <Tag size={12} /> Scheme Code: <strong>{meta.scheme_code}</strong>
                    </span>
                  )}
                  {meta.isin_growth && (
                    <span className="meta-item">
                      <Layers size={12} /> ISIN: <strong>{meta.isin_growth}</strong>
                    </span>
                  )}
                </div>
              </div>

              {currentNav != null && (
                <div className="fund-nav-highlight">
                  <span className="nav-sub">Current NAV</span>
                  <div className="nav-large">
                    ₹{currentNav.toFixed(4)}
                  </div>
                  {dayChange != null && (
                    <div className={`nav-diff-badge ${isPositiveDay ? 'positive' : 'negative'}`}>
                      {isPositiveDay ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {isPositiveDay ? '+' : ''}{dayChange.toFixed(4)} ({isPositiveDay ? '+' : ''}{dayChangePct.toFixed(2)}%)
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Dynamic Key statistics row for the selected duration + all-time high */}
            <div className="key-metrics-grid">
              <div className="metric-box highlight-metric">
                <span className="m-label">{activeRange} High</span>
                <span className="m-val">{durationHigh != null ? `₹${durationHigh.toFixed(2)}` : '—'}</span>
              </div>
              <div className="metric-box highlight-metric">
                <span className="m-label">{activeRange} Low</span>
                <span className="m-val">{durationLow != null ? `₹${durationLow.toFixed(2)}` : '—'}</span>
              </div>
              <div className="metric-box">
                <span className="m-label">All-time High (All Years)</span>
                <span className="m-val font-bold">{allTimeHigh != null ? `₹${allTimeHigh.toFixed(2)}` : '—'}</span>
              </div>
              <div className="metric-box">
                <span className="m-label">{activeRange} Return</span>
                <span className={`m-val ${durationReturnPct != null && durationReturnPct >= 0 ? 'text-green' : 'text-red'}`}>
                  {durationReturnPct != null ? `${durationReturnPct >= 0 ? '+' : ''}${durationReturnPct.toFixed(2)}%` : '—'}
                </span>
              </div>
              <div className="metric-box">
                <span className="m-label">Latest NAV Date</span>
                <span className="m-val">{latestNavInfo?.date || data[0]?.date || '—'}</span>
              </div>
            </div>
          </div>

          {/* Zerodha-Style Graph Section with 2-Point Touch Profit Calculator */}
          <div className="chart-section-wrapper">
            <MFChart
              navHistory={data}
              latestNavInfo={latestNavInfo}
              activeRange={activeRange}
              setActiveRange={setActiveRange}
            />
          </div>

          {/* Quantitative Valuation & Action Analysis Card below the graph */}
          <FundAnalysisCard
            data={data}
            fundName={meta.scheme_name || fund.name}
          />
        </div>
      )}
    </div>
  );
}
