export const DEFAULT_DELIVERY_FEE_CONFIG = Object.freeze({
  upTo4Km: 8_000,
  upTo5Km: 10_000,
  upTo6Km: 12_000,
  additionalPerKm: 2_000,
  heavySurcharge: 2_000,
  obrokSurcharge: 4_000,
  rideSurcharge: 2_000,
  cakeSurcharge: 2_000,
  after10PmSurcharge: 2_000,
  afterMidnightSurcharge: 4_000,
  roundTripMultiplier: 2,
})

export const DELIVERY_FEE_FIELDS = Object.keys(DEFAULT_DELIVERY_FEE_CONFIG)

export function isValidDeliveryFeeConfig(config) {
  return Boolean(config) && DELIVERY_FEE_FIELDS.every((field) => Number.isInteger(config[field]) && config[field] >= 0) &&
    config.upTo4Km <= config.upTo5Km && config.upTo5Km <= config.upTo6Km &&
    config.roundTripMultiplier >= 1 && config.roundTripMultiplier <= 10
}

export function tariffFromData(data) {
  const tariff = Object.fromEntries(DELIVERY_FEE_FIELDS.map((field) => [field, data?.[field]]))
  return isValidDeliveryFeeConfig(tariff) ? tariff : DEFAULT_DELIVERY_FEE_CONFIG
}

export function calculateDeliveryFee(input, config = DEFAULT_DELIVERY_FEE_CONFIG) {
  const distanceKm = Number(input?.distanceKm)
  const time = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(input?.serviceTime || '')
  if (!Number.isFinite(distanceKm) || distanceKm <= 0 || !isValidDeliveryFeeConfig(config) ||
      !['DELIVERY', 'RIDE', 'CAKE'].includes(input?.serviceType) || !time ||
      !['NORMAL', 'HEAVY', 'OBROK'].includes(input?.cargoType) ||
      !['ONE_WAY', 'ROUND_TRIP'].includes(input?.tripType)) return null

  const proportionalBaseFee = distanceKm <= 4 ? config.upTo4Km
    : distanceKm <= 5 ? config.upTo5Km
      : config.upTo6Km + Math.max(0, distanceKm - 6) * config.additionalPerKm
  const rawBaseFee = Math.round(proportionalBaseFee)
  const baseFee = Math.ceil(rawBaseFee / 1_000) * 1_000
  const cargoSurcharge = input.serviceType === 'DELIVERY'
    ? input.cargoType === 'HEAVY' ? config.heavySurcharge : input.cargoType === 'OBROK' ? config.obrokSurcharge : 0
    : 0
  const rideSurcharge = input.serviceType === 'RIDE' ? config.rideSurcharge : 0
  const cakeSurcharge = input.serviceType === 'CAKE' ? config.cakeSurcharge : 0
  const multiplier = input.serviceType === 'RIDE' && input.tripType === 'ROUND_TRIP' ? config.roundTripMultiplier : 1
  const hour = Number(time[1])
  // ponytail: tarif lewat tengah malam berakhir pukul 05.00; jadikan cutoff config jika jam operasional berubah.
  const timeSurcharge = hour < 5 ? config.afterMidnightSurcharge : hour >= 22 ? config.after10PmSurcharge : 0

  return {
    distanceKm,
    rawBaseFee,
    baseFee,
    roundingAdjustment: baseFee - rawBaseFee,
    cargoSurcharge,
    rideSurcharge,
    cakeSurcharge,
    timeSurcharge,
    multiplier,
    totalFee: (baseFee + cargoSurcharge + rideSurcharge + cakeSurcharge) * multiplier + timeSurcharge,
  }
}
