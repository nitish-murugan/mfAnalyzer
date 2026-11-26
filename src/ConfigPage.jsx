import { useState } from 'react';
import { Plus, Trash2, Globe, Link2, ExternalLink, RefreshCw, CheckCircle2, AlertCircle, FileText } from 'lucide-react';

export default function ConfigPage({ funds, onAddFund, onDeleteFund }) {
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [latestUrl, setLatestUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    if (!baseUrl.trim()) return;

    setIsTesting(true);
    setTestResult(null);

    let fundName = name.trim();

    // Auto-fetch name from API if not manually entered
    try {
      const res = await fetch(baseUrl.trim());
      if (res.ok) {
        const json = await res.json();
        if (!fundName && json.meta?.scheme_name) {
          fundName = json.meta.scheme_name;
        }
      }
    } catch {
      // Continue even if preview fetch fails
    }

    const newFund = {
      id: `mf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: fundName || `Fund ${funds.length + 1}`,
      baseUrl: baseUrl.trim(),
      latestUrl: latestUrl.trim(),
    };

    onAddFund(newFund);
    setName('');
    setBaseUrl('');
    setLatestUrl('');
    setIsTesting(false);
    setTestResult({ success: true, message: `Added "${newFund.name}" successfully!` });

    setTimeout(() => {
      setTestResult(null);
    }, 4000);
  };

  return (
    <div className="config-page-container">
      <div className="config-header">
        <h1 className="config-title">Mutual Fund URL Configuration</h1>
        <p className="config-subtitle">
          Add any Mutual Fund by entering its Base API URL and Latest NAV URL. All configured funds will appear on your Home page.
        </p>
      </div>

      {/* Add New Fund Form */}
      <div className="config-card">
        <div className="card-title-row">
          <h2 className="section-title">Add New Mutual Fund</h2>
          <span className="badge-count">{funds.length} Active Funds</span>
        </div>

        <form onSubmit={handleQuickAdd} className="config-form">
          <div className="form-fields-stack">
            <div className="field-group">
              <label className="field-label" htmlFor="fund-name-input">
                <FileText size={14} className="field-icon" />
                Mutual Fund Label / Name (Optional - auto-detected if left empty)
              </label>
              <div className="field-input-box">
                <input
                  id="fund-name-input"
                  type="text"
                  className="styled-input"
                  placeholder="Enter mutual fund name (Optional)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="base-url-input">
                <Globe size={14} className="field-icon" />
                Base API URL (Historical NAV data) <span className="required-star">*</span>
              </label>
              <div className="field-input-box">
                <input
                  id="base-url-input"
                  type="url"
                  required
                  className="styled-input font-mono"
                  placeholder="https://api.mfapi.in/mf/<scheme_code>"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </div>
              <span className="input-helper">
                e.g. <code>https://api.mfapi.in/mf/&lt;scheme_code&gt;</code>
              </span>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="latest-url-input">
                <Link2 size={14} className="field-icon" />
                Latest NAV URL
              </label>
              <div className="field-input-box">
                <input
                  id="latest-url-input"
                  type="url"
                  className="styled-input font-mono"
                  placeholder="https://api.mfapi.in/mf/<scheme_code>/latest"
                  value={latestUrl}
                  onChange={(e) => setLatestUrl(e.target.value)}
                />
              </div>
              <span className="input-helper">
                e.g. <code>https://api.mfapi.in/mf/&lt;scheme_code&gt;/latest</code>
              </span>
            </div>
          </div>

          {testResult && (
            <div className={`status-banner ${testResult.success ? 'success' : 'error'}`}>
              {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="form-submit-row">
            <button type="submit" className="primary-action-btn" disabled={isTesting || !baseUrl.trim()}>
              {isTesting ? (
                <>
                  <RefreshCw size={14} className="spinner-icon" />
                  Adding Fund...
                </>
              ) : (
                <>
                  <Plus size={15} />
                  Add to Home Page
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Configured Funds List */}
      <div className="config-card">
        <div className="card-title-row">
          <h2 className="section-title">Configured Mutual Funds ({funds.length})</h2>
        </div>

        {funds.length === 0 ? (
          <div className="empty-funds-notice">
            <p>No mutual funds added yet. Use the form above to add your mutual fund URLs.</p>
          </div>
        ) : (
          <div className="funds-table-wrap">
            <table className="funds-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Fund Name</th>
                  <th>Base API URL</th>
                  <th>Latest NAV URL</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {funds.map((fund, index) => (
                  <tr key={fund.id}>
                    <td className="col-index">{index + 1}</td>
                    <td className="col-name">
                      <strong>{fund.name}</strong>
                    </td>
                    <td className="col-url">
                      <a href={fund.baseUrl} target="_blank" rel="noreferrer" className="url-link">
                        <span>{fund.baseUrl}</span>
                        <ExternalLink size={11} />
                      </a>
                    </td>
                    <td className="col-url">
                      {fund.latestUrl ? (
                        <a href={fund.latestUrl} target="_blank" rel="noreferrer" className="url-link">
                          <span>{fund.latestUrl}</span>
                          <ExternalLink size={11} />
                        </a>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="col-actions">
                      <button
                        className="delete-fund-btn"
                        onClick={() => onDeleteFund(fund.id)}
                        title="Delete fund"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
