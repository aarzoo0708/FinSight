import { AlertTriangle, ArrowDownLeft, ArrowDownRight, ArrowUpRight, CircleCheck, TrendingDown } from 'lucide-react'
import ScenarioChart from './ScenarioChart.jsx'
import { formatINR, formatShortDate } from '../utils/formatters.js'

function Metric({ label, value, note, tone = '' }) {
  return <div className={`twin-metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
}

function ScenarioResults({ baseline, result, horizonDays, onHorizonChange }) {
  if (!result) return <section className="twin-results-panel twin-results-empty"><AlertTriangle size={18} /><strong>Complete the required assumptions to see a result.</strong><p>Nothing is written to the financial store while you explore a scenario.</p></section>
  const delta = result.closingBalance - baseline.closingBalance
  const Icon = result.healthTone === 'healthy' ? CircleCheck : result.healthTone === 'at-risk' ? AlertTriangle : TrendingDown
  const breakdown = [
    ['Additional inflows', result.impact.additionalInflows, ArrowDownLeft],
    ['Financing inflow', result.impact.financingInflows, ArrowDownLeft],
    ['Receipts delayed or removed', result.impact.delayedInflows + result.impact.removedInflows, ArrowDownRight],
    ['Additional expenses', result.impact.additionalExpenses, ArrowDownRight],
    ['Loan repayments in horizon', result.impact.loanRepayments, ArrowDownRight],
    ['Net closing impact', result.impact.netCashImpact, delta >= 0 ? ArrowUpRight : ArrowDownRight],
  ]
  return <div className="twin-results-stack">
    <section className="twin-results-panel" aria-labelledby="twin-results-title">
      <div className="twin-panel-heading"><div><span className="section-kicker">LIVE SCENARIO RESULTS</span><h2 id="twin-results-title">Baseline and decision side by side</h2><p>Both paths use the same opening cash and {horizonDays}-day forecast window.</p></div><div className="twin-horizon-switch" role="group" aria-label="Simulation horizon">{[30, 60, 90].map((days) => <button type="button" key={days} aria-pressed={horizonDays === days} className={horizonDays === days ? 'is-active' : ''} onClick={() => onHorizonChange(days)}>{days} days</button>)}</div></div>
      <div className="twin-metric-grid">
        <Metric label="Current cash · both paths" value={formatINR(result.openingCash)} note="Shared baseline opening balance" />
        <Metric label="Baseline closing" value={formatINR(baseline.closingBalance)} note={`Day ${horizonDays} · current assumptions`} />
        <Metric label="Scenario closing" value={formatINR(result.closingBalance)} note={`${delta >= 0 ? '+' : '−'}${formatINR(Math.abs(delta))} versus baseline`} tone={delta < 0 ? 'metric-peach' : 'metric-sage'} />
        <Metric label="Scenario lowest balance" value={formatINR(result.lowestBalance)} note={formatShortDate(result.lowestBalanceDate)} tone={result.negativeDays ? 'metric-peach' : ''} />
      </div>
      <div className={`twin-risk-status twin-risk-${result.healthTone}`}><span><Icon size={17} /></span><div><small>SCENARIO FINANCIAL HEALTH · {result.liquidityStatus.toUpperCase()}</small><strong>{result.healthStatus}</strong><p>{result.healthReason}</p></div><div className="twin-negative-days"><small>NEGATIVE DAYS</small><strong>{result.negativeDays}</strong></div></div>
      <div className="twin-secondary-metrics"><div><span>Expected inflows</span><strong>{formatINR(result.expectedInflows)}</strong></div><div><span>Expected outflows</span><strong>{formatINR(result.expectedOutflows)}</strong></div><div><span>Net movement</span><strong>{result.netMovement >= 0 ? '+' : '−'}{formatINR(Math.abs(result.netMovement))}</strong></div><div><span>First negative date</span><strong>{result.firstShortfallDate ? formatShortDate(result.firstShortfallDate) : 'None'}</strong></div></div>
    </section>

    <ScenarioChart baseline={baseline} scenario={result} horizonDays={horizonDays} isScenarioSelected />

    <section className="twin-results-panel" aria-labelledby="twin-breakdown-title"><div className="twin-panel-heading"><div><span className="section-kicker">FINANCIAL IMPACT</span><h2 id="twin-breakdown-title">What changed in the forecast</h2></div></div>
      <div className="twin-impact-list">{breakdown.map(([label, amount, ItemIcon]) => <div key={label}><span><ItemIcon size={14} /> {label}</span><strong className={amount < 0 ? 'is-negative' : ''}>{label === 'Net closing impact' && amount > 0 ? '+' : ''}{formatINR(amount)}</strong></div>)}</div>
      {result.impact.emi !== null && <div className="twin-loan-summary"><span className="section-kicker">ILLUSTRATIVE REDUCING-BALANCE LOAN</span><div><span>Estimated monthly EMI</span><strong>{formatINR(result.impact.emi)}</strong></div><div><span>Total repayment over full term</span><strong>{formatINR(result.impact.loanTerms.totalRepayment)}</strong></div><div><span>Total interest over full term</span><strong>{formatINR(result.impact.loanTerms.totalInterest)}</strong></div><p>Only repayment dates inside this forecast horizon affect the daily projection.</p></div>}
      {result.impact.delayedInflows > 0 && <p className="twin-impact-note">{formatINR(result.impact.delayedInflows)} of expected receipts were moved later in the scenario. A moved payment outside the selected horizon is not counted as received.</p>}
      {result.impact.outsideHorizonReceipts.length > 0 && <div className="twin-horizon-warning"><AlertTriangle size={15} /><p>{result.impact.outsideHorizonReceipts.map((item) => `${item.label} (${formatINR(item.amount)})`).join(', ')} falls after day {horizonDays} and is excluded from scenario closing cash.</p></div>}
      {result.impact.outsideHorizonCosts.length > 0 && <div className="twin-horizon-warning"><AlertTriangle size={15} /><p>{result.impact.outsideHorizonCosts.map((item) => `${item.label} (${formatINR(item.amount)})`).join(', ')} falls after day {horizonDays} and is excluded from scenario outflows.</p></div>}
      {result.impact.unmodeledReceipts.length > 0 && <div className="twin-horizon-warning"><AlertTriangle size={15} /><p>{result.impact.unmodeledReceipts.map((item) => `${item.label} (${formatINR(item.amount)})`).join(', ')} has no baseline receipt event in this horizon. The scenario does not alter those invoice records.</p></div>}
      {result.impact.noMatchingExpenseEvents && <div className="twin-horizon-warning"><AlertTriangle size={15} /><p>No unpaid, unlinked expense in this category or forecast horizon was eligible for this adjustment. No expense record was changed.</p></div>}
    </section>

    <section className="twin-recommendations" aria-labelledby="twin-recommendations-title"><div className="twin-panel-heading"><div><span className="section-kicker">RULE-BASED DECISION SUPPORT</span><h2 id="twin-recommendations-title">Points to consider</h2></div></div>{result.recommendations.map((recommendation, index) => <article key={`${recommendation.title}-${index}`}><span className="recommendation-mark"><AlertTriangle size={14} /></span><div><strong>{recommendation.title}</strong><p>{recommendation.why}</p><small>Supporting metric · {recommendation.metric}</small><a href={recommendation.href}>{recommendation.action}</a></div></article>)}</section>
  </div>
}

export default ScenarioResults
