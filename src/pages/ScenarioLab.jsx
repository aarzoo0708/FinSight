import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, RotateCcw, TrendingDown } from 'lucide-react'
import Sidebar from '../components/Sidebar.jsx'
import ScenarioChart from '../components/ScenarioChart.jsx'
import { cashFlowDemo, demoBusiness } from '../data/demoData.js'
import { formatINR, formatDemoDate } from '../utils/formatters.js'
import { simulateCashFlow } from '../utils/simulation.js'

function ScenarioLab() {
  const [delayLargestPayment, setDelayLargestPayment] = useState(false)
  const [operatingExpenseIncrease, setOperatingExpenseIncrease] = useState(0)
  const [postponePlannedPurchase, setPostponePlannedPurchase] = useState(false)
  const baseline = useMemo(() => simulateCashFlow(cashFlowDemo, {}, new Date(demoBusiness.asOf)), [])
  const scenario = useMemo(() => simulateCashFlow(cashFlowDemo, {
    delayLargestPayment,
    operatingExpenseIncrease,
    postponePlannedPurchase,
  }, new Date(demoBusiness.asOf)), [delayLargestPayment, operatingExpenseIncrease, postponePlannedPurchase])
  const difference = scenario.closingBalance - baseline.closingBalance
  const delayedPayment = scenario.largestPayment
  const plannedPurchase = scenario.postponedPurchase
  const expenseName = cashFlowDemo.events.find((event) => event.type === 'outflow' && event.category === 'operating')?.label ?? 'Operating expenses'

  const resetScenario = () => {
    setDelayLargestPayment(false)
    setOperatingExpenseIncrease(0)
    setPostponePlannedPurchase(false)
  }

  const status = scenario.shortfallDay !== null
    ? { label: 'Cash shortage', tone: 'shortage', icon: AlertTriangle, detail: `Projected cash falls below zero on day ${scenario.shortfallDay}.` }
    : scenario.minimumBalance < cashFlowDemo.currentCash * 0.2
      ? { label: 'Tight buffer', tone: 'tight', icon: TrendingDown, detail: `The lowest projected balance is ${formatINR(scenario.minimumBalance)} on day ${scenario.minimumBalanceDay}.` }
      : { label: 'Stable outlook', tone: 'stable', icon: ArrowUpRight, detail: `The lowest projected balance stays above ${formatINR(cashFlowDemo.currentCash * 0.2)} throughout the forecast.` }

  const insights = []
  if (delayLargestPayment) {
    const delayedPoint = scenario.forecast.find((point) => point.day === delayedPayment.day + 15)
    insights.push({
      title: 'Customer payment delayed',
      text: `${delayedPayment.label} (${formatINR(delayedPayment.amount)}) moves from day ${delayedPayment.day} to day ${delayedPayment.day + 15}. ${scenario.shortfallDay !== null ? `With the other selected assumptions, cash drops below zero on day ${scenario.shortfallDay}.` : `Cash on day ${delayedPoint?.day ?? delayedPayment.day + 15} is ${formatINR(delayedPoint?.balance ?? 0)} after the shifted receipt.`}`,
      icon: ArrowDownRight,
    })
  }
  if (operatingExpenseIncrease > 0) {
    insights.push({
      title: 'Higher operating costs',
      text: `A ${operatingExpenseIncrease}% increase adds ${formatINR(scenario.operatingExpenseIncreaseAmount)} to operating outflows in this forecast, reducing the closing balance by that amount before other scenario changes.`,
      icon: TrendingDown,
    })
  }
  if (postponePlannedPurchase) {
    insights.push({
      title: 'Purchase moved beyond this forecast',
      text: `${plannedPurchase.label} (${formatINR(plannedPurchase.amount)}) moves to day ${plannedPurchase.day}, outside the 30-day window. This preserves short-term liquidity; the expense remains a future obligation.`,
      icon: ArrowUpRight,
    })
  }
  if (!insights.length) {
    insights.push({
      title: 'Baseline assumptions',
      text: 'No assumptions have changed. Turn on a control to see how timing or operating costs reshape the daily cash path.',
      icon: ArrowUpRight,
    })
  }

  return (
    <div className="app-layout">
      <Sidebar activePage="scenario-lab" />
      <div className="main-column">
        <main className="content-area scenario-content" aria-labelledby="scenario-page-title">
          <header className="scenario-page-header">
            <div><span className="section-kicker">{formatDemoDate(demoBusiness.asOf)} <span>·</span> FINANCIAL DIGITAL TWIN</span><h1 id="scenario-page-title">Scenario Lab</h1><p>Test tomorrow's decisions, today.</p></div>
            <span className="scenario-demo-tag"><i /> DEMO DATA <span>·</span> 30-DAY HORIZON</span>
          </header>

          <div className="scenario-workspace">
            <section className="scenario-controls-panel" aria-labelledby="controls-title">
              <div className="scenario-controls-heading"><span className="section-kicker">CHANGE THE ASSUMPTIONS</span><h2 id="controls-title">What would you like to test?</h2><p>Each adjustment reshapes the same underlying transaction plan.</p></div>
              <div className="scenario-control-list">
                <div className="scenario-control-item">
                  <div className="control-copy"><span className="control-number">01</span><div><strong>Customer payment delay</strong><small>Move the largest expected receipt back 15 days.</small></div></div>
                  <label className="toggle-control"><input type="checkbox" checked={delayLargestPayment} onChange={(event) => setDelayLargestPayment(event.target.checked)} aria-label="Delay largest customer payment by 15 days" /><span className="toggle-track" /><span className="toggle-state">{delayLargestPayment ? 'On' : 'Off'}</span></label>
                  <div className="control-detail"><span className="control-mini-label">PAYMENT AFFECTED</span><strong>{delayedPayment.label}</strong><span>{formatINR(delayedPayment.amount)} · Day {delayedPayment.day} <ArrowRight size={12} /> Day {delayedPayment.day + (delayLargestPayment ? 15 : 0)}</span></div>
                </div>

                <div className="scenario-control-item expense-control-item">
                  <div className="control-copy"><span className="control-number">02</span><div><strong>Operating expense increase</strong><small>Scale planned operating costs for this period.</small></div></div>
                  <div className="slider-value">{operatingExpenseIncrease}%</div>
                  <label className="expense-slider-label" htmlFor="expense-increase">Increase in operating expenses</label>
                  <input id="expense-increase" className="expense-slider" type="range" min="0" max="40" step="1" value={operatingExpenseIncrease} onChange={(event) => setOperatingExpenseIncrease(Number(event.target.value))} style={{ '--slider-progress': `${operatingExpenseIncrease / 40 * 100}%` }} />
                  <div className="slider-scale"><span>0%</span><span>20%</span><span>40%</span></div>
                  <div className="control-detail expense-detail"><span className="control-mini-label">APPLIES TO OPERATING COSTS</span><strong>{expenseName}, payroll, rent &amp; other operating outflows</strong><span>Current uplift: {formatINR(scenario.operatingExpenseIncreaseAmount)}</span></div>
                </div>

                <div className="scenario-control-item">
                  <div className="control-copy"><span className="control-number">03</span><div><strong>Postpone planned purchase</strong><small>Move the equipment instalment outside this forecast.</small></div></div>
                  <label className="toggle-control"><input type="checkbox" checked={postponePlannedPurchase} onChange={(event) => setPostponePlannedPurchase(event.target.checked)} aria-label="Postpone planned equipment purchase beyond the 30 day forecast" /><span className="toggle-track" /><span className="toggle-state">{postponePlannedPurchase ? 'On' : 'Off'}</span></label>
                  <div className="control-detail"><span className="control-mini-label">PLANNED PURCHASE</span><strong>{plannedPurchase.label}</strong><span>{formatINR(plannedPurchase.amount)} · {postponePlannedPurchase ? `Moved to day ${plannedPurchase.day}` : `Scheduled day ${plannedPurchase.day}`}</span></div>
                </div>
              </div>
              <button type="button" className="reset-scenario" onClick={resetScenario}><RotateCcw size={14} /> Reset scenario</button>
            </section>

            <section className="scenario-impact-panel" aria-labelledby="impact-title">
              <div className="impact-heading"><div><span className="section-kicker">LIVE FINANCIAL IMPACT</span><h2 id="impact-title">The month-end view</h2></div><span className="live-indicator"><i /> LIVE</span></div>
              <div className="balance-comparison">
                <div className="balance-column baseline-column"><span>BASELINE CLOSE</span><strong>{formatINR(baseline.closingBalance)}</strong><small>Current assumptions</small></div>
                <div className="balance-arrow"><ArrowRight size={16} /></div>
                <div className="balance-column scenario-column"><span>SCENARIO CLOSE</span><strong>{formatINR(scenario.closingBalance)}</strong><small>With selected changes</small></div>
              </div>
              <div className={`balance-difference ${difference < 0 ? 'difference-negative' : difference > 0 ? 'difference-positive' : ''}`}><span>{difference < 0 ? <ArrowDownRight size={15} /> : difference > 0 ? <ArrowUpRight size={15} /> : <span className="difference-equal">=</span>}{difference === 0 ? 'No change to closing balance' : `${formatINR(Math.abs(difference))} ${difference < 0 ? 'lower' : 'higher'} than baseline`}</span><strong>{difference > 0 ? '+' : difference < 0 ? '−' : ''}{formatINR(Math.abs(difference))}</strong></div>
              <div className={`financial-status status-${status.tone}`}><span className="financial-status-icon"><status.icon size={16} /></span><span><small>FINANCIAL RISK STATUS</small><strong>{status.label}</strong><em>{status.detail}</em></span></div>
            </section>
          </div>

          <ScenarioChart baseline={baseline} scenario={scenario} />

          <section className="scenario-insights" aria-labelledby="insights-title">
            <div className="insights-heading"><div><span className="section-kicker">WHY THE OUTLOOK CHANGES</span><h2 id="insights-title">Scenario read-out</h2></div><span className="insight-pair-label">BASELINE <i>→</i> SELECTED SCENARIO</span></div>
            <div className="insight-comparison-row"><div className="insight-side insight-baseline"><span>BASELINE</span><strong>{formatINR(baseline.closingBalance)} close</strong><small>Lowest point: {formatINR(baseline.minimumBalance)} on day {baseline.minimumBalanceDay}</small></div><div className="insight-connector"><ArrowRight size={15} /></div><div className="insight-side insight-selected"><span>SELECTED SCENARIO</span><strong>{formatINR(scenario.closingBalance)} close</strong><small>Lowest point: {formatINR(scenario.minimumBalance)} on day {scenario.minimumBalanceDay}</small></div></div>
            <div className="insight-message-list">{insights.map((insight) => <article className="insight-message" key={insight.title}><span><insight.icon size={15} /></span><div><strong>{insight.title}</strong><p>{insight.text}</p></div></article>)}</div>
            <p className="scenario-method-note">Illustrative digital twin: daily balances are recalculated from Nila Homeware's sample transactions. Changes model timing and operating-cost assumptions; they are not financial advice.</p>
          </section>
        </main>
      </div>
    </div>
  )
}

export default ScenarioLab
