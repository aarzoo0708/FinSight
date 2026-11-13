import { lazy, Suspense, useEffect, useState } from 'react'

const Overview = lazy(() => import('./pages/Overview.jsx'))
const Receivables = lazy(() => import('./pages/Receivables.jsx'))
const ScenarioLab = lazy(() => import('./pages/ScenarioLab.jsx'))

function App() {
  const [route, setRoute] = useState(window.location.hash || '#overview')

  useEffect(() => {
    const syncRoute = () => setRoute(window.location.hash || '#overview')
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  const Page = route === '#receivables' ? Receivables : route === '#scenario-lab' ? ScenarioLab : Overview

  return <Suspense fallback={<div className="page-loading" role="status">Opening your workspace…</div>}><Page /></Suspense>
}

export default App
