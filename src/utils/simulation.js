export function summarizeExpectedMovements(cashFlow, horizonDays = cashFlow.horizonDays) {
  return cashFlow.events.reduce((totals, event) => {
    if (event.day > horizonDays) return totals
    if (event.type === 'inflow') totals.inflows += event.amount
    else totals.outflows += event.amount
    return totals
  }, { inflows: 0, outflows: 0 })
}

export function simulateCashFlow(cashFlow, assumptions = {}, startDate = new Date()) {
  const { delayAtRiskPayment = false, operatingExpenseIncrease = 0, postponePlannedPurchase = false } = assumptions
  const inflowIndexes = cashFlow.events.reduce((indexes, event, index) => {
    if (event.type === 'inflow' && event.day <= cashFlow.horizonDays) indexes.push(index)
    return indexes
  }, [])
  const highRiskIndexes = inflowIndexes.filter((index) => cashFlow.events[index].risk === 'high')
  const candidateIndexes = highRiskIndexes.length ? highRiskIndexes : inflowIndexes
  const delayedPaymentIndex = candidateIndexes.reduce((selectedIndex, index) => (
    selectedIndex < 0 || cashFlow.events[index].amount > cashFlow.events[selectedIndex].amount ? index : selectedIndex
  ), -1)

  const transactions = cashFlow.events.map((event, index) => {
    const transaction = { ...event }
    if (delayAtRiskPayment && index === delayedPaymentIndex) transaction.day += 15
    if (postponePlannedPurchase && transaction.category === 'planned-purchase') transaction.day = cashFlow.horizonDays + 1
    if (operatingExpenseIncrease && transaction.type === 'outflow' && transaction.category === 'operating') {
      transaction.amount = Math.round(transaction.amount * (1 + operatingExpenseIncrease / 100))
    }
    return transaction
  })

  const movementsByDay = new Map()
  transactions.forEach((transaction) => {
    if (transaction.day > cashFlow.horizonDays) return
    const amount = transaction.type === 'inflow' ? transaction.amount : -transaction.amount
    movementsByDay.set(transaction.day, (movementsByDay.get(transaction.day) ?? 0) + amount)
  })

  let balance = cashFlow.currentCash
  const forecast = Array.from({ length: cashFlow.horizonDays + 1 }, (_, day) => {
    if (day > 0) balance += movementsByDay.get(day) ?? 0
    const date = new Date(startDate)
    date.setDate(date.getDate() + day)
    return { day, date, balance }
  })
  const minimumPoint = forecast.reduce((minimum, point) => point.balance < minimum.balance ? point : minimum, forecast[0])
  const shortagePoint = forecast.find((point) => point.balance < 0)

  return {
    transactions,
    forecast,
    closingBalance: forecast.at(-1).balance,
    minimumBalance: minimumPoint.balance,
    minimumBalanceDay: minimumPoint.day,
    shortfallDay: shortagePoint?.day ?? null,
    delayedPayment: delayedPaymentIndex >= 0 ? cashFlow.events[delayedPaymentIndex] : null,
    postponedPurchase: transactions.find((transaction) => transaction.category === 'planned-purchase') ?? null,
    operatingExpenseIncreaseAmount: transactions.reduce((total, transaction, index) => {
      const original = cashFlow.events[index]
      return total + (original.category === 'operating' && original.type === 'outflow' ? transaction.amount - original.amount : 0)
    }, 0),
  }
}
