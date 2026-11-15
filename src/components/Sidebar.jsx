import { Activity, ArrowDownLeft, ChartNoAxesCombined, Compass, FileText, Leaf, Lightbulb, Settings2, SlidersHorizontal, UsersRound, WalletCards } from 'lucide-react'
import { getFinancialData } from '../data/financialStore.js'

function Sidebar({ activePage = 'overview' }) {
  const workspace = getFinancialData()
  const business = workspace.business
  return (
    <aside className="sidebar">
      <a className="brand" href="#overview" aria-label="FinSight overview">
        <span className="brand-mark"><Activity size={17} strokeWidth={1.8} /></span>
        <span className="brand-name">FinSight</span>
      </a>
      <div className="workspace-label">{business.workspaceLabel ?? 'FINANCIAL WORKSPACE'}</div>
      <nav className="side-nav" aria-label="Main navigation">
        <a className={`nav-link${activePage === 'overview' ? ' is-active' : ''}`} href="#overview" aria-current={activePage === 'overview' ? 'page' : undefined}><Compass size={17} strokeWidth={1.7} /><span>Overview</span>{activePage === 'overview' && <span className="nav-indicator" />}</a>
        <a className={`nav-link${activePage === 'receivables' ? ' is-active' : ''}`} href="#receivables" aria-current={activePage === 'receivables' ? 'page' : undefined}><ArrowDownLeft size={17} strokeWidth={1.7} /><span>Receivables</span>{activePage === 'receivables' && <span className="nav-indicator" />}</a>
        <a className={`nav-link${activePage === 'scenario-lab' ? ' is-active' : ''}`} href="#scenario-lab" aria-current={activePage === 'scenario-lab' ? 'page' : undefined}><SlidersHorizontal size={17} strokeWidth={1.7} /><span>Scenario Lab</span>{activePage === 'scenario-lab' && <span className="nav-indicator" />}</a>
        <a className={`nav-link${activePage === 'cash-flow' ? ' is-active' : ''}`} href="#cash-flow" aria-current={activePage === 'cash-flow' ? 'page' : undefined}><ChartNoAxesCombined size={17} strokeWidth={1.7} /><span>Cash Flow</span>{activePage === 'cash-flow' && <span className="nav-indicator" />}</a>
        <a className={`nav-link${activePage === 'customers' ? ' is-active' : ''}`} href="#customers" aria-current={activePage === 'customers' ? 'page' : undefined}><UsersRound size={17} strokeWidth={1.7} /><span>Customers</span>{activePage === 'customers' && <span className="nav-indicator" />}</a>
        <a className={`nav-link${activePage === 'expenses' ? ' is-active' : ''}`} href="#expenses" aria-current={activePage === 'expenses' ? 'page' : undefined}><WalletCards size={17} strokeWidth={1.7} /><span>Expenses</span>{activePage === 'expenses' && <span className="nav-indicator" />}</a>
        <a className={`nav-link${activePage === 'insights' ? ' is-active' : ''}`} href="#insights" aria-current={activePage === 'insights' ? 'page' : undefined}><Lightbulb size={17} strokeWidth={1.7} /><span>Insights &amp; Actions</span>{activePage === 'insights' && <span className="nav-indicator" />}</a>
        <a className={`nav-link${activePage === 'reports' ? ' is-active' : ''}`} href="#reports" aria-current={activePage === 'reports' ? 'page' : undefined}><FileText size={17} strokeWidth={1.7} /><span>Reports</span>{activePage === 'reports' && <span className="nav-indicator" />}</a>
        <a className={`nav-link${activePage === 'settings' ? ' is-active' : ''}`} href="#settings" aria-current={activePage === 'settings' ? 'page' : undefined}><Settings2 size={17} strokeWidth={1.7} /><span>Settings &amp; Data</span>{activePage === 'settings' && <span className="nav-indicator" />}</a>
      </nav>
      <div className="sidebar-profile">
        <span className="profile-avatar">N</span>
        <span className="sidebar-profile-copy"><strong>{business.name}</strong><small>{business.category || 'Business workspace'}</small></span>
        <span className="demo-mini">{workspace.workspaceMode === 'demo' ? 'DEMO' : 'USER'}</span>
      </div>
      <div className="sidebar-footer"><Leaf size={14} strokeWidth={1.6} /><span>See Beyond Today's Finances.</span></div>
    </aside>
  )
}

export default Sidebar
