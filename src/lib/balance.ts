/**
 * Balance formula (all values in cents):
 * net = money_fronted - share_owed + settlements_sent - settlements_received
 *
 * Positive = others owe you | Negative = you owe others
 */
export function computeNetBalance(
  moneyFronted: number,
  shareOwed: number,
  settlementsSent: number,
  settlementsReceived: number
): number {
  return moneyFronted - shareOwed + settlementsSent - settlementsReceived
}

/** Convert integer cents to display string e.g. 1050 → "10.50" */
export function centsToDisplay(cents: number): string {
  return (Math.abs(cents) / 100).toFixed(2)
}

/** Convert user-input dollar string to cents e.g. "10.50" → 1050 */
export function dollarsToCents(dollars: string | number): number {
  return Math.round(parseFloat(String(dollars)) * 100)
}

/**
 * Calculate splits for each split type.
 * Returns a map of userId → amount_owed in cents.
 * All values guaranteed to sum to totalCents (remainder added to first member).
 */
export function calculateSplits(
  totalCents: number,
  memberIds: string[],
  splitType: 'equal' | 'unequal' | 'percentage' | 'share',
  values: Record<string, number> // dollars, percentages, or share counts depending on splitType
): Record<string, number> {
  const result: Record<string, number> = {}

  if (splitType === 'equal') {
    const base = Math.floor(totalCents / memberIds.length)
    const remainder = totalCents - base * memberIds.length
    memberIds.forEach((id, i) => {
      result[id] = base + (i === 0 ? remainder : 0)
    })
    return result
  }

  if (splitType === 'unequal') {
    // values are dollar amounts per person
    memberIds.forEach(id => {
      result[id] = dollarsToCents(values[id] ?? 0)
    })
    return result
  }

  if (splitType === 'percentage') {
    // values are percentages (0-100) per person, must sum to 100
    let sum = 0
    memberIds.forEach((id, i) => {
      const pct = values[id] ?? 0
      const amount = i === memberIds.length - 1
        ? totalCents - sum
        : Math.floor((totalCents * pct) / 100)
      result[id] = amount
      sum += amount
    })
    return result
  }

  if (splitType === 'share') {
    // values are share counts per person
    const totalShares = memberIds.reduce((acc, id) => acc + (values[id] ?? 1), 0)
    let sum = 0
    memberIds.forEach((id, i) => {
      const shares = values[id] ?? 1
      const amount = i === memberIds.length - 1
        ? totalCents - sum
        : Math.floor((totalCents * shares) / totalShares)
      result[id] = amount
      sum += amount
    })
    return result
  }

  return result
}
