import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateAdminFee, getCustomRange, getWeekRange, isInRange, isToday,
  isValidOrder,
} from '../src/ledger.js'

test('validates an order and calculates the 10% settlement', () => {
  assert.equal(isValidOrder({ customerName: 'Dewi', orderType: 'FOOD', deliveryFee: 15_000 }), true)
  assert.equal(isValidOrder({ customerName: 'Dewi', orderType: 'FOOD', deliveryFee: 0 }), false)
  assert.equal(calculateAdminFee(15_000), 1_500)
})

test('uses Sunday-Saturday periods in Asia/Jakarta', () => {
  const saturday = getWeekRange(new Date('2026-08-22T07:00:00.000Z'))
  assert.equal(saturday.key, '2026-08-16')
  assert.equal(saturday.start.toISOString(), '2026-08-15T17:00:00.000Z')
  assert.equal(saturday.end.toISOString(), '2026-08-22T17:00:00.000Z')

  assert.equal(getWeekRange(new Date('2026-08-22T16:59:59.999Z')).key, '2026-08-16')
  assert.equal(getWeekRange(new Date('2026-08-22T17:00:00.000Z')).key, '2026-08-23')
})

test('separates active orders from the previous settlement period', () => {
  const now = new Date('2026-08-23T12:00:00+07:00')
  const activePeriod = getWeekRange(now)
  const duePeriod = getWeekRange(now, -1)
  const orders = [
    new Date('2026-08-23T10:00:00+07:00'),
    new Date('2026-08-22T10:00:00+07:00'),
    new Date('2026-08-22T20:00:00+07:00'),
  ]
  assert.deepEqual(orders.filter((date) => isInRange(date, activePeriod)), [orders[0]])
  assert.deepEqual(orders.filter((date) => isInRange(date, duePeriod)), orders.slice(1))
})

test('treats custom end dates as inclusive in Jakarta', () => {
  const range = getCustomRange('2026-08-20', '2026-08-21')
  assert.equal(isInRange(new Date('2026-08-21T16:59:59.999Z'), range), true)
  assert.equal(isInRange(new Date('2026-08-21T17:00:00.000Z'), range), false)
  assert.equal(isToday(new Date('2026-08-20T17:00:00.000Z'), new Date('2026-08-21T01:00:00.000Z')), true)
  assert.equal(getCustomRange('2026-08-22', '2026-08-21'), null)
})
