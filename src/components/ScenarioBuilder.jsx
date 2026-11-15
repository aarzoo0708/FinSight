import { CopyCheck, Play, Save, WandSparkles } from 'lucide-react'

const types = [
  ['payment-delay', 'Customer payment delay'], ['expense-increase', 'Expense increase'], ['purchase', 'Planned purchase'], ['hiring', 'Hiring decision'],
  ['financing', 'Loan or financing'], ['customer-loss', 'Major customer loss'], ['unexpected-expense', 'Unexpected expense'], ['custom', 'Custom adjustment'],
]
const field = (label, value, onChange, props = {}) => <label className="twin-field" key={props.name}><span>{label}</span><input value={value ?? ''} onChange={(event) => onChange(event.target.value)} {...props} /></label>

function ScenarioBuilder({ assumptions, data, invoices, minDate, templates, onChange, onTemplate, onSave, isSaved, errors, showErrors, saveError }) {
  const set = (key, value) => onChange({ ...assumptions, [key]: value })
  const linkedInvoices = invoices.filter((invoice) => invoice.customerId === assumptions.customerId && invoice.remainingAmount > 0)
  const categories = [...new Set(data.expenses.map((expense) => expense.category))]
  return <section className="twin-builder-panel" aria-labelledby="scenario-builder-title">
    <div className="twin-panel-heading"><div><span className="section-kicker">SCENARIO BUILDER</span><h2 id="scenario-builder-title">Explore a decision</h2><p>Choose one assumption. Results recalculate against the current baseline as you edit.</p></div><WandSparkles size={18} color="#668571" /></div>
    <div className="twin-template-strip"><span>START WITH A TEMPLATE</span>{templates.map((template) => <button type="button" key={template.label} onClick={() => onTemplate(template.assumptions)}>{template.label}</button>)}</div>
    <div className="twin-common-fields"><label className="twin-field"><span>Scenario type</span><select value={assumptions.type} onChange={(event) => set('type', event.target.value)}>{types.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>{field('Scenario name', assumptions.name, (value) => set('name', value), { name: 'name', maxLength: 60, required: true })}{field('Description (optional)', assumptions.description, (value) => set('description', value), { name: 'description', maxLength: 180 })}</div>
    <div className="twin-dynamic-fields" key={assumptions.type}>
      {assumptions.type === 'payment-delay' && <>
        <label className="twin-field"><span>Customer</span><select value={assumptions.customerId} onChange={(event) => onChange({ ...assumptions, customerId: event.target.value, invoiceId: '' })}>{data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
        <label className="twin-field"><span>Invoice</span><select value={assumptions.invoiceId ?? ''} onChange={(event) => set('invoiceId', event.target.value)}><option value="">All expected invoices for this customer</option>{linkedInvoices.map((invoice) => <option value={invoice.id} key={invoice.id}>{invoice.id} · {invoice.remainingAmount.toLocaleString('en-IN')} outstanding</option>)}</select></label>
        <label className="twin-field"><span>Delay</span><select value={assumptions.delayChoice ?? String(assumptions.delayDays)} onChange={(event) => { set('delayChoice', event.target.value); if (event.target.value !== 'custom') set('delayDays', Number(event.target.value)) }}><option value="7">7 days</option><option value="15">15 days</option><option value="30">30 days</option><option value="custom">Custom</option></select></label>
        {(assumptions.delayChoice === 'custom') && field('Custom delay (days)', assumptions.delayDays, (value) => set('delayDays', value), { name: 'delayDays', type: 'number', min: 1, max: 365, step: 1 })}
        <p className="twin-field-help">The simulation moves the selected remaining invoice inflow. It does not change the stored due date or payment record.</p>
      </>}
      {assumptions.type === 'expense-increase' && <>
        <label className="twin-field"><span>Apply to</span><select value={assumptions.scope} onChange={(event) => set('scope', event.target.value)}><option value="all">All scheduled expenses</option><option value="category">One category</option><option value="expense">One expense</option></select></label>
        {assumptions.scope === 'category' && <label className="twin-field"><span>Category</span><select value={assumptions.category} onChange={(event) => set('category', event.target.value)}>{categories.map((category) => <option value={category} key={category}>{category}</option>)}</select></label>}
        {assumptions.scope === 'expense' && <label className="twin-field"><span>Expense</span><select value={assumptions.expenseId} onChange={(event) => set('expenseId', event.target.value)}>{data.expenses.map((expense) => <option value={expense.id} key={expense.id}>{expense.label}</option>)}</select></label>}
        <label className="twin-field"><span>Adjustment</span><select value={assumptions.adjustmentMode} onChange={(event) => set('adjustmentMode', event.target.value)}><option value="percentage">Percentage increase</option><option value="fixed">Fixed amount per expense</option></select></label>
        {field(assumptions.adjustmentMode === 'percentage' ? 'Increase (%)' : 'Additional amount (INR)', assumptions.value, (value) => set('value', value), { name: 'value', type: 'number', min: 0.01, step: 'any' })}
        <p className="twin-field-help">Applies only to unpaid, unlinked expense events included in the selected forecast horizon.</p>
      </>}
      {['purchase', 'unexpected-expense'].includes(assumptions.type) && <>
        {field(assumptions.type === 'purchase' ? 'Purchase amount (INR)' : 'Unexpected expense (INR)', assumptions.amount, (value) => set('amount', value), { name: 'amount', type: 'number', min: 0.01, step: 'any' })}
        {field('Description', assumptions.description, (value) => set('description', value), { name: 'description', maxLength: 100, required: true })}
        {field(assumptions.type === 'purchase' ? 'Purchase date' : 'Expense date', assumptions.effectiveDate, (value) => set('effectiveDate', value), { name: 'effectiveDate', type: 'date', min: minDate })}
      </>}
      {assumptions.type === 'hiring' && <>
        {field('Role or description', assumptions.description, (value) => set('description', value), { name: 'description', maxLength: 100 })}
        {field('One-time recruitment cost (INR)', assumptions.recruitmentCost, (value) => set('recruitmentCost', value), { name: 'recruitmentCost', type: 'number', min: 0, step: 'any' })}
        {field('Monthly salary (INR)', assumptions.monthlySalary, (value) => set('monthlySalary', value), { name: 'monthlySalary', type: 'number', min: 0.01, step: 'any' })}
        {field('Joining date', assumptions.joiningDate, (value) => set('joiningDate', value), { name: 'joiningDate', type: 'date', min: minDate })}
        {field('Salary months to include', assumptions.monthsIncluded, (value) => set('monthsIncluded', value), { name: 'monthsIncluded', type: 'number', min: 1, max: 36, step: 1 })}
        <p className="twin-field-help">Salary repeats monthly from the joining date for the selected number of months, capped by the forecast horizon. No payroll tax is modeled.</p>
      </>}
      {assumptions.type === 'financing' && <>
        {field('Loan amount (INR)', assumptions.loanAmount, (value) => set('loanAmount', value), { name: 'loanAmount', type: 'number', min: 0.01, step: 'any' })}
        {field('Disbursement date', assumptions.disbursementDate, (value) => set('disbursementDate', value), { name: 'disbursementDate', type: 'date', min: minDate })}
        {field('Annual interest rate (%)', assumptions.annualInterestRate, (value) => set('annualInterestRate', value), { name: 'annualInterestRate', type: 'number', min: 0, max: 100, step: 'any' })}
        {field('Repayment period (months)', assumptions.repaymentMonths, (value) => set('repaymentMonths', value), { name: 'repaymentMonths', type: 'number', min: 1, max: 360, step: 1 })}
        {field('Processing fee (INR)', assumptions.processingFee, (value) => set('processingFee', value), { name: 'processingFee', type: 'number', min: 0, step: 'any' })}
        <p className="twin-field-help">Illustrative reducing-balance EMI estimate. First repayment is one month after disbursement; not a loan offer.</p>
      </>}
      {assumptions.type === 'customer-loss' && <>
        <label className="twin-field"><span>Customer</span><select value={assumptions.customerId} onChange={(event) => set('customerId', event.target.value)}>{data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
        {field('Additional future revenue reduction (%)', assumptions.revenueReductionPercent, (value) => set('revenueReductionPercent', value), { name: 'revenueReductionPercent', type: 'number', min: 0, max: 100, step: 'any' })}
        <p className="twin-field-help">Removes this customer's currently expected invoice receipts in the forecast copy. Optional revenue reduction applies to the remaining expected receipts.</p>
      </>}
      {assumptions.type === 'custom' && <>
        <label className="twin-field"><span>Adjustment type</span><select value={assumptions.adjustmentType} onChange={(event) => set('adjustmentType', event.target.value)}><option value="outflow">Additional outflow</option><option value="inflow">Additional inflow</option></select></label>
        {field('Adjustment amount (INR)', assumptions.amount, (value) => set('amount', value), { name: 'amount', type: 'number', min: 0.01, step: 'any' })}
        {field('Description', assumptions.description, (value) => set('description', value), { name: 'description', maxLength: 100, required: true })}
        {field('Effective date', assumptions.effectiveDate, (value) => set('effectiveDate', value), { name: 'effectiveDate', type: 'date', min: minDate })}
      </>}
    </div>
    {showErrors && errors.length > 0 && <div className="twin-validation-errors" role="alert">{errors.map((error) => <span key={error}>{error}</span>)}</div>}
    {saveError && <p className="twin-save-error" role="alert">{saveError}</p>}
    <div className="twin-builder-actions"><span><Play size={13} /> Results update as assumptions change.</span><button type="button" className="twin-save-button" disabled={errors.length > 0} onClick={onSave}>{isSaved ? <CopyCheck size={14} /> : <Save size={14} />}{isSaved ? 'Update saved scenario' : 'Save scenario'}</button></div>
  </section>
}

export default ScenarioBuilder
