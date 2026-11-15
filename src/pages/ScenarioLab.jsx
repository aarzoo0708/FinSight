import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowDownRight, Banknote, CalendarClock, CircleDollarSign, TrendingDown } from 'lucide-react'
import Sidebar from '../components/Sidebar.jsx'
import StatCard from '../components/StatCard.jsx'
import ScenarioBuilder from '../components/ScenarioBuilder.jsx'
import ScenarioResults from '../components/ScenarioResults.jsx'
import ScenarioHistory from '../components/ScenarioHistory.jsx'
import ScenarioComparison from '../components/ScenarioComparison.jsx'
import { deleteScenarioRecord, getFinancialData, getInvoiceRiskIndicators, saveScenarioRecord } from '../data/financialStore.js'
import { calculateCashFlowAnalysis, calculateOverviewIntelligence } from '../utils/financialServices.js'
import { createBaselineFingerprint, createScenarioTemplates, scenarioDateOffset, simulateScenario, validateScenarioAssumptions } from '../utils/scenarioEngine.js'
import { formatDemoDate, formatINR, formatWorkspaceDate } from '../utils/formatters.js'

function makeInitialScenario(data) {
  return { type: 'payment-delay', name: 'Customer payment delay', description: '', customerId: data.customers[0]?.id ?? '', invoiceId: '', delayChoice: '15', delayDays: 15 }
}

function ScenarioLab() {
  const [data, setData] = useState(() => getFinancialData())
  const [horizonDays, setHorizonDays] = useState(30)
  const [assumptions, setAssumptions] = useState(() => makeInitialScenario(getFinancialData()))
  const [editingId, setEditingId] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [showErrors, setShowErrors] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState('')
  const invoices = useMemo(() => getInvoiceRiskIndicators(data), [data])
  const baseline = useMemo(() => calculateCashFlowAnalysis(data, horizonDays), [data, horizonDays])
  const overview = useMemo(() => calculateOverviewIntelligence(data, horizonDays), [data, horizonDays])
  const baselineFingerprint = useMemo(() => createBaselineFingerprint(data), [data])
  const errors = useMemo(() => validateScenarioAssumptions(assumptions, data), [assumptions, data])
  const liveResult = useMemo(() => errors.length ? null : simulateScenario(data, assumptions, horizonDays), [data, assumptions, horizonDays, errors])
  const minDate = scenarioDateOffset(data, 1)
  const templates = useMemo(() => createScenarioTemplates(data), [data])
  const savedScenarios = useMemo(() => [...(data.scenarios ?? [])].sort((left, right) => right.createdAt.localeCompare(left.createdAt)), [data])
  const historyResults = useMemo(() => new Map(savedScenarios.map((saved) => {
    try { return [saved.id, simulateScenario(data, { ...saved.assumptions, id: saved.id }, saved.horizonDays)] }
    catch { return [saved.id, null] }
  })), [savedScenarios, data])
  const comparisonResults = useMemo(() => savedScenarios.filter((saved) => selectedIds.includes(saved.id)).map((saved) => {
    try { return { saved, result: simulateScenario(data, { ...saved.assumptions, id: saved.id }, horizonDays) } }
    catch { return null }
  }).filter(Boolean), [savedScenarios, selectedIds, data, horizonDays])
  const baselineOverview = {
    scenario: { id: 'baseline', name: 'Baseline' },
    openingCash: baseline.currentCash,
    closingBalance: baseline.closingBalance,
    lowestBalance: baseline.lowestBalance,
    lowestBalanceDate: baseline.lowestBalanceDate,
    negativeDays: baseline.negativeDays,
    healthStatus: overview.healthStatus,
    impact: { additionalExpenses: 0, loanRepayments: 0, netCashImpact: 0 },
  }

  const changeAssumptions = (next) => { setAssumptions(next); setSaveError(''); setNotice('') }
  const applyTemplate = (template) => { changeAssumptions({ ...template, description: template.description ?? '' }); setEditingId(null); setShowErrors(false); setNotice('Template loaded. Review and adjust the assumptions before saving.') }
  const saveCurrent = () => {
    setShowErrors(true)
    if (errors.length) return
    try {
      const result = saveScenarioRecord({ name: assumptions.name, description: assumptions.description, type: assumptions.type, assumptions, horizonDays, baselineFingerprint }, editingId)
      setData(result.data)
      setEditingId(result.scenario.id)
      setSaveError('')
      setNotice(editingId ? 'Saved scenario updated.' : 'Scenario saved to this browser.')
    } catch (error) { setSaveError(error.message) }
  }
  const openSaved = (saved) => { setAssumptions({ ...saved.assumptions, name: saved.name, description: saved.description, type: saved.type }); setHorizonDays(saved.horizonDays); setEditingId(saved.id); setShowErrors(false); setNotice(`Reopened “${saved.name}”. Results use the current financial baseline.`) }
  const duplicateSaved = (saved) => {
    try {
      const result = saveScenarioRecord({ name: `${saved.name} copy`, description: saved.description, type: saved.type, assumptions: { ...saved.assumptions, name: `${saved.name} copy` }, horizonDays: saved.horizonDays, baselineFingerprint }, null)
      setData(result.data); setNotice(`Created “${result.scenario.name}”.`); setSaveError('')
    } catch (error) { setSaveError(error.message) }
  }
  const removeSaved = (saved) => {
    if (!window.confirm(`Delete saved scenario “${saved.name}”?`)) return
    try {
      const next = deleteScenarioRecord(saved.id)
      setData(next); setSelectedIds((current) => current.filter((id) => id !== saved.id))
      if (editingId === saved.id) { setEditingId(null); setAssumptions(makeInitialScenario(next)) }
      setNotice(`Deleted “${saved.name}”.`)
    } catch (error) { setSaveError(error.message) }
  }
  const toggleComparison = (scenarioId) => {
    if (selectedIds.includes(scenarioId)) setSelectedIds((current) => current.filter((id) => id !== scenarioId))
    else if (selectedIds.length >= 3) setNotice('Choose up to three saved scenarios for comparison.')
    else setSelectedIds((current) => [...current, scenarioId])
  }

  return <div className="app-layout" id="scenario-lab"><Sidebar activePage="scenario-lab" /><div className="main-column"><main className="content-area twin-content" aria-labelledby="twin-title">
    <header className="twin-page-heading"><div><span className="section-kicker">{data.business.workspaceLabel} · FINANCIAL DIGITAL TWIN</span><h1 id="twin-title">Financial Digital Twin</h1><p>Simulate business decisions. Understand financial consequences. Plan with confidence.</p><span className="twin-intro-copy">Explore how customer payment delays, expense changes, business investments, and unexpected events could affect your future cash position.</span></div><div className="twin-demo-badge"><i /> SIMULATION · CURRENT DEMO DATA</div></header>
    <p className="twin-data-transparency">A deterministic decision-support model based on shared invoice balances, scheduled expenses, dated actuals when available, and assumptions you choose. Simulations never change the baseline financial records.</p>

    <section className="twin-baseline-section" aria-labelledby="twin-baseline-title"><div className="twin-section-heading"><div><span className="section-kicker">BASELINE · AS OF {formatDemoDate(data.business.asOf)}</span><h2 id="twin-baseline-title">Current position before a decision</h2></div><span className="twin-horizon-caption">FORECAST · NEXT {horizonDays} DAYS</span></div><div className="twin-baseline-grid">
      <StatCard icon={Banknote} label="Current cash" value={formatINR(baseline.currentCash)} note="Shared current balance" tone="sage" />
      <StatCard icon={ArrowDownLeft} label="Outstanding receivables" value={formatINR(overview.outstandingReceivables)} note="Remaining invoice balances" tone="seaglass" />
      <StatCard icon={ArrowDownLeft} label="Expected inflows" value={formatINR(baseline.expectedInflows)} note="Estimated receipts in horizon" tone="seaglass" />
      <StatCard icon={ArrowDownRight} label="Scheduled outflows" value={formatINR(baseline.expectedOutflows)} note="Unpaid, unlinked costs in horizon" tone="peach" />
      <StatCard icon={CircleDollarSign} label="Baseline closing" value={formatINR(baseline.closingBalance)} note={`Projected · day ${horizonDays}`} tone="butter" />
      <StatCard icon={TrendingDown} label="Lowest projected balance" value={formatINR(baseline.lowestBalance)} note={formatWorkspaceDate(baseline.lowestBalanceDate)} tone="peach" />
      <StatCard icon={CalendarClock} label="Baseline financial health" value={overview.healthStatus} note={overview.healthReason} tone="sage" />
    </div></section>

    {notice && <div className="twin-notice" role="status">{notice}</div>}
    <div className="twin-builder-results"><ScenarioBuilder assumptions={assumptions} data={data} invoices={invoices} minDate={minDate} templates={templates} onChange={changeAssumptions} onTemplate={applyTemplate} onSave={saveCurrent} isSaved={Boolean(editingId)} errors={errors} showErrors={showErrors} saveError={saveError} /><ScenarioResults baseline={baseline} result={liveResult} horizonDays={horizonDays} onHorizonChange={setHorizonDays} /></div>

    <ScenarioHistory scenarios={savedScenarios} resultById={historyResults} selectedIds={selectedIds} onToggle={toggleComparison} onOpen={openSaved} onDuplicate={duplicateSaved} onDelete={removeSaved} baselineFingerprint={baselineFingerprint} />
    <ScenarioComparison baseline={baselineOverview} comparisons={comparisonResults} horizonDays={horizonDays} />
    <p className="twin-method-note">Forecast values are estimates, not confirmed payments or offers. Loan EMIs use a standard reducing-balance formula. No trained predictive model, payroll tax calculation, automatic optimization, payment collection, or transaction execution is involved.</p>
    <div className="twin-module-links"><a href="#cash-flow">Review baseline Cash Flow</a><a href="#receivables">Open Receivables</a><a href="#expenses">Review Expenses</a></div>
  </main></div></div>
}

export default ScenarioLab
