import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowDownLeft, ArrowDownRight, ArrowRightLeft, ArrowUpRight, CheckCircle2 } from 'lucide-react'
import Sidebar from '../components/Sidebar.jsx'
import StatCard from '../components/StatCard.jsx'
import CashFlowAnalyticsChart from '../components/CashFlowAnalyticsChart.jsx'
import FinancialTimeline from '../components/FinancialTimeline.jsx'
import { getFinancialData, getFinancialTransactions, getInvoiceRiskIndicators } from '../data/financialStore.js'
import { calculateCashFlowAnalysis } from '../utils/financialServices.js'
import { formatDemoDate, formatINR, formatWorkspaceDate } from '../utils/formatters.js'

function CashFlowIntelligence() {
  const [horizon, setHorizon] = useState(30)
  const data = useMemo(() => getFinancialData(), [])
  const analysis = useMemo(() => calculateCashFlowAnalysis(data, horizon), [data, horizon])
  const invoices = useMemo(() => getInvoiceRiskIndicators(data), [data])
  const hasHistoricalActuals = useMemo(() => getFinancialTransactions(data).some((event) => event.status === 'actual' && event.date && String(event.date).slice(0, 10) <= data.business.asOf.slice(0, 10)), [data])
  const overdueReceivables = invoices.filter((invoice) => invoice.remainingAmount > 0 && invoice.prediction.isOverdue)
  const eventIds = analysis.events.map((event) => event.id)
  const hasUniqueEvents = new Set(eventIds).size === eventIds.length
  const riskPresentation = {
    stable: { label: 'Stable outlook', icon: CheckCircle2 },
    tight: { label: 'Tight liquidity buffer', icon: AlertTriangle },
    shortage: { label: 'Projected cash shortage', icon: AlertTriangle },
  }[analysis.riskStatus]

  return <div className="app-layout" id="cash-flow">
    <Sidebar activePage="cash-flow" />
    <div className="main-column"><main className="content-area cash-intel-content" aria-labelledby="cash-intel-title">
      <header className="cash-intel-header"><div><span className="section-kicker">{data.business.workspaceLabel} <i>·</i> LIQUIDITY PLANNING</span><h1 id="cash-intel-title">Cash Flow Intelligence</h1><p>See the timing behind your projected cash position.</p></div><div className="cash-intel-header-meta"><span className="projection-pill"><i /> ILLUSTRATIVE PROJECTION</span><small>As of {formatDemoDate(data.business.asOf)}</small></div></header>

      <section className="cash-intel-summary" aria-label={`${horizon}-day cash flow summary`}>
        <StatCard icon={CheckCircle2} label="Current cash balance" value={formatINR(analysis.currentCash)} note="Opening point · shared financial data" tone="sage" />
        <StatCard icon={ArrowDownLeft} label="Expected incoming" value={formatINR(analysis.expectedInflows)} note={`Estimated receipts · next ${horizon} days`} tone="seaglass" />
        <StatCard icon={ArrowDownRight} label="Expected outgoing" value={formatINR(analysis.expectedOutflows)} note={`Scheduled expenses · next ${horizon} days`} tone="peach" />
        <StatCard icon={ArrowUpRight} label="Projected closing" value={formatINR(analysis.closingBalance)} note={`End of day ${horizon} · baseline`} tone="butter" />
      </section>

      <div className="cash-intel-toolbar"><div><span className="section-kicker">FORECAST WINDOW</span><p>Future figures are estimates based on current invoice risk rules and recorded expense schedules.</p></div><div className="horizon-switch" role="group" aria-label="Projection horizon">{[30,60,90].map((days) => <button type="button" key={days} className={horizon === days ? 'is-active' : ''} aria-pressed={horizon === days} onClick={() => setHorizon(days)}>{days} days</button>)}</div></div>

      <div className="cash-intel-main-grid"><CashFlowAnalyticsChart data={analysis.forecast} /><aside className={`cash-intel-panel liquidity-panel liquidity-${analysis.riskStatus}`} aria-labelledby="liquidity-title">
        <div className="cash-intel-panel-heading"><div><span className="section-kicker">LIQUIDITY MONITOR</span><h2 id="liquidity-title">Buffer at a glance</h2></div><riskPresentation.icon size={18} /></div>
        <div className="liquidity-low"><span>LOWEST PROJECTED BALANCE</span><strong>{formatINR(analysis.lowestBalance)}</strong><small>{formatWorkspaceDate(analysis.lowestBalanceDate, { short: true, weekday: true })}</small></div>
        <div className="liquidity-metrics"><div><span>Negative-balance days</span><strong>{analysis.negativeDays}</strong></div><div><span>Net cash movement</span><strong className={analysis.netMovement < 0 ? 'is-negative' : ''}>{analysis.netMovement > 0 ? '+' : ''}{formatINR(analysis.netMovement)}</strong></div></div>
        <div className="liquidity-status"><span className="liquidity-status-icon"><riskPresentation.icon size={16} /></span><span><small>FORECAST RISK STATUS</small><strong>{riskPresentation.label}</strong><em>{analysis.warnings[0]}</em></span></div>
        <div className="forecast-breakdown"><span className="section-kicker">EXPECTED MOVEMENT BREAKDOWN</span>{Object.entries(analysis.breakdown).map(([label,amount])=><div key={label}><span>{label}</span><strong>{formatINR(amount)}</strong></div>)}{!Object.keys(analysis.breakdown).length && <p>No movements scheduled in this horizon.</p>}</div>
      </aside></div>

      <div className="cash-intel-lower-grid"><FinancialTimeline events={analysis.events} overdueReceivables={overdueReceivables} asOf={new Date(`${data.business.asOf.slice(0,10)}T00:00:00`)} /><section className="cash-intel-panel methodology-panel" aria-labelledby="methodology-title"><div className="cash-intel-panel-heading"><div><span className="section-kicker">FORECAST ANALYSIS</span><h2 id="methodology-title">What shapes this view</h2></div><ArrowRightLeft size={18} color="#668571" /></div><p>Baseline cash is recalculated daily from the shared opening balance, estimated invoice receipts, and scheduled expenses. Historical actual transactions would be included only when present in the financial store.</p><div className="methodology-stat"><span>Net movement</span><strong>{analysis.netMovement > 0 ? '+' : ''}{formatINR(analysis.netMovement)}</strong><small>Expected inflows less expected outflows</small></div><div className="methodology-stat"><span>Closing balance check</span><strong>{formatINR(analysis.forecast.at(-1)?.balance ?? 0)}</strong><small>{hasUniqueEvents ? 'All forecast event IDs are unique.' : 'Duplicate event IDs detected.'} Matches final daily forecast point.</small></div><div className="data-origin-note"><span className="section-kicker">DATA BASIS</span><p><b>Expected receipts:</b> remaining invoice balances at estimated collection dates. <b>Expected outflows:</b> existing expense schedules by due date. These are illustrative estimates, not confirmed transfers.</p></div></section></div>
      <p className="cash-intel-footnote">{hasHistoricalActuals ? 'Dated actual transactions and payments through the as-of date are reflected in current cash. Future chart movements remain estimates.' : 'No historical actual transactions or dated payments are recorded in this demo. The chart starts from shared current cash and shows future estimates.'} Scenario assumptions are excluded; expense schedules beyond the selected horizon are not extrapolated.</p>
    </main></div>
  </div>
}

export default CashFlowIntelligence
