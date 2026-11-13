import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ArrowDownToLine, Check, ChevronRight, Clipboard, Clock3, FileText, Search, X } from 'lucide-react'
import Sidebar from '../components/Sidebar.jsx'
import RiskBadge from '../components/RiskBadge.jsx'
import StatCard from '../components/StatCard.jsx'
import { demoBusiness, receivablesDemo } from '../data/demoData.js'
import { formatINR } from '../utils/formatters.js'
import { formatInvoiceDate, getOutstandingSummary, parseLocalDate, predictInvoice } from '../utils/receivables.js'

function Receivables() {
  const [query, setQuery] = useState('')
  const [riskFilter, setRiskFilter] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [followedUp, setFollowedUp] = useState({})
  const [reminder, setReminder] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const reminderRef = useRef(null)
  useEffect(() => {
    if (!selectedId) return undefined
    const closeOnEscape = (event) => { if (event.key === 'Escape') setSelectedId(null) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selectedId])
  const asOf = useMemo(() => parseLocalDate(demoBusiness.asOf.slice(0, 10)), [])
  const summary = getOutstandingSummary(receivablesDemo.invoices, asOf)
  const invoices = useMemo(() => receivablesDemo.invoices.map((invoice) => ({ ...invoice, prediction: predictInvoice(invoice, asOf) })), [asOf])
  const filteredInvoices = invoices.filter(({ customer, id, prediction }) => {
    const matchesQuery = `${customer} ${id}`.toLowerCase().includes(query.trim().toLowerCase())
    return matchesQuery && (riskFilter === 'all' || prediction.risk === riskFilter)
  })
  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedId)

  const markFollowedUp = () => {
    setFollowedUp((current) => ({ ...current, [selectedId]: !current[selectedId] }))
  }

  const generateReminder = () => {
    setReminder(`Hello ${selectedInvoice.customer},\n\nA quick, friendly reminder that invoice ${selectedInvoice.id} for ${formatINR(selectedInvoice.amount)} is due on ${formatInvoiceDate(parseLocalDate(selectedInvoice.dueDate))}. Please let us know if you need a copy of the invoice or have any questions.\n\nThank you,\nNila Homeware`)
    setCopyStatus('')
  }

  const copyReminder = async () => {
    try {
      await navigator.clipboard.writeText(reminder)
      setCopyStatus('Reminder copied')
    } catch {
      reminderRef.current?.focus()
      reminderRef.current?.select()
      setCopyStatus('Select and copy the reminder text')
    }
  }

  return (
    <div className="app-layout">
      <Sidebar activePage="receivables" />
      <div className="main-column">
        <main className="content-area receivables-content" aria-labelledby="receivables-title">
          <header className="receivables-header">
            <div>
              <span className="section-kicker">{demoBusiness.workspaceLabel} <span>·</span> INVOICE INTELLIGENCE</span>
              <h1 id="receivables-title">Receivables intelligence</h1>
              <p>Know which payments need your attention.</p>
            </div>
            <div className="prediction-note"><span className="prediction-note-dot" /><span className="demo-data-inline">DEMO DATA</span><span>Illustrative prototype estimates</span></div>
          </header>

          <section className="receivables-summary" aria-label="Receivables summary">
            <StatCard icon={ArrowDownToLine} label="Total outstanding" value={formatINR(summary.totalOutstanding)} note={`${receivablesDemo.invoices.length} open invoices`} tone="sage" />
            <StatCard icon={AlertCircle} label="High-risk receivables" value={`${summary.highRiskCount} invoices`} note="Based on payment history" tone="peach" />
            <StatCard icon={Clock3} label="Overdue invoices" value={`${summary.overdueCount} invoice${summary.overdueCount === 1 ? '' : 's'}`} note="Past the agreed due date" tone="butter" />
          </section>

          <section className="invoice-workspace" aria-labelledby="invoice-list-title">
            <div className="invoice-toolbar">
              <div className="invoice-list-heading"><span className="section-kicker">COLLECTIONS DESK</span><h2 id="invoice-list-title">Open invoices <span>{filteredInvoices.length}</span></h2></div>
              <div className="invoice-filters">
                <label className="invoice-search"><Search size={16} strokeWidth={1.8} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer or invoice" aria-label="Search invoices" /></label>
                <label className="risk-filter-label"><span>Risk</span><select aria-label="Filter by risk level" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}><option value="all">All levels</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
              </div>
            </div>

            <div className="invoice-table-scroll">
              <table className="invoice-table">
                <thead><tr><th>Customer</th><th>Invoice ID</th><th>Amount</th><th>Expected payment</th><th>Predicted status</th><th>Risk level</th><th>Action</th></tr></thead>
                <tbody>
                  {filteredInvoices.map((invoice) => (
                    <tr className="invoice-row" key={invoice.id} onClick={() => { setSelectedId(invoice.id); setReminder(''); setCopyStatus('') }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(invoice.id); setReminder(''); setCopyStatus('') } }} tabIndex={0} aria-label={`View details for ${invoice.customer}, ${invoice.id}`}>
                      <td className="customer-cell"><span className={`customer-initial ${invoice.prediction.risk}`}>{invoice.customer.slice(0, 1)}</span><strong>{invoice.customer}</strong></td>
                      <td className="invoice-id-cell">{invoice.id}</td>
                      <td className="amount-cell">{formatINR(invoice.amount)}</td>
                      <td className="date-cell">{formatInvoiceDate(invoice.prediction.expectedDate)}</td>
                      <td><span className={`prediction-status status-${invoice.prediction.risk}${invoice.prediction.isOverdue ? ' status-overdue' : ''}`}>{invoice.prediction.status}</span></td>
                      <td><RiskBadge kind={invoice.prediction.risk} /></td>
                      <td><button className="row-action" type="button" onClick={(event) => { event.stopPropagation(); setSelectedId(invoice.id); setReminder(''); setCopyStatus('') }}>Details <ChevronRight size={14} /></button></td>
                    </tr>
                  ))}
                  {!filteredInvoices.length && <tr><td className="empty-invoices" colSpan="7">No invoices match those filters. Try a different search or risk level.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="table-footnote"><span><i /> Payment risk is estimated from prior payment patterns.</span><span>{filteredInvoices.length} of {invoices.length} invoices shown</span></div>
          </section>

          <div className="receivables-disclaimer"><FileText size={14} strokeWidth={1.7} /><p><strong>About these predictions</strong> Estimates use the sample payment history shown in each invoice profile. They are illustrative prototype outputs, not verified machine-learning predictions.</p></div>
        </main>
      </div>

      {selectedInvoice && (
        <div className="detail-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null) }}>
          <aside className="invoice-detail-panel" role="dialog" aria-modal="true" aria-labelledby="detail-title">
            <div className="detail-topline"><span className="section-kicker">RECEIVABLE PROFILE</span><button type="button" className="detail-close" aria-label="Close invoice details" onClick={() => setSelectedId(null)}><X size={18} /></button></div>
            <div className="detail-customer"><span className={`customer-initial large ${selectedInvoice.prediction.risk}`}>{selectedInvoice.customer.slice(0, 1)}</span><div><h2 id="detail-title">{selectedInvoice.customer}</h2><span>{selectedInvoice.id}</span></div></div>
            <div className="detail-status-row"><RiskBadge kind={selectedInvoice.prediction.risk} /><span className={`prediction-status status-${selectedInvoice.prediction.risk}${selectedInvoice.prediction.isOverdue ? ' status-overdue' : ''}`}>{selectedInvoice.prediction.status}</span></div>
            <div className="detail-amount-block"><span>INVOICE AMOUNT</span><strong>{formatINR(selectedInvoice.amount)}</strong><small>Due {formatInvoiceDate(parseLocalDate(selectedInvoice.dueDate))}</small></div>
            <div className="detail-facts">
              <div><span>Customer payment history</span><strong>{selectedInvoice.paymentHistory.paidLate} late of {selectedInvoice.paymentHistory.invoicesPaid} invoices</strong><small>Average delay {selectedInvoice.paymentHistory.averageDaysLate} days</small></div>
              <div><span>Predicted delay</span><strong>{selectedInvoice.prediction.predictedDelayDays === 0 ? 'On agreed terms' : `${selectedInvoice.prediction.predictedDelayDays} days`}</strong></div>
              <div><span>Estimated payment date</span><strong>{formatInvoiceDate(selectedInvoice.prediction.expectedDate)}</strong></div>
            </div>
            <div className={`risk-explanation explanation-${selectedInvoice.prediction.risk}`}><span className="section-kicker">WHY THIS RISK LEVEL</span><p>{selectedInvoice.prediction.riskExplanation}</p></div>
            <p className="model-explanation">Prototype rule: after at least 3 recorded payments, high risk is set when 60% or more were late, or average delay was 12+ days. Medium risk starts at a 30% late rate or 5+ average delay days.</p>
            <div className="detail-actions">
              <button type="button" className={`followup-button${followedUp[selectedInvoice.id] ? ' is-followed' : ''}`} onClick={markFollowedUp}>{followedUp[selectedInvoice.id] ? <><Check size={15} /> Follow-up recorded</> : <>Mark as followed up</>}</button>
              <button type="button" className="reminder-button" onClick={generateReminder}>Generate reminder</button>
            </div>
            {reminder && <div className="reminder-draft"><div className="reminder-draft-heading"><span className="section-kicker">REMINDER DRAFT</span><button type="button" aria-label="Clear reminder" onClick={() => setReminder('')}><X size={15} /></button></div><textarea ref={reminderRef} readOnly value={reminder} aria-label="Generated payment reminder" /><button type="button" className="copy-reminder" onClick={copyReminder}><Clipboard size={14} />{copyStatus || 'Copy message'}</button></div>}
          </aside>
        </div>
      )}
    </div>
  )
}

export default Receivables
