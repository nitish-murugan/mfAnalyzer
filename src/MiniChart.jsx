import { useEffect, useRef } from 'react';
import { createChart, AreaSeries, LineStyle } from 'lightweight-charts';

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

export default function MiniChart({ navHistory, height = 180 }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !Array.isArray(navHistory) || navHistory.length === 0) return;

    // Initialize chart with attributionLogo: false to remove TradingView branding
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#94a3b8',
        fontFamily: "'Inter', sans-serif",
        fontSize: 11,
        attributionLogo: false, // REMOVES TRADINGVIEW LOGO
      },
      grid: {
        vertLines: { color: '#f8fafc', style: LineStyle.Solid },
        horzLines: { color: '#f8fafc', style: LineStyle.Solid },
      },
      crosshair: {
        vertLine: { color: '#387ed1', width: 1, style: LineStyle.Dashed },
        horzLine: { color: '#387ed1', width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: '#f1f5f9',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: '#f1f5f9',
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#387ed1',
      topColor: 'rgba(56, 126, 209, 0.18)',
      bottomColor: 'rgba(56, 126, 209, 0.01)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: '#387ed1',
      crosshairMarkerBackgroundColor: '#ffffff',
    });

    // 1. Sort all data chronologically
    const map = new Map();
    const reversed = [...navHistory].reverse();
    for (const item of reversed) {
      if (!item.date || item.nav == null) continue;
      const iso = parseDateToISO(item.date);
      const val = parseFloat(item.nav);
      if (!isNaN(val) && iso) {
        map.set(iso, { time: iso, value: val });
      }
    }
    const fullData = Array.from(map.values()).sort((a, b) => a.time.localeCompare(b.time));

    // 2. Filter strictly for 3 MONTHS (90 days) for the overview page
    let threeMonthData = fullData;
    if (fullData.length > 0) {
      const lastItem = fullData[fullData.length - 1];
      const [ly, lm, ld] = lastItem.time.split('-').map(Number);
      const endDate = new Date(ly, lm - 1, ld);
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 90); // 3 months = 90 days

      const cutoffIso = startDate.toISOString().split('T')[0];
      const filtered = fullData.filter((d) => d.time >= cutoffIso);
      if (filtered.length > 0) {
        threeMonthData = filtered;
      }
    }

    if (threeMonthData.length > 0) {
      series.setData(threeMonthData);
      chart.timeScale().fitContent();
    }

    seriesRef.current = series;
    chartRef.current = chart;

    const ro = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height: h } = entries[0].contentRect;
      chart.resize(width, h || height);
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [navHistory, height]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: `${height}px`, position: 'relative' }}
    />
  );
}
