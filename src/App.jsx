import { lazy, Suspense, useEffect, useState } from 'react'

const Overview = lazy(() => import('./pages/Overview.jsx'))
const Receivables = lazy(() => import('./pages/Receivables.jsx'))
const ScenarioLab = lazy(() => import('./pages/ScenarioLab.jsx'))
const CashFlowIntelligence = lazy(() => import('./pages/CashFlowIntelligence.jsx'))
const CustomerIntelligence = lazy(() => import('./pages/CustomerIntelligence.jsx'))
const ExpenseIntelligence = lazy(() => import('./pages/ExpenseIntelligence.jsx'))
const InsightsActions = lazy(() => import('./pages/InsightsActions.jsx'))
const Reports = lazy(() => import('./pages/Reports.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))

function App() {
  const [route, setRoute] = useState(window.location.hash || '#overview')

  useEffect(() => {
    const syncRoute = () => setRoute(window.location.hash || '#overview')
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  const Page = route === '#receivables' ? Receivables : route === '#scenario-lab' ? ScenarioLab : route === '#cash-flow' ? CashFlowIntelligence : route === '#customers' ? CustomerIntelligence : route === '#expenses' ? ExpenseIntelligence : route === '#reports' ? Reports : route === '#settings' ? Settings : route.startsWith('#insights') ? InsightsActions : Overview

  return <Suspense fallback={<div className="page-loading" role="status">Opening your workspace…</div>}><Page /></Suspense>
}

export default App
