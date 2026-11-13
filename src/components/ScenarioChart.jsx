import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatINR, formatShortDate } from '../utils/formatters.js'

function ScenarioTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="scenario-tooltip">
      <span>{formatShortDate(point.date)} <small>· DAY {point.day}</small></span>
      <div><i className="tooltip-baseline-dot" /><span>Baseline</span><strong>{formatINR(point.baselineBalance)}</strong></div>
      <div><i className="tooltip-scenario-dot" /><span>Scenario</span><strong>{formatINR(point.scenarioBalance)}</strong></div>
    </div>
  )
}

function ScenarioChart({ baseline, scenario, isScenarioSelected }) {
  const data = baseline.forecast.map((point, index) => ({
    day: point.day,
    date: point.date,
    dateLabel: formatShortDate(point.date),
    baselineBalance: point.balance,
    scenarioBalance: scenario.forecast[index].balance,
  }))
  const minValue = Math.min(0, ...data.map((point) => Math.min(point.baselineBalance, point.scenarioBalance)))
  const maxValue = Math.max(0, ...data.map((point) => Math.max(point.baselineBalance, point.scenarioBalance)))
  const step = 10000
  const min = Math.floor(minValue / step) * step
  const max = Math.max(step, Math.ceil(maxValue / step) * step)
  const ticks = Array.from({ length: (max - min) / step + 1 }, (_, index) => min + index * step)

  return (
    <section className="scenario-chart-panel" aria-labelledby="scenario-chart-title">
      <div className="scenario-chart-heading">
        <div><span className="section-kicker">30-DAY CASH POSITION</span><h2 id="scenario-chart-title">Two paths, one decision</h2></div>
        <div className="scenario-legend"><span><i className="baseline-key" /> Baseline</span><span><i className="scenario-key" /> Your scenario</span></div>
      </div>
      <p className="scenario-chart-description">Projected closing cash by day. Move your cursor over the lines to compare balances.</p>
      <div className="scenario-chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 14, bottom: 0, left: 4 }}>
            <CartesianGrid vertical={false} stroke="#e9ece5" strokeDasharray="2 5" />
            <XAxis dataKey="dateLabel" tick={{ fill: '#89948b', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#e1e6dc' }} interval="preserveStartEnd" minTickGap={24} />
            <YAxis domain={[min, max]} ticks={ticks} tickFormatter={(value) => value === 0 ? '₹0' : `₹${Math.abs(value / 1000)}k${value < 0 ? '−' : ''}`} tick={{ fill: '#89948b', fontSize: 10 }} tickLine={false} axisLine={false} width={52} />
            <ReferenceLine y={0} stroke="#bd9271" strokeWidth={1.2} />
            <Tooltip content={<ScenarioTooltip />} cursor={{ stroke: '#bdc9bc', strokeDasharray: '3 4' }} />
            <Line type="stepAfter" dataKey="baselineBalance" name="Baseline" stroke="#789783" strokeWidth={2.2} dot={false} activeDot={{ r: 4, fill: '#fff', stroke: '#668571', strokeWidth: 2 }} isAnimationActive={false} />
            <Line
              type="stepAfter"
              dataKey="scenarioBalance"
              name="Your scenario"
              stroke={isScenarioSelected ? '#a96e56' : '#bd9a86'}
              strokeWidth={isScenarioSelected ? 2.8 : 2.2}
              strokeDasharray={isScenarioSelected ? '7 4' : '5 4'}
              dot={({ cx, cy, payload }) => payload.day === scenario.minimumBalanceDay
                ? <g aria-label={`Lowest projected balance ${formatINR(scenario.minimumBalance)} on ${formatShortDate(scenario.forecast[scenario.minimumBalanceDay].date)}`}><circle cx={cx} cy={cy} r={8} fill="#fff" stroke={isScenarioSelected ? '#a96e56' : '#789783'} strokeWidth={2} /><circle cx={cx} cy={cy} r={3} fill={isScenarioSelected ? '#a96e56' : '#789783'} /></g>
                : null}
              activeDot={{ r: 4, fill: '#fff', stroke: '#a96e56', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

export default ScenarioChart
