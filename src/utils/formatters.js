const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

export function formatINR(value) {
  return inrFormatter.format(value)
}

export function formatWorkspaceDate(value, { short = false, weekday = false } = {}) {
  const date = value instanceof Date ? value : (() => {
    const key = String(value ?? '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return new Date(value)
    const [year, month, day] = key.split('-').map(Number)
    return new Date(year, month - 1, day)
  })()
  if (Number.isNaN(date.getTime())) return 'Unavailable'
  let preference = 'DD MMM YYYY'
  try { preference = JSON.parse(window.localStorage.getItem('finsight.financial-data.v1') ?? '{}')?.business?.datePreference ?? preference } catch { /* Use the app default if storage is unavailable. */ }
  if (preference === 'DD/MM/YYYY') return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
  if (preference === 'MM/DD/YYYY') return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`
  if (preference === 'YYYY-MM-DD') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return new Intl.DateTimeFormat('en-IN', { ...(weekday ? { weekday: short ? 'short' : 'long' } : {}), day: 'numeric', month: short ? 'short' : 'short', ...(short ? {} : { year: 'numeric' }) }).format(date)
}

export function formatShortDate(date) {
  return formatWorkspaceDate(date, { short: true })
}

export function formatDemoDate(value) {
  return formatWorkspaceDate(value, { weekday: true })
}
