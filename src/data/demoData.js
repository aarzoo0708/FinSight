import { createCashFlowModel, getExpectedInvoiceEvents, getFinancialData, getInvoiceRiskIndicators } from './financialStore.js'

export const financialData = getFinancialData()
export const demoBusiness = financialData.business
export const receivablesDemo = { predictionModel: financialData.predictionModel, invoices: financialData.invoices }
export const invoiceProjections = getInvoiceRiskIndicators(financialData)
export const cashFlowDemo = createCashFlowModel(financialData)

// Compatibility export for consumers that need only predicted receipts.
export const expectedInvoiceEvents = getExpectedInvoiceEvents(financialData)
