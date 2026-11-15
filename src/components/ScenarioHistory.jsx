import { Copy, GitCompareArrows, Pencil, Trash2 } from 'lucide-react'
import { formatINR, formatShortDate } from '../utils/formatters.js'

function ScenarioHistory({ scenarios, resultById, selectedIds, onToggle, onOpen, onDuplicate, onDelete, baselineFingerprint }) {
  return <section className="twin-results-panel" aria-labelledby="scenario-history-title"><div className="twin-panel-heading"><div><span className="section-kicker">SAVED SCENARIO HISTORY</span><h2 id="scenario-history-title">Your decision library</h2><p>Saved assumptions are recalculated against the current financial baseline.</p></div><span className="twin-history-count">{scenarios.length} SAVED</span></div>
    {scenarios.length ? <div className="twin-history-list">{scenarios.map((saved) => {
      const result = resultById.get(saved.id)
      const stale = saved.baselineFingerprint !== baselineFingerprint
      return <article className="twin-history-item" key={saved.id}><label className="twin-compare-check"><input type="checkbox" checked={selectedIds.includes(saved.id)} disabled={!selectedIds.includes(saved.id) && selectedIds.length >= 3} onChange={() => onToggle(saved.id)} /><span>Compare</span></label><div className="twin-history-copy"><strong>{saved.name}</strong><small>{saved.type.replaceAll('-', ' ')} · saved {formatShortDate(new Date(saved.createdAt))} · {saved.horizonDays}-day horizon</small>{stale && <em>Underlying financial data changed · result recalculated</em>}</div><div className="twin-history-result"><strong>{result ? formatINR(result.closingBalance) : 'Unavailable'}</strong><small>{result ? `Low ${formatINR(result.lowestBalance)} · ${result.healthStatus}` : 'Assumptions need review'}</small></div><div className="twin-history-actions"><button type="button" aria-label={`Edit ${saved.name}`} title="Edit scenario" onClick={() => onOpen(saved)}><Pencil size={14} /></button><button type="button" aria-label={`Duplicate ${saved.name}`} title="Duplicate scenario" onClick={() => onDuplicate(saved)}><Copy size={14} /></button><button type="button" aria-label={`Compare ${saved.name}`} title="Compare scenario" onClick={() => onToggle(saved.id)}><GitCompareArrows size={14} /></button><button type="button" aria-label={`Delete ${saved.name}`} title="Delete scenario" onClick={() => onDelete(saved)}><Trash2 size={14} /></button></div></article>
    })}</div> : <div className="twin-library-empty"><GitCompareArrows size={18} /><strong>No saved scenarios yet</strong><p>Build an assumption set, review its live results, and save it here to revisit or compare later.</p></div>}
  </section>
}

export default ScenarioHistory
