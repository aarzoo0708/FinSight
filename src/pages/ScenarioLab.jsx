import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, ChevronRight, RotateCcw, TrendingDown } from 'lucide-react'
import Sidebar from '../components/Sidebar.jsx'
import ScenarioChart from '../components/ScenarioChart.jsx'
import { cashFlowDemo, demoBusiness } from '../data/demoData.js'
import { formatINR, formatDemoDate } from '../utils/formatters.js'
import { formatInvoiceDate } from '../utils/receivables.js'
import { simulateCashFlow } from '../utils/simulation.js'

function ScenarioLab() {
  const [delayAtRiskPayment, setDelayAtRiskPayment] = useState(false)
  const [operatingExpenseIncrease, setOperatingExpenseIncrease] = useState(0)
  const [postponePlannedPurchase, setPostponePlannedPurchase] = useState(false)
  const isScenarioSelected = delayAtRiskPayment || operatingExpenseIncrease > 0 || postponePlannedPurchase
  const baseline = useMemo(() => simulateCashFlow(cashFlowDemo, {}, new Date(demoBusiness.asOf)), [])
  const scenario = useMemo(() => simulateCashFlow(cashFlowDemo, {
    delayAtRiskPayment,
    operatingExpenseIncrease,
    postponePlannedPurchase,
  }, new Date(demoBusiness.asOf)), [delayAtRiskPayment, operatingExpenseIncrease, postponePlannedPurchase])
  const difference = scenario.closingBalance - baseline.closingBalance
  const delayedPayment = scenario.delayedPayment
  const simulatedPaymentDate = new Date(delayedPayment.expectedDate)
  if (delayAtRiskPayment) simulatedPaymentDate.setDate(simulatedPaymentDate.getDate() + 15)
  const plannedPurchase = scenario.postponedPurchase
  const expenseName = cashFlowDemo.events.find((event) => event.type === 'outflow' && event.category === 'operating')?.label ?? 'Operating expenses'
  const getRiskStatus = (result) => result.shortfallDay !== null
    ? { label: 'Cash shortage', tone: 'shortage' }
    : result.minimumBalance < cashFlowDemo.currentCash * 0.2
      ? { label: 'Tight buffer', tone: 'tight' }
      : { label: 'Stable outlook', tone: 'stable' }
  const baselineStatus = getRiskStatus(baseline)
  const scenarioStatus = getRiskStatus(scenario)
  const riskChanged = baselineStatus.tone !== scenarioStatus.tone

  const resetScenario = () => {
    setDelayAtRiskPayment(false)
    setOperatingExpenseIncrease(0)
    setPostponePlannedPurchase(false)
  }

  const status = scenario.shortfallDay !== null
    ? { label: 'Cash shortage', tone: 'shortage', icon: AlertTriangle, detail: `Projected cash falls below zero on day ${scenario.shortfallDay}.` }
    : scenario.minimumBalance < cashFlowDemo.currentCash * 0.2
      ? { label: 'Tight buffer', tone: 'tight', icon: TrendingDown, detail: `The lowest projected balance is ${formatINR(scenario.minimumBalance)} on day ${scenario.minimumBalanceDay}.` }
      : { label: 'Stable outlook', tone: 'stable', icon: ArrowUpRight, detail: `The lowest projected balance stays above ${formatINR(cashFlowDemo.currentCash * 0.2)} throughout the forecast.` }

  const forecastDateForDay = (day) => {
    const point = scenario.forecast.find((entry) => entry.day === day)
    if (point) return point.date
    const date = new Date(demoBusiness.asOf)
    date.setDate(date.getDate() + day)
    return date
  }
  const baselineLowPoint = baseline.forecast.find((point) => point.day === baseline.minimumBalanceDay)
  const scenarioLowPoint = scenario.forecast.find((point) => point.day === scenario.minimumBalanceDay)
  const insights = []

  if (isScenarioSelected) {
    if (delayAtRiskPayment && difference === 0 && scenario.minimumBalance < 0) {
      insights.push({
        title: 'Temporary liquidity shortage',
        text: `Month-end cash remains ${formatINR(scenario.closingBalance)}, unchanged from baseline, but falls to ${formatINR(scenario.minimumBalance)} on ${formatInvoiceDate(scenarioLowPoint.date)} before recovering. The delayed receipt changes the timing of available cash even though the closing balance is unchanged.`,
        icon: AlertTriangle,
      })
    } else if (scenario.minimumBalance < 0 && scenario.closingBalance >= 0) {
      insights.push({
        title: 'Temporary liquidity shortage',
        text: `Projected cash falls to ${formatINR(scenario.minimumBalance)} on ${formatInvoiceDate(scenarioLowPoint.date)}, then recovers to ${formatINR(scenario.closingBalance)} by month end.`,
        icon: AlertTriangle,
      })
    } else if (scenario.shortfallDay !== null) {
      insights.push({
        title: 'Cash remains below zero',
        text: `The lowest balance is ${formatINR(scenario.minimumBalance)} on ${formatInvoiceDate(scenarioLowPoint.date)}, and the forecast closes at ${formatINR(scenario.closingBalance)}.`,
        icon: AlertTriangle,
      })
    } else {
      const direction = difference < 0 ? 'lower' : difference > 0 ? 'higher' : 'unchanged'
      insights.push({
        title: 'Projected cash position',
        text: `The scenario closes at ${formatINR(scenario.closingBalance)}, ${direction}${difference === 0 ? '' : ` by ${formatINR(Math.abs(difference))}`} versus baseline. Its lowest balance is ${formatINR(scenario.minimumBalance)} on ${formatInvoiceDate(scenarioLowPoint.date)}.`,
        icon: difference < 0 ? TrendingDown : ArrowUpRight,
      })
    }

    if (delayAtRiskPayment) {
      const shiftedPayment = scenario.transactions.find((transaction) => transaction.invoiceId === delayedPayment.invoiceId)
      insights.push({
        title: 'Receipt timing assumption',
        text: `${delayedPayment.label} (${formatINR(delayedPayment.amount)}, ${delayedPayment.risk ?? 'unrated'} invoice risk) shifts from ${formatInvoiceDate(delayedPayment.expectedDate)} to ${formatInvoiceDate(forecastDateForDay(shiftedPayment.day))}. This scenario-only shift does not change its predicted payment date or risk classification.`,
        icon: ArrowDownRight,
      })
    }

    if (scenario.operatingExpenseIncreaseAmount > 0) {
      insights.push({
        title: 'Operating outflow impact',
        text: `The simulated operating outflows add ${formatINR(scenario.operatingExpenseIncreaseAmount)} across the forecast.`,
        icon: TrendingDown,
      })
    }

    if (postponePlannedPurchase) {
      const baselinePurchase = baseline.transactions.find((transaction) => transaction.category === 'planned-purchase')
      insights.push({
        title: 'Purchase timing impact',
        text: `${plannedPurchase.label} (${formatINR(plannedPurchase.amount)}) moves from ${formatInvoiceDate(forecastDateForDay(baselinePurchase.day))} to ${formatInvoiceDate(forecastDateForDay(plannedPurchase.day))}; its outflow is outside this forecast horizon.`,
        icon: ArrowUpRight,
      })
    }
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
                  <div className="control-copy"><span className="control-number">01</span><div><strong>Customer payment delay</strong><small>Move the highest-risk expected receipt back 15 days; if none are in range, the largest receipt is used.</small></div></div>
                  <label className="toggle-control"><input type="checkbox" checked={delayAtRiskPayment} onChange={(event) => setDelayAtRiskPayment(event.target.checked)} aria-label="Simulate a 15-day delay to the highest-risk projected receipt" /><span className="toggle-track" /><span className="toggle-state">{delayAtRiskPayment ? 'On' : 'Off'}</span></label>
                  <div className="control-detail"><span className="control-mini-label">SIMULATED TIMING · {delayedPayment.risk ?? 'unrated'} INVOICE RISK</span><strong>{delayedPayment.label}</strong><span>{formatINR(delayedPayment.amount)} · Expected {formatInvoiceDate(delayedPayment.expectedDate)} (day {delayedPayment.day})</span><span>{delayAtRiskPayment ? `Scenario date ${formatInvoiceDate(simulatedPaymentDate)} (day ${delayedPayment.day + 15})` : 'Scenario date unchanged'}</span></div>
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
              <div className="minimum-comparison" aria-label="Lowest projected balance comparison">
                <div><span>BASELINE LOW</span><strong>{formatINR(baseline.minimumBalance)}</strong><small>{formatInvoiceDate(baselineLowPoint.date)} · Day {baseline.minimumBalanceDay}</small></div>
                <div className="scenario-minimum"><span>SCENARIO LOW</span><strong>{formatINR(scenario.minimumBalance)}</strong><small>{formatInvoiceDate(scenarioLowPoint.date)} · Day {scenario.minimumBalanceDay}</small></div>
              </div>
              <div className={`balance-difference ${difference < 0 ? 'difference-negative' : difference > 0 ? 'difference-positive' : ''}`}><span>{difference < 0 ? <ArrowDownRight size={15} /> : difference > 0 ? <ArrowUpRight size={15} /> : <span className="difference-equal">=</span>}{difference === 0 ? 'No change to closing balance' : `${formatINR(Math.abs(difference))} ${difference < 0 ? 'lower' : 'higher'} than baseline`}</span><strong>{difference > 0 ? '+' : difference < 0 ? '−' : ''}{formatINR(Math.abs(difference))}</strong></div>
              <div className={`financial-status status-${status.tone}`}><span className="financial-status-icon"><status.icon size={16} /></span><span><small>FINANCIAL RISK STATUS</small><strong>{status.label}</strong><em>{status.detail}</em></span></div>
              <div className={`risk-change${riskChanged ? ' is-changed' : ''}`}><span>RISK CHANGE</span><strong>{riskChanged ? `${baselineStatus.label} → ${scenarioStatus.label}` : `No change · ${scenarioStatus.label}`}</strong></div>
              <a className="scenario-chart-link" href="#cash-flow-comparison">View baseline vs scenario chart <ChevronRight size={14} /></a>
            </section>
          </div>

          <div id="cash-flow-comparison" className="scenario-chart-anchor"><ScenarioChart baseline={baseline} scenario={scenario} isScenarioSelected={isScenarioSelected} /></div>

          <section className="scenario-insights" aria-labelledby="insights-title">
            <div className="insights-heading"><div><span className="section-kicker">WHY THE OUTLOOK CHANGES</span><h2 id="insights-title">Scenario read-out</h2></div><span className="insight-pair-label">BASELINE <i>→</i> SELECTED SCENARIO</span></div>
            <div className="insight-comparison-row"><div className="insight-side insight-baseline"><span>BASELINE</span><strong>{formatINR(baseline.closingBalance)} close</strong><small>Lowest point: {formatINR(baseline.minimumBalance)} on day {baseline.minimumBalanceDay}</small></div><div className="insight-connector"><ArrowRight size={15} /></div><div className="insight-side insight-selected"><span>SELECTED SCENARIO</span><strong>{formatINR(scenario.closingBalance)} close</strong><small>Lowest point: {formatINR(scenario.minimumBalance)} on day {scenario.minimumBalanceDay}</small></div></div>
            {isScenarioSelected
              ? <div className="insight-message-list">{insights.map((insight, index) => <article className="insight-message" key={`${insight.title}-${index}`}><span><insight.icon size={15} /></span><div><strong>{insight.title}</strong><p>{insight.text}</p></div></article>)}</div>
              : <p className="scenario-helper-message">Try a scenario to see how your financial future changes.</p>}
            <p className="scenario-method-note">Illustrative digital twin: daily balances are recalculated from Nila Homeware's sample transactions. Changes model timing and operating-cost assumptions; they are not financial advice.</p>
          </section>
        </main>
      </div>
    </div>
  )
}

export default ScenarioLab
