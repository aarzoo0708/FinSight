import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowDownRight, ArrowUpRight, Check, ChevronRight, Clock3 } from 'lucide-react'
import Sidebar from '../components/Sidebar.jsx'
import Header from '../components/Header.jsx'
import StatCard from '../components/StatCard.jsx'
import CashFlowChart from '../components/CashFlowChart.jsx'
import RiskBadge from '../components/RiskBadge.jsx'
import { cashFlowDemo, demoBusiness } from '../data/demoData.js'
import { formatDemoDate, formatINR, formatShortDate } from '../utils/formatters.js'
import { simulateCashFlow, summarizeExpectedMovements } from '../utils/simulation.js'

function Overview() {
  const [range, setRange] = useState(30)
  const rangeCashFlow = useMemo(() => ({ ...cashFlowDemo, horizonDays: range }), [range])
  const baseline = useMemo(() => simulateCashFlow(rangeCashFlow, {}, new Date(demoBusiness.asOf)), [rangeCashFlow])
  const delayedLargestPayment = useMemo(() => simulateCashFlow(rangeCashFlow, { delayLargestPayment: true }, new Date(demoBusiness.asOf)), [rangeCashFlow])
  const forecast = baseline.forecast
  const visibleForecast = forecast.slice(0, range + 1).map((point) => ({
    ...point,
    dateLabel: formatShortDate(point.date),
    events: cashFlowDemo.events.filter((event) => event.day === point.day),
  }))
  const closingBalance = baseline.closingBalance
  const movementTotals = summarizeExpectedMovements(cashFlowDemo, range)
  const largestPayment = baseline.largestPayment
  return (
    <div className="app-layout" id="overview">
      <Sidebar activePage="overview" />
      <div className="main-column">
        <main className="content-area overview-content" aria-labelledby="page-title">
          <Header range={range} onRangeChange={setRange} asOf={formatDemoDate(demoBusiness.asOf)} />

          <section className="summary-section" aria-labelledby="summary-title">
            <div className="section-row"><h2 id="summary-title" className="section-kicker">THE NUMBERS TO KNOW</h2><span>INR <i>Â·</i> NEXT {range} DAYS</span></div>
            <div className="summary-grid">
              <StatCard icon={Check} label="Current cash balance" value={formatINR(cashFlowDemo.currentCash)} note="Available today" tone="sage" />
              <StatCard icon={ArrowDownLeft} label="Expected inflows" value={formatINR(movementTotals.inflows)} note="Customer payments" tone="seaglass" />
              <StatCard icon={ArrowDownRight} label="Expected outflows" value={formatINR(movementTotals.outflows)} note="Planned expenses" tone="peach" />
              <StatCard icon={ArrowUpRight} label="Projected closing balance" value={formatINR(closingBalance)} note={`At the end of ${range} days`} tone="butter" />
            </div>
          </section>

          <CashFlowChart data={visibleForecast} />

          <div className="insight-grid">
            <section className="outlook-panel" aria-labelledby="outlook-title">
              <div className="panel-heading"><div><span className="section-kicker">THE READ-OUT</span><h2 id="outlook-title">Financial outlook</h2></div><span className="outlook-mark">01</span></div>
              <div className="outlook-rule" />
              <p>Scheduled receipts keep the {range}-day forecast above zero, but cash dips to {formatINR(baseline.minimumBalance)} on day {baseline.minimumBalanceDay}. A 15-day delay to {largestPayment.label.split(' · ')[0]} would {delayedLargestPayment.shortfallDay === null ? 'tighten that buffer further' : `create a shortfall around day ${delayedLargestPayment.shortfallDay}`}.</p>
              <div className="outlook-footnote"><span className="outlook-status" /><span>Baseline closes at <strong>{formatINR(closingBalance)}</strong> in {range} days.</span></div>
            </section>

            <section className="risk-panel" id="risk-alerts" aria-labelledby="risks-title">
              <div className="panel-heading"><div><span className="section-kicker">KEEP AN EYE ON</span><h2 id="risks-title">Upcoming risks</h2></div><span className="risk-count">{cashFlowDemo.risks.length} TO WATCH</span></div>
              <div className="risk-list">
                {cashFlowDemo.risks.map((risk) => {
                  const event = cashFlowDemo.events[risk.eventIndex]
                  const dueDate = new Date(demoBusiness.asOf)
                  dueDate.setDate(dueDate.getDate() + risk.dueInDays)
                  return (
                    <article className="risk-item" id={risk.id} key={risk.id}>
                      <div className="risk-item-main">
                        <RiskBadge kind={risk.kind} />
                        <strong>{risk.title}</strong>
                        <small>{risk.detail}</small>
                      </div>
                      <div className="risk-item-meta"><strong>{formatINR(event.amount)}</strong><span><Clock3 size={12} /> {formatShortDate(dueDate)}</span></div>
                    </article>
                  )
                })}
              </div>
              <a className="text-action" href="#invoice-1052">Review risky invoices <ChevronRight size={15} /></a>
            </section>
          </div>

          <div className="quick-action-row">
            <span className="quick-action-label">NEXT STEPS</span>
            <button className="quick-action" type="button" onClick={() => document.getElementById('invoice-1052')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Review risky invoices <ChevronRight size={15} /></button>
            <a className="quick-action" href="#scenario-lab">Explore scenarios <ChevronRight size={15} /></a>
            <span className="quick-action-note">Sample business data for demonstration</span>
          </div>
        </main>
      </div>


    </div>
  )
}

export default Overview

