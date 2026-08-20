import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateAdminFee, isValidOrder } from '../src/ledger.js'

test('validates an order and calculates the 10% settlement', () => {
  assert.equal(isValidOrder({ customerName: 'Dewi', orderType: 'FOOD', deliveryFee: 15_000 }), true)
  assert.equal(isValidOrder({ customerName: 'Dewi', orderType: 'FOOD', deliveryFee: 0 }), false)
  assert.equal(calculateAdminFee(15_000), 1_500)
})
