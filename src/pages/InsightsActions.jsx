import { useMemo, useState } from 'react'
import { Activity, AlertTriangle, ArrowUpRight, Check, CircleCheck, Clock3, FileText, RotateCcw, ShieldAlert } from 'lucide-react'
import Sidebar from '../components/Sidebar.jsx'
import Header from '../components/Header.jsx'
import StatCard from '../components/StatCard.jsx'
import { getFinancialData, syncInsightStatuses, updateInsightStatus } from '../data/financialStore.js'
import { generateFinancialInsights } from '../utils/financialServices.js'
import { formatDemoDate, formatINR, formatWorkspaceDate } from '../utils/formatters.js'

const categoryLabels = { 'cash-flow': 'Cash Flow', receivables: 'Receivables', 'customer-risk': 'Customer Risk', expenses: 'Expenses' }
const severityLabels = { critical: 'Critical', high: 'High', medium: 'Medium', informational: 'Informational' }
const categoryHref = { 'cash-flow': '#cash-flow', receivables: '#receivables', 'customer-risk': '#customers', expenses: '#expenses' }

function loadInsights(horizonDays = 30) {
  let data = getFinancialData()
  const generated = generateFinancialInsights(data, horizonDays)
  data = syncInsightStatuses(data, generated)
  const statuses = new Map((data.insights ?? []).map((record) => [record.id, record]))
  return { data, insights: generated.map((insight) => ({ ...insight, ...(statuses.get(insight.id) ?? { status: 'open' }) })) }
}

function InsightCard({ insight, selected, onSelect }) {
  return <button className={`insight-card${selected ? ' is-selected' : ''}`} type="button" onClick={onSelect} aria-pressed={selected}>
    <span className="insight-card-top"><span className={`insight-severity insight-severity-${insight.severity}`}>{severityLabels[insight.severity]}</span><span className="insight-category-label">{categoryLabels[insight.category]}</span></span>
    <strong>{insight.title}</strong><span className="insight-card-detail">{insight.detail}</span>
    <span className="insight-card-bottom"><span className={`insight-status insight-status-${insight.status}`}>{insight.status === 'open' ? 'Current' : insight.status}</span><span>{insight.related?.label ?? 'Baseline forecast'}</span></span>
  </button>
}

function InsightsActions() {
  const insightParams = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
  const horizonDays = [7, 14, 30].includes(Number(insightParams.get('horizon'))) ? Number(insightParams.get('horizon')) : 30
  const [loaded, setLoaded] = useState(() => loadInsights(horizonDays))
  const [category, setCategory] = useState('all')
  const [severity, setSeverity] = useState('all')
  const [selectedId, setSelectedId] = useState(() => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('id'))
  const [error, setError] = useState('')
  const insightMap = useMemo(() => new Map(loaded.insights.map((item) => [item.id, item])), [loaded.insights])
  const visible = loaded.insights.filter((item) => (category === 'all' || item.category === category) && (severity === 'all' || item.severity === severity))
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0] ?? insightMap.get(selectedId) ?? null
  const counts = {
    open: loaded.insights.filter((item) => item.status === 'open').length,
    critical: loaded.insights.filter((item) => item.status !== 'resolved' && item.severity === 'critical').length,
    high: loaded.insights.filter((item) => item.status !== 'resolved' && item.severity === 'high').length,
    reviewed: loaded.insights.filter((item) => item.status === 'reviewed').length,
    resolved: loaded.insights.filter((item) => item.status === 'resolved').length,
  }
  const setStatus = (next) => {
    if (!selected) return
    try {
      updateInsightStatus(selected.id, next)
      setLoaded(loadInsights(horizonDays))
      setError('')
    } catch (cause) { setError(cause.message) }
  }
  const supportingFigures = selected?.supportingFigures ?? {}

  return <div className="app-layout" id="insights"><Sidebar activePage="insights" /><div className="main-column"><main className="content-area insights-content" aria-labelledby="insights-title">
    <Header asOf={formatDemoDate(loaded.data.business.asOf)} />
    <header className="insights-page-heading"><div><span className="section-kicker">FINANCIAL DECISION SUPPORT</span><h1 id="insights-title">Insights &amp; Actions</h1><p>Understand the financial signals in your workspace and decide what deserves attention.</p></div><span className="insight-source-note"><Activity size={14} /> Rule-based analysis · {horizonDays}-day baseline · shared data</span></header>
    <section className="insight-summary-grid" aria-label="Insight status summary">
      <StatCard icon={Activity} label="Open insights" value={counts.open} note="Current and not yet reviewed" tone="sage" />
      <StatCard icon={ShieldAlert} label="Critical" value={counts.critical} note="Negative projected cash conditions" tone="peach" />
      <StatCard icon={AlertTriangle} label="High priority" value={counts.high} note="Past due or multiple high-risk invoices" tone="butter" />
      <StatCard icon={Clock3} label="Reviewed" value={counts.reviewed} note="Still present in current analysis" tone="seaglass" />
      <StatCard icon={CircleCheck} label="Resolved" value={counts.resolved} note="Resolved current insight records" tone="sage" />
    </section>
    <div className="insight-filter-row"><div><span className="section-kicker">CURRENT FINANCIAL SIGNALS</span><h2>What needs attention</h2></div><div className="insight-filters"><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{Object.entries(categoryLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Severity<select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="all">All severities</option>{Object.entries(severityLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div></div>
    <div className="insights-workspace"><section className="insight-list-panel" aria-label="Generated insights">{visible.length ? visible.map((insight) => <InsightCard key={insight.id} insight={insight} selected={selected?.id === insight.id} onSelect={() => setSelectedId(insight.id)} />) : <div className="insight-empty"><Check size={18} /><strong>No insights match these filters</strong><p>Try another category or severity. New items appear when the underlying financial conditions support them.</p></div>}</section>
      <aside className="insight-detail-panel" aria-live="polite">{selected ? <>
        <div className="insight-detail-top"><span className="section-kicker">INSIGHT DETAIL</span><span className={`insight-status insight-status-${selected.status}`}>{selected.status === 'open' ? 'Current' : selected.status}</span></div>
        <span className={`insight-severity insight-severity-${selected.severity}`}>{severityLabels[selected.severity]}</span><h2>{selected.title}</h2>
        <div className="insight-detail-section"><span>WHAT HAPPENED OR MAY HAPPEN</span><p>{selected.detail}</p></div>
        <div className="insight-detail-section"><span>WHY IT MATTERS</span><p>{selected.why}</p></div>
        <div className="insight-figure-grid">{Object.entries(supportingFigures).filter(([, value]) => Number.isFinite(value)).map(([key, value]) => <div key={key}><small>{key.replaceAll(/([A-Z])/g, ' $1').replaceAll(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (char) => char.toUpperCase())}</small><strong>{key.toLowerCase().includes('percent') ? `${value.toFixed(1)}%` : formatINR(value)}</strong></div>)}</div>
        {selected.dates?.length > 0 && <div className="insight-detail-section"><span>RELEVANT DATES</span><p>{[...new Set(selected.dates)].map((date) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T00:00:00`))).join(' · ')}</p></div>}
        {selected.related && <a className="insight-related-link" href={selected.related.href ?? categoryHref[selected.category]}><FileText size={14} /> {selected.related.label} <ArrowUpRight size={14} /></a>}
        <div className="insight-recommendation"><span className="section-kicker">RECOMMENDED NEXT ACTION</span><p>{selected.action}</p><a href={categoryHref[selected.category]}>Open {categoryLabels[selected.category]} <ArrowUpRight size={13} /></a></div>
        <div className="insight-status-actions">{selected.status === 'resolved' ? <button type="button" onClick={() => setStatus('open')}><RotateCcw size={14} /> Reopen</button> : <><button type="button" className="insight-review-button" onClick={() => setStatus(selected.status === 'reviewed' ? 'open' : 'reviewed')}>{selected.status === 'reviewed' ? <RotateCcw size={14} /> : <Check size={14} />}{selected.status === 'reviewed' ? 'Mark as current' : 'Mark as reviewed'}</button><button type="button" disabled={selected.severity === 'critical'} title={selected.severity === 'critical' ? 'A critical condition must clear in the financial data before it can be resolved.' : undefined} onClick={() => setStatus('resolved')}><CircleCheck size={14} /> Resolve</button></>}</div>
        {selected.severity === 'critical' && selected.status !== 'resolved' && <small className="insight-updated-note">Critical insights stay open until the underlying condition clears.</small>}
        {selected.updatedAt && <small className="insight-updated-note">Status updated {formatWorkspaceDate(selected.updatedAt)}</small>}{error && <p className="insight-error" role="alert">{error}</p>}
      </> : <div className="insight-empty"><Check size={18} /><strong>No supported financial warnings</strong><p>When a rule detects a condition in shared financial data, the insight and its supporting figures will appear here.</p></div>}</aside>
    </div>
    <p className="insights-method-note"><b>How severity is assigned:</b> Critical means the baseline cash forecast falls below zero. High means an open invoice is overdue or one customer has multiple high-risk open invoices. Medium means the projected low point is below the existing 20% cash buffer, an individual invoice has a high rule-based risk indicator, a scheduled expense is at least 20% of current cash, or one expense category is at least 60% of scheduled value. Informational insights are reserved for supported observations without an immediate risk condition. These are decision-support indicators based on stored records, not trained machine-learning predictions or executed actions.</p>
  </main></div></div>
}

export default InsightsActions
