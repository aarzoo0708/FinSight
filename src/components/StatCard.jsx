function StatCard({ icon: Icon, label, value, note, tone = 'sage' }) {
  return (
    <article className="stat-card">
      <div className="stat-topline"><span>{label}</span><span className={`stat-icon tone-${tone}`}><Icon size={16} strokeWidth={1.8} /></span></div>
      <strong className="stat-value">{value}</strong>
      <span className="stat-note">{note}</span>
    </article>
  )
}

export default StatCard
