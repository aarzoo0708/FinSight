import { useMemo, useState } from 'react'
import { Download, FileUp, RotateCcw, Save, ShieldCheck } from 'lucide-react'
import Sidebar from '../components/Sidebar.jsx'
import { createWorkspaceBackup, getDemoFinancialData, getFinancialData, getFinancialStorageError, importFinancialRecords, resetFinancialData, restoreWorkspaceBackup, switchFinancialWorkspace, updateWorkspaceSettings, validateWorkspaceBackup } from '../data/financialStore.js'
import { reportToCsv } from '../utils/reporting.js'

const CSV_FIELDS = {
  customers: [{ key: 'name', label: 'Customer name', required: true }, { key: 'id', label: 'Stable ID', required: false }, { key: 'companyName', label: 'Company name', required: false }, { key: 'email', label: 'Email', required: false }, { key: 'phone', label: 'Phone', required: false }],
  invoices: [{ key: 'customerId', label: 'Customer ID', required: true }, { key: 'amount', label: 'Amount', required: true }, { key: 'issueDate', label: 'Issue date', required: true }, { key: 'dueDate', label: 'Due date', required: true }, { key: 'id', label: 'Invoice ID', required: false }],
  expenses: [{ key: 'label', label: 'Description', required: true }, { key: 'category', label: 'Category', required: true }, { key: 'amount', label: 'Amount', required: true }, { key: 'dueDate', label: 'Due date', required: true }, { key: 'id', label: 'Expense ID', required: false }],
}

function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (quoted && char === '"' && text[i + 1] === '"') { field += '"'; i += 1 }
    else if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) { row.push(field); field = '' }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[i + 1] === '\n') i += 1; row.push(field); if (row.some((item) => item.trim())) rows.push(row); row = []; field = '' }
    else field += char
  }
  if (quoted) throw new Error('CSV has an unclosed quoted field.')
  row.push(field); if (row.some((item) => item.trim())) rows.push(row)
  if (rows.length < 2) throw new Error('CSV must contain a header and at least one data row.')
  const headers = rows[0].map((value) => value.replace(/^\uFEFF/, '').trim())
  return { headers, rows: rows.slice(1).map((values) => Object.fromEntries(headers.map((header, i) => [header, values[i] ?? '']))) }
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url)
}

function Settings() {
  const [data, setData] = useState(() => getFinancialData())
  const [fields, setFields] = useState(() => ({ name: data.business.name, category: data.business.category ?? '', currency: data.business.currency ?? 'INR', fiscalStartMonth: data.business.fiscalStartMonth ?? 4, datePreference: data.business.datePreference ?? 'DD MMM YYYY' }))
  const [message, setMessage] = useState('')
  const [error, setError] = useState(getFinancialStorageError())
  const [importType, setImportType] = useState('customers')
  const [csv, setCsv] = useState(null)
  const [mapping, setMapping] = useState({})
  const [importResult, setImportResult] = useState(null)
  const [backupCandidate, setBackupCandidate] = useState(null)
  const [restoreError, setRestoreError] = useState('')
  const monthNames = useMemo(() => Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2024, index, 1))), [])
  const fieldDefs = CSV_FIELDS[importType]
  const recordCounts = useMemo(() => ['customers', 'invoices', 'expenses'].map((type) => ({ type, demo: data[type].filter((item) => !item.recordSource).length, user: data[type].filter((item) => item.recordSource === 'user' || item.recordSource === 'user-edited').length })), [data])

  const saveSettings = (event) => {
    event.preventDefault()
    try { const next = updateWorkspaceSettings(fields); setData(next); setError(''); setMessage('Workspace settings saved.') }
    catch (failure) { setError(failure.message); setMessage('') }
  }
  const onCsv = async (file) => {
    setImportResult(null); setCsv(null)
    if (!file) return
    try {
      const parsed = parseCsv(await file.text())
      setCsv(parsed)
      const next = {}
      for (const def of CSV_FIELDS[importType]) next[def.key] = parsed.headers.find((header) => header.toLowerCase().replace(/[^a-z]/g, '') === def.key.toLowerCase() || (def.key === 'label' && ['description', 'expense'].includes(header.toLowerCase())) || (def.key === 'customerId' && ['customer', 'customerid'].includes(header.toLowerCase()))) ?? ''
      setMapping(next)
    } catch (failure) { setError(failure.message) }
  }
  const mappedRecords = useMemo(() => csv?.rows.map((row) => Object.fromEntries(fieldDefs.filter((field) => mapping[field.key]).map((field) => [field.key, row[mapping[field.key]]]))) ?? [], [csv, fieldDefs, mapping])
  const preview = useMemo(() => csv && data.workspaceMode === 'user' ? importFinancialRecords(importType, mappedRecords) : null, [csv, importType, mappedRecords, data.workspaceMode])
  const confirmImport = () => {
    if (!csv || !preview || preview.errors.length) return
    try { const result = importFinancialRecords(importType, mappedRecords); if (result.errors.length) throw new Error(result.errors.map((item) => `Row ${item.row}: ${item.message}`).join(' ')); setData(result.data); setImportResult({ message: `${result.imported} ${importType} imported.`, errors: [] }); setCsv(null); setError('') }
    catch (failure) { setError(failure.message) }
  }
  const onBackup = async (file) => {
    setBackupCandidate(null); setRestoreError('')
    if (!file) return
    try { const parsed = JSON.parse(await file.text()); const valid = validateWorkspaceBackup(parsed); setBackupCandidate({ original: parsed, name: file.name, count: valid.customers.length + valid.invoices.length + valid.expenses.length }) }
    catch (failure) { setRestoreError(failure.message) }
  }
  const doRestore = () => {
    if (!backupCandidate || !window.confirm(`Replace all current workspace data with “${backupCandidate.name}”? This cannot be undone unless you have a backup.`)) return
    try { const next = restoreWorkspaceBackup(backupCandidate.original); setData(next); setBackupCandidate(null); setMessage('Validated workspace backup restored.'); setError('') }
    catch (failure) { setRestoreError(failure.message) }
  }
  const doReset = () => {
    if (!window.confirm('Restore the original FinSight demo dataset as the active workspace? Your separate user workspace, if any, will remain saved in this browser.')) return
    try { const next = resetFinancialData(); setData(next); setFields({ name: next.business.name, category: next.business.category, currency: next.business.currency, fiscalStartMonth: next.business.fiscalStartMonth, datePreference: next.business.datePreference }); setMessage('Demo workspace restored.'); setError('') } catch (failure) { setError(failure.message) }
  }
  const changeWorkspace = () => {
    const mode = data.workspaceMode === 'demo' ? 'user' : 'demo'
    const prompt = mode === 'user'
      ? 'Start your separate, empty business workspace? The demo remains saved in this browser and can be reopened from Settings.'
      : 'Switch to the saved demo workspace? Your separate user workspace will remain saved and can be reopened.'
    if (!window.confirm(prompt)) return
    try { const next = switchFinancialWorkspace(mode); setData(next); setFields({ name: next.business.name, category: next.business.category ?? '', currency: next.business.currency ?? 'INR', fiscalStartMonth: next.business.fiscalStartMonth ?? 4, datePreference: next.business.datePreference ?? 'DD MMM YYYY' }); setCsv(null); setMessage(mode === 'user' ? 'Your separate user workspace is ready.' : 'Saved demo workspace opened.'); setError('') }
    catch (failure) { setError(failure.message) }
  }
  const exportCsv = (type) => {
    const records = data[type]
    const columns = Object.keys(records[0] ?? (type === 'customers' ? { id: '', name: '' } : type === 'invoices' ? { id: '', customerId: '', amount: '', issueDate: '', dueDate: '' } : { id: '', label: '', category: '', amount: '', dueDate: '' })).map((key) => ({ label: key, value: (item) => item[key] }))
    const rows = records.map((record) => columns.map((column) => column.value(record)))
    download(`finsight-${type}.csv`, `\uFEFF${reportToCsv({ columns, rows })}`, 'text/csv;charset=utf-8')
  }

  return <div className="app-layout"><Sidebar activePage="settings" /><div className="main-column"><main className="content-area settings-content" aria-labelledby="settings-title">
    <header className="settings-header"><div><span className="section-kicker">{data.business.workspaceLabel} · WORKSPACE</span><h1 id="settings-title">Business settings &amp; data</h1><p>Manage your workspace records and maintain a portable backup.</p></div><span className={`workspace-mode-pill mode-${data.workspaceMode ?? 'demo'}`}><i />{data.workspaceMode === 'demo' ? 'DEMO DATA' : 'USER MANAGED DATA'}</span></header>
    {(message || error) && <div className={`settings-message${error ? ' has-error' : ''}`} role={error ? 'alert' : 'status'}>{error || message}</div>}
    <section className="settings-panel"><div className="settings-panel-heading"><span className="section-kicker">BUSINESS PROFILE</span><h2>Workspace settings</h2><p>These preferences are saved with the shared financial workspace.</p></div><form className="settings-form" onSubmit={saveSettings}><label>Business display name<input required maxLength="120" value={fields.name} onChange={(event) => setFields({ ...fields, name: event.target.value })} /></label><label>Business category<input maxLength="80" value={fields.category} onChange={(event) => setFields({ ...fields, category: event.target.value })} placeholder="e.g. Homeware" /></label><label>Currency preference<select value={fields.currency} onChange={(event) => setFields({ ...fields, currency: event.target.value })}><option value="INR">INR · Indian Rupee</option></select><small>Financial records are stored in INR. Currency conversion is not available.</small></label><label>Financial year starts<select value={fields.fiscalStartMonth} onChange={(event) => setFields({ ...fields, fiscalStartMonth: event.target.value })}>{monthNames.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></label><label>Date display preference<select value={fields.datePreference} onChange={(event) => setFields({ ...fields, datePreference: event.target.value })}>{['DD MMM YYYY', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].map((format) => <option key={format}>{format}</option>)}</select></label><button type="submit" className="settings-primary-button"><Save size={15} />Save settings</button></form><div className="settings-workspace-facts"><span>Workspace ID <strong>{data.business.id}</strong></span><span>Storage <strong>Browser localStorage</strong></span><span>Schema <strong>v{data.schemaVersion}</strong></span><span>Demo records <strong>{recordCounts.reduce((sum, item) => sum + item.demo, 0)}</strong></span><span>User-entered or edited <strong>{recordCounts.reduce((sum, item) => sum + item.user, 0)}</strong></span><span>Customers / invoices / expenses <strong>{data.customers.length} / {data.invoices.length} / {data.expenses.length}</strong></span></div></section>

    <section className="settings-panel"><div className="settings-panel-heading"><span className="section-kicker">CSV IMPORT</span><h2>Bring in existing records</h2><p>Map columns, inspect validation and duplicate warnings, then confirm. Existing records are never overwritten.</p></div>{data.workspaceMode !== 'user' && <p className="settings-workspace-notice">Demo mode is read-only. Start your separate user workspace below before importing records.</p>}<div className="import-toolbar"><label>Record type<select value={importType} onChange={(event) => { setImportType(event.target.value); setCsv(null); setMapping({}); setImportResult(null) }}>{Object.keys(CSV_FIELDS).map((type) => <option key={type} value={type}>{type}</option>)}</select></label><label className="settings-file-button"><FileUp size={15} />Choose CSV<input type="file" accept=".csv,text/csv" onChange={(event) => onCsv(event.target.files?.[0])} disabled={data.workspaceMode !== 'user'} /></label>{csv && <span>{csv.rows.length} rows · {csv.headers.length} columns</span>}</div>
      {csv && <><div className="import-mapping-grid">{fieldDefs.map((field) => <label key={field.key}>{field.label}{field.required && <b> required</b>}<select value={mapping[field.key] ?? ''} onChange={(event) => setMapping({ ...mapping, [field.key]: event.target.value })}><option value="">Not mapped</option>{csv.headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>)}</div><div className="import-validation-summary">{preview?.errors.length ? <><strong>{preview.errors.length} row issue{preview.errors.length === 1 ? '' : 's'}; nothing will be imported.</strong>{preview.errors.slice(0, 12).map((item) => <p key={`${item.row}-${item.message}`}>Row {item.row}: {item.message}</p>)}</> : <strong>{mappedRecords.length} rows validated. Review the preview then confirm import.</strong>}</div><div className="import-preview-scroll"><table className="import-preview-table"><thead><tr>{fieldDefs.map((field) => <th key={field.key}>{field.label}</th>)}</tr></thead><tbody>{mappedRecords.slice(0, 8).map((record, index) => <tr key={index}>{fieldDefs.map((field) => <td key={field.key}>{record[field.key] || '—'}</td>)}</tr>)}</tbody></table></div><button type="button" className="settings-primary-button" disabled={Boolean(preview?.errors.length) || !mappedRecords.length} onClick={confirmImport}><ShieldCheck size={15} />Confirm import ({mappedRecords.length})</button></>}
      {importResult && <p className="settings-success">{importResult.message}</p>}
    </section>

    <section className="settings-panel"><div className="settings-panel-heading"><span className="section-kicker">EXPORT &amp; BACKUP</span><h2>Take your data with you</h2><p>Exports include stable IDs. JSON backup preserves record relationships and schema version.</p></div><div className="data-export-actions"><button type="button" onClick={() => download('finsight-workspace-backup.json', JSON.stringify(createWorkspaceBackup(data), null, 2), 'application/json')}><Download size={15} />Download full JSON backup</button>{['customers', 'invoices', 'expenses'].map((type) => <button type="button" key={type} onClick={() => exportCsv(type)}><Download size={15} />Export {type} CSV</button>)}</div><div className="restore-row"><label className="settings-file-button"><FileUp size={15} />Choose JSON backup<input type="file" accept="application/json,.json" onChange={(event) => onBackup(event.target.files?.[0])} /></label>{restoreError && <span className="settings-inline-error">{restoreError}</span>}{backupCandidate && <div className="backup-confirm"><span>{backupCandidate.name} validated · {backupCandidate.count} business records.</span><button type="button" className="settings-danger-button" onClick={doRestore}>Confirm replacement</button></div>}</div></section>

    <section className="settings-panel settings-demo-panel"><div className="settings-panel-heading"><span className="section-kicker">DEMO DATA MANAGEMENT</span><h2>{data.workspaceMode === 'demo' ? 'Try your own workspace' : 'Separate demo workspace'}</h2><p>{data.workspaceMode === 'demo' ? 'Start a blank, separate workspace for your own customer, invoice, and expense records. Demo data remains isolated and available to reopen.' : 'Switching workspaces preserves each dataset separately in this browser. No demo records are copied into your user workspace.'}</p></div><div className="settings-workspace-switch-actions"><button type="button" className="settings-primary-button" onClick={changeWorkspace}>{data.workspaceMode === 'demo' ? 'Start your workspace' : 'Open demo workspace'}</button><button type="button" className="settings-danger-button" onClick={doReset}><RotateCcw size={15} />Restore original demo dataset</button></div><span className="settings-demo-count">Demo seed contains {getDemoFinancialData().customers.length} customers, {getDemoFinancialData().invoices.length} invoices, and {getDemoFinancialData().expenses.length} expenses.</span></section>
  </main></div></div>
}

export default Settings
