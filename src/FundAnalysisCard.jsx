import { useState, useMemo } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Eye,
  Sparkles,
  Info,
  Layers,
  Activity
} from 'lucide-react';

function calculateWilderRSI(data, period = 14) {
  if (data.length <= period) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = data[i].nav - data[i - 1].nav;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].nav - data[i - 1].nav;
    const currentGain = change > 0 ? change : 0;
    const currentLoss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export default function FundAnalysisCard({ data, fundName }) {
  const [isDismissed, setIsDismissed] = useState(false);

  // Quantitative Financial Analysis
  const analysis = useMemo(() => {
    if (!Array.isArray(data) || data.length < 15) return null;

    // Chronologically sorted: oldest -> newest
    const chronological = [...data]
      .reverse()
      .map((d) => ({ date: d.date, nav: parseFloat(d.nav) }))
      .filter((d) => !isNaN(d.nav));

    const len = chronological.length;
    if (len < 15) return null;

    const latest = chronological[len - 1].nav;
    const prev = chronological[len - 2].nav;

    // 1. Consecutive Days Streak (Price Kept Increasing)
    let streak = 0;
    let streakDirection = 'neutral';
    if (len >= 2) {
      const diff = latest - prev;
      if (diff > 0) {
        streakDirection = 'up';
        for (let i = len - 1; i > 0; i--) {
          if (chronological[i].nav > chronological[i - 1].nav) streak++;
          else break;
        }
      } else if (diff < 0) {
        streakDirection = 'down';
        for (let i = len - 1; i > 0; i--) {
          if (chronological[i].nav < chronological[i - 1].nav) streak++;
          else break;
        }
      }
    }

    // 7-day short-term momentum
    const weekStartNav = len >= 6 ? chronological[len - 6].nav : chronological[0].nav;
    const weekReturnPct = ((latest - weekStartNav) / weekStartNav) * 100;

    // Price kept increasing flag
    const isPriceKeptIncreasing = (streakDirection === 'up' && streak >= 3) || weekReturnPct >= 3.0;

    // 2. Wilder's 14-day RSI
    const rsi = calculateWilderRSI(chronological, 14);

    // 3. 50-day and 200-day Simple Moving Averages
    const sma50 =
      len >= 50
        ? chronological.slice(len - 50).reduce((acc, item) => acc + item.nav, 0) / 50
        : null;
    const sma200 =
      len >= 200
        ? chronological.slice(len - 200).reduce((acc, item) => acc + item.nav, 0) / 200
        : null;

    const distFrom200SMA = sma200 ? ((latest - sma200) / sma200) * 100 : null;
    const distFrom50SMA = sma50 ? ((latest - sma50) / sma50) * 100 : null;

    // 4. 52-Week High Drawdown
    const days52W = Math.min(len, 250);
    const slice52W = chronological.slice(len - days52W).map((d) => d.nav);
    const high52 = Math.max(...slice52W);
    const low52 = Math.min(...slice52W);
    const drawdownFromHigh = ((high52 - latest) / high52) * 100;

    // 5. 20-Day Bollinger Bands (%B)
    const bbPeriod = Math.min(len, 20);
    const bbSlice = chronological.slice(len - bbPeriod).map((d) => d.nav);
    const bbSMA = bbSlice.reduce((a, b) => a + b, 0) / bbPeriod;
    const bbVariance =
      bbSlice.reduce((acc, v) => acc + Math.pow(v - bbSMA, 2), 0) / bbPeriod;
    const bbStdDev = Math.sqrt(bbVariance);
    const bbUpper = bbSMA + 2 * bbStdDev;
    const bbLower = bbSMA - 2 * bbStdDev;
    const percentB = bbUpper - bbLower > 0 ? (latest - bbLower) / (bbUpper - bbLower) : 0.5;

    // 6. Valuation & Attractiveness Scoring
    let attractivePoints = 0;
    const attractiveReasons = [];

    if (rsi < 38) {
      attractivePoints += 3;
      attractiveReasons.push(`RSI is low at ${rsi.toFixed(1)} (Oversold Dip)`);
    } else if (rsi < 48) {
      attractivePoints += 1;
      attractiveReasons.push(`RSI is in favorable accumulation territory (${rsi.toFixed(1)})`);
    }

    if (drawdownFromHigh >= 8) {
      attractivePoints += 3;
      attractiveReasons.push(`Trading at a ${drawdownFromHigh.toFixed(1)}% discount from 52W High`);
    } else if (drawdownFromHigh >= 4) {
      attractivePoints += 1;
      attractiveReasons.push(`Healthy pullback of ${drawdownFromHigh.toFixed(1)}% from recent peak`);
    }

    if (distFrom200SMA !== null && distFrom200SMA <= 1.5) {
      attractivePoints += 3;
      attractiveReasons.push(`NAV is testing the 200-Day Moving Average (Deep Value support zone)`);
    }

    if (percentB <= 0.15) {
      attractivePoints += 2;
      attractiveReasons.push(`NAV touched the Lower Bollinger Band (Statistical mean-reversion buy zone)`);
    }

    // Overbought / Caution Scoring
    let cautionPoints = 0;
    const cautionReasons = [];

    if (rsi > 72) {
      cautionPoints += 3;
      cautionReasons.push(`RSI is high at ${rsi.toFixed(1)} (Overbought zone)`);
    }
    if (distFrom200SMA !== null && distFrom200SMA > 14) {
      cautionPoints += 2;
      cautionReasons.push(`Extended +${distFrom200SMA.toFixed(1)}% above 200-day average baseline`);
    }
    if (percentB >= 0.95) {
      cautionPoints += 2;
      cautionReasons.push(`Trading near or above Upper Bollinger Band`);
    }
    if (streakDirection === 'up' && streak >= 5) {
      cautionPoints += 2;
      cautionReasons.push(`Surged for ${streak} consecutive days without pullbacks`);
    }

    // 7. Final Verdict Synthesis (BUY / SELL / NOTHING)
    let verdict = 'NOTHING';
    let verdictLabel = 'NOTHING (HOLD)';
    let verdictColor = 'neutral';
    let summaryText = '';
    let recommendation = '';

    if (attractivePoints >= 3) {
      verdict = 'BUY';
      verdictLabel = 'BUY — ATTRACTIVE PRICE';
      verdictColor = 'buy';
      summaryText = 'Current valuation is very suitable and attractive for entry.';
      recommendation =
        'Highly attractive price point. Favorable opportunity for fresh lump-sum investment or an extra top-up over your regular SIP.';
    } else if (cautionPoints >= 4) {
      verdict = 'SELL';
      verdictLabel = 'SELL / REBALANCE — OVERBOUGHT';
      verdictColor = 'sell';
      summaryText = 'Current valuation is overheated and overextended after a strong rally.';
      recommendation =
        'Avoid making fresh lump-sum entries right now. If you have hit your financial goal or want to protect profits, consider rebalancing a portion to debt. Otherwise, maintain routine SIP without adding bulk money.';
    } else {
      verdict = 'NOTHING';
      verdictLabel = 'NOTHING — HOLD & SIP AS USUAL';
      verdictColor = 'nothing';
      summaryText = 'Price is fairly valued within its normal trading channel.';
      recommendation =
        'No immediate action required. Price is neither in a deep discount nor overheated. Keep your existing holdings and continue regular SIP untouched.';
    }

    return {
      latest,
      rsi,
      sma50,
      sma200,
      distFrom200SMA,
      distFrom50SMA,
      high52,
      drawdownFromHigh,
      streak,
      streakDirection,
      weekReturnPct,
      isPriceKeptIncreasing,
      verdict,
      verdictLabel,
      verdictColor,
      summaryText,
      recommendation,
      attractiveReasons,
      cautionReasons,
    };
  }, [data]);

  if (!analysis) return null;

  // When dismissed by clear button, show slim restore bar
  if (isDismissed) {
    return (
      <div className="analysis-dismissed-bar">
        <div className="dismissed-left">
          <Sparkles size={14} className="text-blue" />
          <span>
            Automated Investment Analysis for <strong>{fundName || 'Mutual Fund'}</strong> is hidden.
          </span>
        </div>
        <button
          className="restore-analysis-btn"
          onClick={() => setIsDismissed(false)}
          title="Restore Analysis Card"
        >
          <Eye size={13} />
          Show Analysis
        </button>
      </div>
    );
  }

  return (
    <div className={`fund-analysis-card ${analysis.verdictColor}`}>
      {/* Top Banner & Header */}
      <div className="analysis-card-header">
        <div className="analysis-title-group">
          <div className="analysis-eyebrow">
            <Activity size={13} />
            <span>Quantitative Valuation & Action Analysis</span>
          </div>
          <div className="verdict-banner-row">
            <span className={`verdict-pill ${analysis.verdictColor}`}>
              {analysis.verdict === 'BUY' && <CheckCircle2 size={16} />}
              {analysis.verdict === 'SELL' && <AlertTriangle size={16} />}
              {analysis.verdict === 'NOTHING' && <Info size={16} />}
              {analysis.verdictLabel}
            </span>

            {/* Special Momentum Alert: Price Kept Increasing */}
            {analysis.isPriceKeptIncreasing && (
              <span className="momentum-alert-pill">
                <Flame size={14} />
                ALERT: Price Kept Increasing ({analysis.streak} Days Up / +{analysis.weekReturnPct.toFixed(2)}% in 1W)
              </span>
            )}
          </div>
        </div>

        {/* User-Requested Clear Button */}
        <button
          className="clear-analysis-btn"
          onClick={() => setIsDismissed(true)}
          title="Dismiss analysis notification"
        >
          <X size={14} />
          <span>Clear</span>
        </button>
      </div>

      {/* Main Advisory Box */}
      <div className="analysis-recommendation-box">
        <div className="recommendation-header">
          <strong>Actionable Guidance:</strong> {analysis.summaryText}
        </div>
        <p className="recommendation-body">{analysis.recommendation}</p>
      </div>

      {/* Financial Indicators Grid */}
      <div className="indicators-grid">
        {/* Indicator 1: RSI (14-day) */}
        <div className="indicator-tile">
          <div className="ind-header">
            <span className="ind-title">RSI (14-Day Wilder)</span>
            <span
              className={`ind-badge ${
                analysis.rsi < 40 ? 'pos' : analysis.rsi > 70 ? 'neg' : 'neutral'
              }`}
            >
              {analysis.rsi < 40 ? 'Oversold Dip' : analysis.rsi > 70 ? 'Overbought' : 'Neutral'}
            </span>
          </div>
          <div className="ind-val">{analysis.rsi.toFixed(1)}</div>
          <div className="ind-desc">
            {analysis.rsi < 40
              ? 'Attractive pullback zone'
              : analysis.rsi > 70
              ? 'Extended momentum run'
              : 'Balanced supply/demand'}
          </div>
        </div>

        {/* Indicator 2: 200-Day Moving Average */}
        <div className="indicator-tile">
          <div className="ind-header">
            <span className="ind-title">200-Day SMA</span>
            <span
              className={`ind-badge ${
                analysis.distFrom200SMA !== null && analysis.distFrom200SMA <= 2
                  ? 'pos'
                  : analysis.distFrom200SMA !== null && analysis.distFrom200SMA > 14
                  ? 'neg'
                  : 'neutral'
              }`}
            >
              {analysis.distFrom200SMA != null
                ? `${analysis.distFrom200SMA >= 0 ? '+' : ''}${analysis.distFrom200SMA.toFixed(1)}%`
                : '—'}
            </span>
          </div>
          <div className="ind-val">
            {analysis.sma200 ? `₹${analysis.sma200.toFixed(2)}` : '—'}
          </div>
          <div className="ind-desc">
            {analysis.distFrom200SMA != null && analysis.distFrom200SMA <= 2
              ? 'Prime 200 DMA value support'
              : analysis.distFrom200SMA != null && analysis.distFrom200SMA > 14
              ? 'Overextended above baseline'
              : 'Healthy long-term uptrend'}
          </div>
        </div>

        {/* Indicator 3: 52-Week High Drawdown */}
        <div className="indicator-tile">
          <div className="ind-header">
            <span className="ind-title">52W High Discount</span>
            <span
              className={`ind-badge ${
                analysis.drawdownFromHigh >= 7
                  ? 'pos'
                  : analysis.drawdownFromHigh <= 1.5
                  ? 'highlight'
                  : 'neutral'
              }`}
            >
              {analysis.drawdownFromHigh <= 1.5 ? 'Near Peak' : 'Discount'}
            </span>
          </div>
          <div className="ind-val">-{analysis.drawdownFromHigh.toFixed(1)}%</div>
          <div className="ind-desc">
            {analysis.drawdownFromHigh >= 7
              ? 'Favorable dip discount'
              : analysis.drawdownFromHigh <= 1.5
              ? `Only ${analysis.drawdownFromHigh.toFixed(1)}% below 52W High`
              : 'Normal trading range'}
          </div>
        </div>

        {/* Indicator 4: Streak & Short-term Momentum */}
        <div className="indicator-tile">
          <div className="ind-header">
            <span className="ind-title">Price Streak</span>
            <span
              className={`ind-badge ${
                analysis.streakDirection === 'up' && analysis.streak >= 3
                  ? 'highlight'
                  : analysis.streakDirection === 'up'
                  ? 'pos'
                  : 'neg'
              }`}
            >
              {analysis.streakDirection === 'up' ? 'Bullish' : 'Consolidating'}
            </span>
          </div>
          <div className="ind-val">
            {analysis.streakDirection === 'up' ? (
              <span className="text-green">
                ▲ {analysis.streak} Day{analysis.streak !== 1 ? 's' : ''} Up
              </span>
            ) : analysis.streakDirection === 'down' ? (
              <span className="text-red">
                ▼ {analysis.streak} Day{analysis.streak !== 1 ? 's' : ''} Down
              </span>
            ) : (
              'Flat'
            )}
          </div>
          <div className="ind-desc">
            {analysis.weekReturnPct >= 0 ? '+' : ''}
            {analysis.weekReturnPct.toFixed(2)}% past 7 calendar days
          </div>
        </div>
      </div>

      {/* Explanatory notes */}
      {(analysis.attractiveReasons.length > 0 || analysis.cautionReasons.length > 0) && (
        <div className="analysis-reasons-footer">
          {analysis.attractiveReasons.length > 0 && (
            <div className="reasons-block positive">
              <span className="reasons-tag">Attractive Factors:</span>
              <span>{analysis.attractiveReasons.join(' • ')}</span>
            </div>
          )}
          {analysis.cautionReasons.length > 0 && (
            <div className="reasons-block caution">
              <span className="reasons-tag">Risk / Overbought Factors:</span>
              <span>{analysis.cautionReasons.join(' • ')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
