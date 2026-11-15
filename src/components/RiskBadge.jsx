const labels = { low: 'Low risk', medium: 'Medium risk', high: 'High risk', unrated: 'Unrated', upcoming: 'Upcoming' }

function RiskBadge({ kind }) {
  return <span className={`risk-badge risk-${kind}`}><i />{labels[kind]}</span>
}

export default RiskBadge
