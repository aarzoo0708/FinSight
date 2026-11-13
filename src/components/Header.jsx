import { CalendarDays, ChevronDown } from 'lucide-react'

function Header({ range, onRangeChange, asOf }) {
  return (
    <header className="overview-header">
      <div className="header-copy">
        <span className="section-kicker">{asOf} <span>·</span> BUSINESS OVERVIEW</span>
        <h1 id="page-title">Your financial outlook</h1>
        <p>A clearer view of what lies ahead.</p>
      </div>
      <div className="header-controls">
        <span className="demo-indicator"><i /> DEMO DATA</span>
        <label className="range-control">
          <CalendarDays size={15} strokeWidth={1.7} />
          <select aria-label="Forecast date range" value={range} onChange={(event) => onRangeChange(Number(event.target.value))}>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </select>
          <ChevronDown size={14} strokeWidth={1.7} aria-hidden="true" />
        </label>
      </div>
    </header>
  )
}

export default Header
