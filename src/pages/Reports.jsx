import { useMemo, useState } from 'react'
import { Download, FileDown, Printer } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Sidebar from '../components/Sidebar.jsx'
import { getFinancialData } from '../data/financialStore.js'
import { formatDemoDate } from '../utils/formatters.js'
import { buildReport, formatReportINR, getReportDateDefaults, REPORT_TYPES, reportToCsv, validateReportFilters } from '../utils/reporting.js'

function Reports() {
  const [data] = useState(() => getFinancialData())
  const defaults = useMemo(() => getReportDateDefaults(data), [data])
  const [filters, setFilters] = useState(() => ({ ...defaults, type: 'overview', customerId: '', category: '', scenarioId: '' }))
  const rangeError = validateReportFilters(filters, data)
  const report = useMemo(() => rangeError ? null : buildReport(data, filters), [data, filters, rangeError])
  const customers = data.customers
  const categories = [...new Set(data.expenses.map((expense) => expense.category).filter(Boolean))]
  const scenarios = data.scenarios ?? []
  const set = (key, value) => setFilters((current) => ({ ...current, [key]: value }))

  const exportCsv = () => {
    if (!report) return
    const content = `\uFEFF${reportToCsv(report)}`
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `finsight-${filters.type}-${filters.startDate}-to-${filters.endDate}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return <div className="app-layout"><Sidebar activePage="reports" /><div className="main-column"><main className="content-area reports-content" aria-labelledby="reports-title">
    <header className="reports-header"><div><span className="section-kicker">{data.business.workspaceLabel} · FINANCIAL RECORDS</span><h1 id="reports-title">Reports &amp; exports</h1><p>Review a consistent view of your financial records, then export what you need.</p></div><span className="reports-asof">AS OF {formatDemoDate(data.business.asOf)}</span></header>

    <section className="report-catalog" aria-label="Available report types">{REPORT_TYPES.map((item) => <button type="button" className={`report-type-card${filters.type === item.id ? ' is-selected' : ''}`} key={item.id} onClick={() => set('type', item.id)} aria-pressed={filters.type === item.id}><span>{item.title}</span><small>{item.description}</small></button>)}</section>

    <section className="report-filter-panel" aria-label="Report filters">
      <label>Report<select value={filters.type} onChange={(event) => set('type', event.target.value)}>{REPORT_TYPES.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label>Start date<input type="date" value={filters.startDate} onChange={(event) => set('startDate', event.target.value)} /></label>
      <label>End date<input type="date" value={filters.endDate} onChange={(event) => set('endDate', event.target.value)} /></label>
      {['receivables', 'customers'].includes(filters.type) && <label>Customer<select value={filters.customerId} onChange={(event) => set('customerId', event.target.value)}><option value="">All customers</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      {filters.type === 'expenses' && <label>Expense category<select value={filters.category} onChange={(event) => set('category', event.target.value)}><option value="">All categories</option>{categories.map((category) => <option key={category} value={category}>{category.replaceAll('-', ' ')}</option>)}</select></label>}
      {filters.type === 'scenario' && <label>Saved scenario<select value={filters.scenarioId} onChange={(event) => set('scenarioId', event.target.value)}><option value="">Select scenario</option>{scenarios.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      {rangeError && <p className="report-filter-error" role="alert">{rangeError}</p>}
      <div className="report-export-actions"><button type="button" onClick={exportCsv} disabled={!report}><Download size={15} />Export CSV</button><button type="button" className="report-pdf-button" onClick={() => window.print()} disabled={!report}><Printer size={15} />Print / Save PDF</button></div>
    </section>

    {!report ? <section className="report-empty-state"><FileDown size={22} /><h2>Adjust the report period</h2><p>Historical reports require dated transaction records. This demo currently has no actual dated transactions.</p></section> : <article className="report-preview" id="report-preview">
      <header className="report-preview-header"><div><span className="section-kicker">FINSIGHT · FINANCIAL REPORT</span><h2>{report.definition.title}</h2><p>{report.definition.description}</p></div><span className="report-generated">GENERATED {formatDemoDate(new Date())}</span></header>
      <div className="report-range-banner"><span>Selected period</span><strong>{filters.startDate} — {filters.endDate}</strong>{report.scenario && <span className="report-simulated-tag">SIMULATED SCENARIO</span>}</div>
      <section className="report-executive-summary"><span className="section-kicker">EXECUTIVE SUMMARY</span><p>{report.executiveSummary}</p></section>
      {report.metrics.length > 0 && <section className="report-metrics-grid" aria-label="Report metrics">{report.metrics.map(([label, value, note]) => <div className="report-metric" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>)}</section>}
      {report.chartPoints?.length > 0 && <section className="report-chart-panel"><div className="report-section-heading"><div><span className="section-kicker">DAILY OUTLOOK</span><h3>Projected cash balance</h3></div><span>Estimate · INR</span></div><div className="report-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={report.chartPoints}><XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })} minTickGap={28} /><YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} /><Tooltip formatter={(value) => formatReportINR(value)} labelFormatter={(value) => new Date(value).toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' })} /><Line type="monotone" dataKey="balance" stroke="#66866e" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div></section>}
      <section className="report-table-section"><div className="report-section-heading"><div><span className="section-kicker">REPORT DETAIL</span><h3>{report.definition.title.replace(' Report', '')} detail</h3></div><span>{report.rows.length} records</span></div><div className="report-table-scroll"><table className="report-table"><thead><tr>{report.columns.map((column) => <th key={column.label}>{column.label}</th>)}</tr></thead><tbody>{report.rows.map((row, index) => <tr key={`${index}-${row[0]}`}>{row.map((value, cell) => <td key={`${index}-${cell}`}>{value}</td>)}</tr>)}{report.rows.length === 0 && <tr><td className="report-no-rows" colSpan={Math.max(1, report.columns.length)}>No records match the selected filters.</td></tr>}</tbody></table></div></section>
      {report.notes.length > 0 && <aside className="report-transparency"><span className="section-kicker">DATA NOTES</span>{report.notes.map((note, index) => <p key={index}>{note}</p>)}</aside>}
      <footer className="report-preview-footer"><span>FinSight · {data.business.name}</span><span>Currency: INR · Prepared from shared workspace records</span></footer>
    </article>}
  </main></div></div>
}

export default Reports
