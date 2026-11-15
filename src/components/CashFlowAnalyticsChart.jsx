import { Area, Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatINR, formatShortDate } from '../utils/formatters.js'

function CashFlowTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return <div className="chart-tooltip cash-intel-tooltip"><strong>{formatShortDate(point.date)}</strong><span>Projected balance <b>{formatINR(point.balance)}</b></span><span>Expected inflows <b>{formatINR(point.inflows)}</b></span><span>Expected outflows <b>{formatINR(point.outflows)}</b></span><span>Net movement <b>{formatINR(point.netMovement)}</b></span></div>
}

function CashFlowAnalyticsChart({ data }) {
  const maxBalance = Math.max(10000, ...data.map((point) => point.balance))
  const movementMax = Math.max(10000, ...data.flatMap((point) => [point.inflows, point.outflows, Math.abs(point.netMovement)]))
  return <section className="cash-intel-panel analytics-panel" aria-labelledby="analytics-title">
    <div className="cash-intel-panel-heading"><div><span className="section-kicker">DAILY CASH-FLOW ANALYTICS</span><h2 id="analytics-title">Movement and balance</h2></div><span className="chart-horizon"><i /> ILLUSTRATIVE PROJECTION</span></div>
    <p className="cash-intel-description">Expected receipts and scheduled expenses are shown by due or estimated date. Actual transactions are shown only when recorded.</p>
    <div className="cash-intel-chart-wrap"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 12, right: 14, left: 5, bottom: 0 }}>
      <CartesianGrid vertical={false} stroke="#e9ece5" strokeDasharray="2 5" />
      <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fill: '#89948b', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#e1e6dc' }} interval="preserveStartEnd" minTickGap={32} />
      <YAxis yAxisId="movement" domain={[-movementMax, movementMax]} tickFormatter={(value) => `₹${Math.round(value / 1000)}k`} tick={{ fill: '#89948b', fontSize: 9 }} tickLine={false} axisLine={false} width={44} />
      <YAxis yAxisId="balance" orientation="right" domain={[Math.min(0, ...data.map((point) => point.balance)), maxBalance]} tickFormatter={(value) => `₹${Math.round(value / 1000)}k`} tick={{ fill: '#89948b', fontSize: 9 }} tickLine={false} axisLine={false} width={46} />
      <ReferenceLine yAxisId="movement" y={0} stroke="#bd9271" strokeWidth={1} />
      <Tooltip content={<CashFlowTooltip />} cursor={{ fill: '#f4f6f1' }} />
      <Bar yAxisId="movement" dataKey="inflows" name="Expected inflows" fill="#9eb9a5" maxBarSize={16} radius={[2, 2, 0, 0]} />
      <Bar yAxisId="movement" dataKey="outflows" name="Expected outflows" fill="#e8c6b3" maxBarSize={16} radius={[2, 2, 0, 0]} />
      <Line yAxisId="movement" dataKey="netMovement" name="Net movement" stroke="#668c83" strokeWidth={1.8} dot={false} isAnimationActive={false} />
      <Area yAxisId="balance" dataKey="balance" name="Projected balance" type="monotone" stroke="#557461" strokeWidth={2.3} fill="#ddebE1" fillOpacity={0.55} dot={false} isAnimationActive={false} />
    </ComposedChart></ResponsiveContainer></div>
    <div className="cash-intel-legend"><span><i className="legend-inflow" /> Expected inflows</span><span><i className="legend-outflow" /> Expected outflows</span><span><i className="legend-net" /> Net movement</span><span><i className="legend-balance" /> Projected balance</span></div>
  </section>
}

export default CashFlowAnalyticsChart
