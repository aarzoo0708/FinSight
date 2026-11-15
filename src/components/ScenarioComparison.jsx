import { compareScenarioOutcomes } from '../utils/scenarioEngine.js'
import { formatINR, formatShortDate } from '../utils/formatters.js'

function ScenarioComparison({ baseline, comparisons, horizonDays }) {
  if (!comparisons.length) return null
  const favorable = compareScenarioOutcomes(comparisons.map(({ result }) => result))
  const columns = [{ key: 'baseline', name: 'Baseline', result: baseline }, ...comparisons.map(({ saved, result }) => ({ key: saved.id, name: saved.name, result }))]
  const metrics = [
    ['Current cash', (result) => formatINR(result.openingCash)],
    ['Closing balance', (result) => formatINR(result.closingBalance)],
    ['Lowest balance', (result) => formatINR(result.lowestBalance)],
    ['Lowest balance date', (result) => formatShortDate(result.lowestBalanceDate)],
    ['Negative-balance days', (result) => String(result.negativeDays)],
    ['Additional costs', (result) => formatINR((result.impact?.additionalExpenses ?? 0) + (result.impact?.loanRepayments ?? 0))],
    ['Net cash impact', (result) => formatINR(result.impact?.netCashImpact ?? 0)],
    ['Financial health', (result) => result.healthStatus],
  ]
  return <section className="twin-results-panel twin-comparison-panel" aria-labelledby="scenario-comparison-title"><div className="twin-panel-heading"><div><span className="section-kicker">SCENARIO COMPARISON</span><h2 id="scenario-comparison-title">Compare on the same horizon</h2><p>All saved assumptions are recalculated over {horizonDays} days for this comparison.</p></div></div>
    <div className="twin-comparison-note">Most favorable is ranked by fewer negative-balance days, then a higher low balance, then a higher closing balance. This ranking does not score borrowing cost or business strategy.</div>
    <div className="twin-comparison-scroll"><table className="twin-comparison-table"><thead><tr><th>Metric</th>{columns.map((column) => <th key={column.key}>{column.name}{column.key !== 'baseline' && column.key === favorable.mostFavorableId && <small>Most favorable by stated criteria</small>}{column.key !== 'baseline' && column.key === favorable.leastFavorableId && favorable.leastFavorableId !== favorable.mostFavorableId && <small>Least favorable by stated criteria</small>}</th>)}</tr></thead><tbody>{metrics.map(([label, formatter]) => <tr key={label}><th>{label}</th>{columns.map((column) => <td className={column.key === favorable.mostFavorableId ? 'comparison-best' : column.key === favorable.leastFavorableId ? 'comparison-worst' : ''} key={column.key}>{formatter(column.result)}</td>)}</tr>)}</tbody></table></div>
  </section>
}

export default ScenarioComparison
