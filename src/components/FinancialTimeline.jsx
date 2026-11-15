import { useMemo, useState } from 'react'
import { CalendarDays, CircleAlert, Wallet } from 'lucide-react'
import { formatINR, formatShortDate, formatWorkspaceDate } from '../utils/formatters.js'

const fullDate = (date) => formatWorkspaceDate(date, { weekday: true })

function FinancialTimeline({ events, overdueReceivables, asOf }) {
  const [selectedId, setSelectedId] = useState(null)
  const entries = useMemo(() => [
    ...overdueReceivables.map((invoice) => ({ id: `overdue-${invoice.id}`, date: new Date(asOf), kind: 'overdue', type: 'inflow', amount: invoice.remainingAmount, title: `${invoice.customer} · ${invoice.id}`, description: `Overdue since ${formatShortDate(new Date(`${invoice.dueDate}T00:00:00`))}. Expected collection estimate: ${formatShortDate(invoice.prediction.expectedDate)}.`, source: `Invoice ${invoice.id}` })),
    ...events.map((event) => ({ id: event.id, date: event.date, kind: event.type, type: event.type, amount: event.amount, title: event.label, description: event.type === 'inflow' ? `Illustrative expected receipt · ${event.risk} payment-risk indicator.` : `Scheduled expense · ${event.category.replace('-', ' ')}.`, source: event.type === 'inflow' ? `Invoice ${event.invoiceId}` : `Expense ${event.id}` })),
  ].sort((a, b) => a.date - b.date || a.id.localeCompare(b.id)), [events, overdueReceivables, asOf])
  const selected = entries.find((entry) => entry.id === selectedId)
  return <section className="cash-intel-panel timeline-panel" aria-labelledby="timeline-title">
    <div className="cash-intel-panel-heading"><div><span className="section-kicker">FINANCIAL CALENDAR</span><h2 id="timeline-title">Dates to keep in view</h2></div><CalendarDays size={18} color="#668571" /></div>
    <p className="cash-intel-description">Overdue markers sit at today; estimated receipt dates and expense due dates follow the shared forecast.</p>
    {!entries.length ? <p className="timeline-empty">No expected financial events in this horizon.</p> : <div className="timeline-list">{entries.map((entry) => <button className={`timeline-item timeline-${entry.kind}${selectedId === entry.id ? ' is-selected' : ''}`} key={entry.id} type="button" onClick={() => setSelectedId(selectedId === entry.id ? null : entry.id)} aria-expanded={selectedId === entry.id}>
      <span className="timeline-date"><strong>{formatShortDate(entry.date)}</strong><small>{entry.kind === 'overdue' ? 'OVERDUE' : entry.type === 'inflow' ? 'EXPECTED IN' : 'EXPECTED OUT'}</small></span>
      <span className="timeline-copy"><strong>{entry.title}</strong><small>{entry.description}</small></span>
      <span className="timeline-amount">{entry.type === 'inflow' ? '+' : '−'}{formatINR(entry.amount)}</span>
    </button>)}</div>}
    {selected && <aside className="timeline-detail" aria-live="polite"><span className="section-kicker">EVENT DETAILS</span><strong>{selected.title}</strong><p>{selected.description}</p><small>{fullDate(selected.date)} · Source: {selected.source}</small><span className="timeline-detail-type">{selected.kind === 'overdue' ? <CircleAlert size={14} /> : <Wallet size={14} />}{selected.kind === 'overdue' ? 'Open receivable marker; not a separate forecast movement.' : 'Illustrative scheduled movement; not a confirmed payment.'}</span></aside>}
  </section>
}

export default FinancialTimeline
