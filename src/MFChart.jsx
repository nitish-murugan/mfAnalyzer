import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createChart, AreaSeries, CrosshairMode, LineStyle, createSeriesMarkers } from 'lightweight-charts';
import { X, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const TIMEFRAMES = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: '3Y', days: 1095 },
  { label: '5Y', days: 1825 },
  { label: 'ALL', days: null },
];

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

function formatDateDisplay(isoStr) {
  if (!isoStr) return '';
  try {
    const [y, m, d] = isoStr.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoStr;
  }
}

export default function MFChart({ navHistory, latestNavInfo, activeRange, setActiveRange }) {
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const seriesInstanceRef = useRef(null);
  const markersPluginRef = useRef(null);

  const [crosshairData, setCrosshairData] = useState(null);

  // 2-Point Touch/Click State using a single consolidated object
  const [selectedPoints, setSelectedPoints] = useState({ p1: null, p2: null });

  // Normalize and sort all data chronologically
  const fullChartData = useMemo(() => {
    if (!Array.isArray(navHistory) || navHistory.length === 0) return [];
    const map = new Map();
    const reversed = [...navHistory].reverse();
    for (const item of reversed) {
      if (!item.date || item.nav == null) continue;
      const isoTime = parseDateToISO(item.date);
      const val = parseFloat(item.nav);
      if (!isNaN(val) && isoTime) {
        map.set(isoTime, {
          time: isoTime,
          value: val,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.time.localeCompare(b.time));
  }, [navHistory]);

  // Filter based on active timeframe
  const filteredData = useMemo(() => {
    if (fullChartData.length === 0) return [];
    const tf = TIMEFRAMES.find((t) => t.label === activeRange);
    if (!tf || tf.days === null) return fullChartData;

    const lastItem = fullChartData[fullChartData.length - 1];
    const [ly, lm, ld] = lastItem.time.split('-').map(Number);
    const endDate = new Date(ly, lm - 1, ld);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - tf.days);

    const startIso = startDate.toISOString().split('T')[0];
    const sliced = fullChartData.filter((d) => d.time >= startIso);
    return sliced.length > 0 ? sliced : fullChartData;
  }, [fullChartData, activeRange]);

  // Return calculation for current active timeframe
  const rangePerformance = useMemo(() => {
    if (filteredData.length < 2) return null;
    const startVal = filteredData[0].value;
    const endVal = filteredData[filteredData.length - 1].value;
    const absoluteDiff = endVal - startVal;
    const percentage = (absoluteDiff / startVal) * 100;
    return {
      diff: absoluteDiff,
      percentage: percentage,
      isPositive: absoluteDiff >= 0,
    };
  }, [filteredData]);

  // Two-point Profit Calculation
  const measuredProfit = useMemo(() => {
    const { p1, p2 } = selectedPoints;
    if (!p1 || !p2) return null;

    // Order points chronologically
    const [start, end] = p1.time <= p2.time ? [p1, p2] : [p2, p1];
    const diff = end.nav - start.nav;
    const pct = ((end.nav - start.nav) / start.nav) * 100;

    const d1 = new Date(start.time);
    const d2 = new Date(end.time);
    const diffDays = Math.max(1, Math.round(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)));

    return {
      start,
      end,
      diff,
      pct,
      isPositive: diff >= 0,
      days: diffDays,
    };
  }, [selectedPoints]);

  const clearMeasurement = useCallback(() => {
    setSelectedPoints({ p1: null, p2: null });
    if (markersPluginRef.current) {
      markersPluginRef.current.setMarkers([]);
    }
  }, []);

  // Initialize Lightweight Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#ffffff' },
        textColor: '#64748b',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: 12,
        attributionLogo: false, // REMOVES TRADINGVIEW LOGO
      },
      grid: {
        vertLines: { color: '#f1f5f9', style: LineStyle.Solid },
        horzLines: { color: '#f1f5f9', style: LineStyle.Solid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#387ed1',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#387ed1',
        },
        horzLine: {
          color: '#387ed1',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#387ed1',
        },
      },
      rightPriceScale: {
        borderColor: '#e2e8f0',
        scaleMargins: { top: 0.12, bottom: 0.08 },
      },
      timeScale: {
        borderColor: '#e2e8f0',
        fixLeftEdge: true,
        fixRightEdge: true,
        barSpacing: 6,
        minBarSpacing: 1,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
      },
    });

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#387ed1',
      topColor: 'rgba(56, 126, 209, 0.22)',
      bottomColor: 'rgba(56, 126, 209, 0.01)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: '#387ed1',
      crosshairMarkerBackgroundColor: '#ffffff',
      priceFormat: {
        type: 'price',
        precision: 4,
        minMove: 0.0001,
      },
    });

    // Create markers plugin for Point A and Point B
    const markersPlugin = createSeriesMarkers(areaSeries);
    markersPluginRef.current = markersPlugin;

    seriesInstanceRef.current = areaSeries;
    chartInstanceRef.current = chart;

    // Crosshair sliding hover handler
    chart.subscribeCrosshairMove((param) => {
      if (param.point && param.time) {
        const priceObj = param.seriesData.get(areaSeries);
        if (priceObj && typeof priceObj.value === 'number') {
          setCrosshairData({
            time: param.time,
            nav: priceObj.value,
          });
          return;
        }
      }
      setCrosshairData(null);
    });

    // Touch / Click Handler for 2-Point Profit Calculation
    chart.subscribeClick((param) => {
      if (!param.time) return;

      let navValue = null;
      const priceObj = param.seriesData.get(areaSeries);
      if (priceObj && typeof priceObj.value === 'number') {
        navValue = priceObj.value;
      }

      // If price wasn't found directly from seriesData, find in filteredData
      if (navValue == null) {
        const match = filteredData.find((d) => d.time === param.time);
        if (match) navValue = match.value;
      }

      if (navValue == null) return;

      const clickedPoint = {
        time: param.time,
        nav: navValue,
      };

      // Corrected 2-point selection logic:
      setSelectedPoints((prev) => {
        // Case 1: If no point is set, OR if both points were already set -> start fresh with p1
        if (!prev.p1 || (prev.p1 && prev.p2)) {
          return { p1: clickedPoint, p2: null };
        }

        // Case 2: Point 1 is set, Point 2 is not yet set -> set Point 2!
        if (prev.p1 && !prev.p2) {
          // If the user tapped the exact same point/time, ignore to avoid 0-day 0% calculation
          if (prev.p1.time === clickedPoint.time) {
            return prev;
          }
          return { p1: prev.p1, p2: clickedPoint };
        }

        return prev;
      });
    });

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      chart.resize(width, height);
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [filteredData]);

  // Sync data updates with chart
  useEffect(() => {
    if (!seriesInstanceRef.current || !chartInstanceRef.current) return;
    if (filteredData.length > 0) {
      seriesInstanceRef.current.setData(filteredData);
      chartInstanceRef.current.timeScale().fitContent();
    }
  }, [filteredData]);

  // Update visual markers on chart when Point 1 or Point 2 changes
  useEffect(() => {
    if (!markersPluginRef.current) return;

    const { p1, p2 } = selectedPoints;

    if (p1 && p2) {
      const [start, end] = p1.time <= p2.time ? [p1, p2] : [p2, p1];
      const isPositive = end.nav >= start.nav;
      const markers = [
        {
          time: start.time,
          position: 'aboveBar',
          color: '#387ed1',
          shape: 'circle',
          text: `Point A: ₹${start.nav.toFixed(2)}`,
        },
        {
          time: end.time,
          position: 'aboveBar',
          color: isPositive ? '#16a34a' : '#dc2626',
          shape: 'circle',
          text: `Point B: ₹${end.nav.toFixed(2)}`,
        },
      ].sort((a, b) => a.time.localeCompare(b.time));

      markersPluginRef.current.setMarkers(markers);
    } else if (p1) {
      markersPluginRef.current.setMarkers([
        {
          time: p1.time,
          position: 'aboveBar',
          color: '#387ed1',
          shape: 'circle',
          text: `Point 1: ₹${p1.nav.toFixed(2)}`,
        },
      ]);
    } else {
      markersPluginRef.current.setMarkers([]);
    }
  }, [selectedPoints]);

  const { p1, p2 } = selectedPoints;

  // Displayed NAV & Date (hovered crosshair or current latest)
  const latestItem = fullChartData[fullChartData.length - 1];
  const displayNav = crosshairData ? crosshairData.nav : (latestNavInfo?.nav ?? latestItem?.value);
  const displayDate = crosshairData ? crosshairData.time : (latestNavInfo?.date ? parseDateToISO(latestNavInfo.date) : latestItem?.time);

  return (
    <div className="zerodha-chart-card">
      {/* Chart Top Header: Values & Range Selector */}
      <div className="chart-header">
        <div className="chart-stat-overlay">
          <div className="chart-current-val">
            <span className="currency-symbol">₹</span>
            <span className="val-text">
              {displayNav != null ? Number(displayNav).toFixed(4) : '—'}
            </span>
            {crosshairData && <span className="hover-badge">LIVE TRACK</span>}
          </div>
          <div className="chart-current-date">
            {displayDate ? formatDateDisplay(displayDate) : ''}
          </div>
        </div>

        <div className="chart-controls">
          {rangePerformance && (
            <div className={`return-badge ${rangePerformance.isPositive ? 'positive' : 'negative'}`}>
              {rangePerformance.isPositive ? '+' : ''}
              {rangePerformance.percentage.toFixed(2)}% ({rangePerformance.isPositive ? '+' : ''}₹{rangePerformance.diff.toFixed(2)})
            </div>
          )}

          <div className="range-button-group">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.label}
                className={`range-pill ${activeRange === tf.label ? 'active' : ''}`}
                onClick={() => {
                  setActiveRange(tf.label);
                  clearMeasurement();
                }}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Step 1 banner: Point 1 selected */}
      {p1 && !p2 && (
        <div className="point-instruction-bar">
          <div className="instruction-content">
            <span className="instruction-badge">Step 1 Set</span>
            <span>
              Point 1: <strong>{formatDateDisplay(p1.time)}</strong> (₹{p1.nav.toFixed(2)}).
              Now <strong>tap / click Point 2</strong> on the line to calculate profit.
            </span>
          </div>
          <button className="clear-measure-btn" onClick={clearMeasurement} title="Cancel">
            <X size={14} /> Cancel
          </button>
        </div>
      )}

      {/* Step 2 banner: Both Points Selected & Profit Calculated */}
      {measuredProfit && (
        <div className={`measured-profit-card ${measuredProfit.isPositive ? 'profit-pos' : 'profit-neg'}`}>
          <div className="profit-primary-col">
            <div className="profit-pct-row">
              <span className="profit-icon-wrap">
                {measuredProfit.isPositive ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
              </span>
              <span className="profit-pct-val">
                {measuredProfit.isPositive ? '+' : ''}
                {measuredProfit.pct.toFixed(2)}%
              </span>
              <span className="profit-diff-val">
                ({measuredProfit.isPositive ? '+' : ''}₹{measuredProfit.diff.toFixed(2)})
              </span>
            </div>
            <div className="profit-duration-sub">
              Duration: <strong>{measuredProfit.days} days</strong> (~{(measuredProfit.days / 30).toFixed(1)} months)
            </div>
          </div>

          <div className="profit-points-col">
            <div className="point-stat">
              <span className="point-label">Point A (Start)</span>
              <span className="point-val">{formatDateDisplay(measuredProfit.start.time)}</span>
              <span className="point-nav">₹{measuredProfit.start.nav.toFixed(2)}</span>
            </div>
            <div className="point-separator">→</div>
            <div className="point-stat">
              <span className="point-label">Point B (End)</span>
              <span className="point-val">{formatDateDisplay(measuredProfit.end.time)}</span>
              <span className="point-nav">₹{measuredProfit.end.nav.toFixed(2)}</span>
            </div>
          </div>

          <button className="clear-measure-btn" onClick={clearMeasurement} title="Clear measurement">
            <X size={15} /> Clear
          </button>
        </div>
      )}

      {/* Chart Canvas */}
      <div className="chart-viewport" ref={chartContainerRef} />

      {/* Chart Footer info */}
      <div className="chart-footer-bar">
        <div className="footer-tip">
          💡 <strong>Profit Calculator:</strong> Tap a point and then tap another point on the line to calculate profit % between them.
        </div>
        <button
          className="reset-view-btn"
          onClick={() => chartInstanceRef.current?.timeScale().fitContent()}
        >
          Reset Zoom
        </button>
      </div>
    </div>
  );
}
