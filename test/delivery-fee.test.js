import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_DELIVERY_FEE_CONFIG, calculateDeliveryFee, isValidDeliveryFeeConfig,
  tariffFromData,
} from '../src/delivery-fee.js'

const input = (distanceKm, overrides = {}) => ({
  distanceKm, serviceTime: '12:00', serviceType: 'DELIVERY', cargoType: 'NORMAL', tripType: 'ONE_WAY', ...overrides,
})

test('charges fractional distance above 6 km and rounds the fee up to Rp1.000', () => {
  for (const [distance, total] of [[3.5, 8_000], [4.2, 10_000], [5.2, 12_000], [6, 12_000], [6.1, 13_000], [6.4, 13_000], [6.5, 13_000], [6.6, 14_000], [7, 14_000], [7.1, 15_000]]) {
    assert.equal(calculateDeliveryFee(input(distance)).totalFee, total)
  }
  assert.equal(calculateDeliveryFee(input(6.4)).rawBaseFee, 12_800)
  assert.equal(calculateDeliveryFee(input(6.4)).roundingAdjustment, 200)
})

test('applies exactly one relevant surcharge and multiplies a round trip last', () => {
  assert.deepEqual(calculateDeliveryFee(input(4, { cargoType: 'HEAVY' })), {
    distanceKm: 4, rawBaseFee: 8_000, baseFee: 8_000, roundingAdjustment: 0,
    cargoSurcharge: 2_000, rideSurcharge: 0, cakeSurcharge: 0, timeSurcharge: 0,
    multiplier: 1, totalFee: 10_000,
  })
  assert.equal(calculateDeliveryFee(input(4, { cargoType: 'OBROK' })).totalFee, 12_000)
  assert.equal(calculateDeliveryFee(input(4, { serviceType: 'RIDE' })).totalFee, 10_000)
  assert.equal(calculateDeliveryFee(input(4, { serviceType: 'RIDE', cargoType: 'OBROK', tripType: 'ROUND_TRIP' })).totalFee, 20_000)
})

test('applies cake and time surcharges once per order', () => {
  assert.equal(calculateDeliveryFee(input(4, { serviceType: 'CAKE', serviceTime: '21:59' })).totalFee, 10_000)
  assert.equal(calculateDeliveryFee(input(4, { serviceType: 'CAKE', serviceTime: '22:00' })).totalFee, 12_000)
  assert.equal(calculateDeliveryFee(input(4, { serviceType: 'CAKE', serviceTime: '00:00' })).totalFee, 14_000)
  assert.equal(calculateDeliveryFee(input(4, { serviceTime: '04:59' })).totalFee, 12_000)
  assert.equal(calculateDeliveryFee(input(4, { serviceTime: '05:00' })).totalFee, 8_000)
  assert.equal(calculateDeliveryFee(input(4, { serviceType: 'RIDE', tripType: 'ROUND_TRIP', serviceTime: '00:30' })).totalFee, 24_000)
})

test('rejects invalid input and invalid configuration', () => {
  for (const distanceKm of ['', 0, -1, 'teks', NaN]) assert.equal(calculateDeliveryFee(input(distanceKm)), null)
  for (const serviceTime of ['', '24:00', 'teks']) assert.equal(calculateDeliveryFee(input(3, { serviceTime })), null)
  assert.equal(calculateDeliveryFee(input(3, { serviceType: 'OTHER' })), null)
  assert.equal(calculateDeliveryFee(input(3), { ...DEFAULT_DELIVERY_FEE_CONFIG, upTo5Km: 1 }), null)
})

test('uses validated Firestore tariff data or the documented fallback', () => {
  const custom = { ...DEFAULT_DELIVERY_FEE_CONFIG, upTo4Km: 9_000, upTo5Km: 11_000, upTo6Km: 13_000 }
  assert.equal(isValidDeliveryFeeConfig(custom), true)
  assert.deepEqual(tariffFromData({ ...custom, updatedBy: 'admin' }), custom)
  assert.equal(tariffFromData({ ...custom, roundTripMultiplier: 0 }), DEFAULT_DELIVERY_FEE_CONFIG)
})
