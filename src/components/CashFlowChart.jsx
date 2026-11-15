import {
  Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { formatINR, formatShortDate } from '../utils/formatters.js'

function ForecastTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="chart-tooltip">
      <span>{formatShortDate(point.date)}</span>
      <strong>{formatINR(point.balance)}</strong>
      {point.events.map((event) => (
        <small className={event.type === 'inflow' ? 'tooltip-inflow' : 'tooltip-outflow'} key={event.label}>
          {event.type === 'inflow' ? '+' : '−'}{formatINR(event.amount)} · {event.label}
        </small>
      ))}
      {!point.events.length && <small>No scheduled movement</small>}
    </div>
  )
}

function CashFlowChart({ data }) {
  const maxBalance = Math.max(...data.map((point) => point.balance), 0)
  const minBalance = Math.min(...data.map((point) => point.balance), 0)
  const yMax = Math.max(10000, Math.ceil(maxBalance / 10000) * 10000)
  const yMin = minBalance < 0 ? Math.floor(minBalance / 10000) * 10000 : 0
  const yTicks = Array.from({ length: 5 }, (_, index) => Math.round(yMin + ((yMax - yMin) / 4) * index))
  return (
    <section className="forecast-panel" aria-labelledby="forecast-title">
      <div className="panel-heading forecast-panel-heading">
        <div><span className="section-kicker">CASH-FLOW FORECAST</span><h2 id="forecast-title">Daily cash-flow outlook</h2></div>
        <span className="chart-horizon"><i /> BASELINE PROJECTION</span>
      </div>
      <p className="chart-description">Daily projected cash balance, based on expected payments and planned expenses.</p>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 14, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e9ece5" strokeDasharray="2 5" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fill: '#89948b', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#e1e6dc' }}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              domain={[yMin, yMax]}
              tickFormatter={(value) => value === 0 ? '₹0' : `${value < 0 ? '−' : ''}₹${Math.round(Math.abs(value) / 1000)}k`}
              tick={{ fill: '#89948b', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={48}
              ticks={yTicks}
            />
            <ReferenceLine y={0} stroke="#bd9271" strokeWidth={1.2} />
            <Tooltip content={<ForecastTooltip />} cursor={{ stroke: '#bdc9bc', strokeDasharray: '3 4' }} />
            <Area
              type="stepAfter"
              dataKey="balance"
              stroke="#779582"
              strokeWidth={2.2}
              fill="#ddebE1"
              fillOpacity={0.62}
              activeDot={{ r: 4, fill: '#fff', stroke: '#668571', strokeWidth: 2 }}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-legend"><span><i className="legend-swatch" /> Projected cash balance</span><span><i className="zero-swatch" /> Zero balance</span></div>
    </section>
  )
}

export default CashFlowChart
