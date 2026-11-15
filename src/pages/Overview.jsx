import { useMemo, useState } from 'react'
import { Activity, AlertTriangle, ArrowDownLeft, ArrowDownRight, ArrowUpRight, Banknote, CalendarClock, Check, ChevronRight, Clock3, FileText, UsersRound } from 'lucide-react'
import Sidebar from '../components/Sidebar.jsx'
import Header from '../components/Header.jsx'
import StatCard from '../components/StatCard.jsx'
import CashFlowChart from '../components/CashFlowChart.jsx'
import { getFinancialData, syncInsightStatuses } from '../data/financialStore.js'
import { calculateOverviewIntelligence, generateFinancialInsights } from '../utils/financialServices.js'
import { formatDemoDate, formatINR, formatShortDate, formatWorkspaceDate } from '../utils/formatters.js'

const alertSeverity = { critical: 'Critical', high: 'High', attention: 'Attention' }

function Overview() {
  const [range, setRange] = useState(30)
  const financialData = useMemo(() => {
    const initial = getFinancialData()
    return syncInsightStatuses(initial, generateFinancialInsights(initial))
  }, [])
  const dashboard = useMemo(() => calculateOverviewIntelligence(financialData, range), [financialData, range])
  const openInsights = useMemo(() => {
    const generated = generateFinancialInsights(financialData, range)
    const statuses = new Map((financialData.insights ?? []).map((item) => [item.id, item.status]))
    return generated.filter((item) => (statuses.get(item.id) ?? 'open') === 'open').slice(0, 4)
  }, [financialData, range])
  const visibleForecast = dashboard.cashFlow.forecast.map((point) => ({
    ...point,
    dateLabel: formatShortDate(point.date),
  }))
  const HealthIcon = dashboard.healthTone === 'healthy' ? Check : AlertTriangle

  return (
    <div className="app-layout" id="overview">
      <Sidebar activePage="overview" />
      <div className="main-column">
        <main className="content-area overview-content" aria-labelledby="page-title">
          <Header range={range} onRangeChange={setRange} asOf={formatDemoDate(financialData.business.asOf)} />

          <section className="overview-health-section" aria-labelledby="health-metrics-title">
            <div className="overview-section-heading"><div><span className="section-kicker">FINANCIAL HEALTH</span><h2 id="health-metrics-title">The position today and ahead</h2></div><span className="overview-period-tag">BASELINE · NEXT {range} DAYS</span></div>
            <div className="overview-health-grid">
              <StatCard icon={Banknote} label="Current cash balance" value={formatINR(dashboard.currentCash)} note="Opening cash · current value" tone="sage" />
              <StatCard icon={ArrowDownLeft} label="Outstanding receivables" value={formatINR(dashboard.outstandingReceivables)} note="Remaining invoice balances" tone="seaglass" />
              <StatCard icon={ArrowUpRight} label="Expected inflows" value={formatINR(dashboard.cashFlow.expectedInflows)} note="Estimated customer receipts" tone="seaglass" />
              <StatCard icon={ArrowDownRight} label="Upcoming expense commitments" value={formatINR(dashboard.upcomingExpenseCommitments)} note="Scheduled outflows in horizon" tone="peach" />
              <StatCard icon={Activity} label="Expected closing balance" value={formatINR(dashboard.expectedClosingBalance)} note={`Projected · end of day ${range}`} tone="butter" />
            </div>
            <div className={`overview-health-status health-${dashboard.healthTone}`}>
              <span className="health-status-icon"><HealthIcon size={17} /></span>
              <div className="health-status-copy"><span className="section-kicker">OVERALL FINANCIAL STATUS</span><strong>{dashboard.healthStatus}</strong><p>{dashboard.healthReason}</p></div>
              <div className="health-low-point"><span>LOWEST PROJECTED BALANCE</span><strong>{formatINR(dashboard.lowestProjectedBalance)}</strong><small>{formatWorkspaceDate(dashboard.lowestProjectedBalanceDate)}</small></div>
            </div>
          </section>

          <section className="overview-cashflow-section" aria-label="Cash-flow outlook">
            <CashFlowChart data={visibleForecast} />
            <div className="overview-chart-action"><span>Baseline opening cash, receipts, and scheduled expenses roll into one daily projection.</span><a className="text-action" href="#cash-flow">Open Cash Flow Intelligence <ChevronRight size={15} /></a></div>
          </section>

          <section className="business-snapshot" aria-labelledby="snapshot-title">
            <div className="overview-section-heading snapshot-heading"><div><span className="section-kicker">BUSINESS SNAPSHOT</span><h2 id="snapshot-title">Exposure at a glance</h2></div><span className="snapshot-asof">SHARED WORKSPACE DATA</span></div>
            <div className="snapshot-metrics">
              <a href="#customers"><span><UsersRound size={15} /> Customers</span><strong>{dashboard.snapshot.totalCustomers}</strong></a>
              <a href="#customers"><span><AlertTriangle size={15} /> High-risk customers</span><strong>{dashboard.snapshot.highRiskCustomers}</strong></a>
              <a href="#receivables"><span><FileText size={15} /> Total invoices</span><strong>{dashboard.snapshot.totalInvoices}</strong></a>
              <a href="#receivables"><span><ArrowDownLeft size={15} /> Outstanding invoices</span><strong>{dashboard.snapshot.outstandingInvoices}</strong></a>
              <a href="#expenses"><span><CalendarClock size={15} /> Upcoming expenses</span><strong>{dashboard.snapshot.totalScheduledExpenses}</strong></a>
            </div>
          </section>

          <div className="overview-insights-grid">
            <section className="overview-alerts-panel" aria-labelledby="alerts-title">
              <div className="panel-heading"><div><span className="section-kicker">PRIORITY FOLLOW-UPS</span><h2 id="alerts-title">Financial alerts</h2></div><span className="overview-alert-count">{openInsights.length} OPEN INSIGHTS</span></div>
              {openInsights.length ? <div className="overview-alert-list">{openInsights.map((alert) => <article className={`overview-alert alert-${alert.severity}`} key={alert.id}>
                <div className="overview-alert-top"><span className={`alert-severity severity-${alert.severity}`}>{alertSeverity[alert.severity] ?? alert.severity}</span>{alert.related && <span className="alert-related">{alert.related.label}</span>}</div>
                <h3>{alert.title}</h3><p className="alert-detail">{alert.detail}</p><p className="alert-why">{alert.why}</p><a href={`#insights?id=${encodeURIComponent(alert.id)}&horizon=${range}`}>View insight and action <ChevronRight size={13} /></a>
              </article>)}</div> : <div className="overview-empty-alerts"><Check size={17} /><p>No open priority insights from the current baseline. Continue monitoring the forecast and invoice dates.</p></div>}
            </section>

            <section className="overview-activity-panel" aria-labelledby="activity-title">
              <div className="panel-heading"><div><span className="section-kicker">RECENT ACTUALS</span><h2 id="activity-title">Financial activity</h2></div><Clock3 size={17} color="#668571" /></div>
              {dashboard.recentActivity.length ? <div className="overview-activity-list">{dashboard.recentActivity.map((activity) => <article className="overview-activity-item" key={activity.id}><span className={`activity-type activity-${activity.type === 'outflow' ? 'outflow' : activity.type === 'inflow' ? 'inflow' : 'generic'}`}>{activity.type === 'outflow' ? <ArrowDownRight size={14} /> : activity.type === 'inflow' ? <ArrowDownLeft size={14} /> : <Activity size={14} />}</span><div><strong>{activity.label}</strong><small>{formatShortDate(new Date(`${String(activity.date).slice(0, 10)}T00:00:00`))}{activity.invoiceId ? ` · ${activity.invoiceId}` : ''}</small></div><b>{activity.amount == null ? 'Amount unavailable' : formatINR(activity.amount)}</b></article>)}</div> : <div className="overview-empty-activity"><span className="activity-empty-icon"><Clock3 size={18} /></span><strong>No historical activity recorded</strong><p>Recent activity will appear here when dated transactions or payment records are added to the shared financial store. Expected invoice receipts and expense schedules are shown in forecasts instead.</p></div>}
            </section>
          </div>

          <div className="quick-action-row"><span className="quick-action-label">WORKSPACE</span><a className="quick-action" href="#receivables">Review receivables <ChevronRight size={14} /></a><a className="quick-action" href="#customers">Customer intelligence <ChevronRight size={14} /></a><a className="quick-action" href="#expenses">Expense schedules <ChevronRight size={14} /></a><a className="quick-action" href="#scenario-lab">Explore scenarios <ChevronRight size={14} /></a><span className="quick-action-note">Illustrative demo data</span></div>
        </main>
      </div>
    </div>
  )
}

export default Overview
