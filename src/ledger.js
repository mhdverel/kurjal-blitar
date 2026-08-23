export const ADMIN_PERCENTAGE = 0.1
export const JAKARTA_TIME_ZONE = 'Asia/Jakarta'

const DAY = 86_400_000
const JAKARTA_OFFSET = 7 * 60 * 60 * 1000

export const ORDER_TYPES = [
  { value: 'FOOD', label: 'Makanan' },
  { value: 'PACKAGE', label: 'Barang' },
  { value: 'RIDE', label: 'Ojek' },
  { value: 'PICKUP', label: 'Pickup' },
  { value: 'OTHER', label: 'Lainnya' },
]

export const calculateAdminFee = (deliveryFee) =>
  Math.round(Number(deliveryFee) * ADMIN_PERCENTAGE)

export const isValidOrder = ({ customerName, orderType, deliveryFee }) =>
  Boolean(customerName.trim()) && customerName.trim().length <= 80 &&
  ORDER_TYPES.some((type) => type.value === orderType) &&
  Number.isInteger(Number(deliveryFee)) &&
  Number(deliveryFee) > 0 && Number(deliveryFee) <= 10_000_000

export const asDate = (value) => value?.toDate?.() || (value instanceof Date ? value : null)

export function getWeekRange(now = new Date(), offset = 0) {
  const jakarta = new Date(now.getTime() + JAKARTA_OFFSET)
  const dayFromSunday = jakarta.getUTCDay()
  const start = new Date(Date.UTC(
    jakarta.getUTCFullYear(), jakarta.getUTCMonth(),
    jakarta.getUTCDate() - dayFromSunday + offset * 7,
  ) - JAKARTA_OFFSET)
  const end = new Date(start.getTime() + 7 * DAY)
  const keyDate = new Date(start.getTime() + JAKARTA_OFFSET)
  const key = `${keyDate.getUTCFullYear()}-${String(keyDate.getUTCMonth() + 1).padStart(2, '0')}-${String(keyDate.getUTCDate()).padStart(2, '0')}`
  return { key, start, end }
}

export function getCustomRange(start, end) {
  if (!start || !end || start > end) return null
  return {
    start: new Date(`${start}T00:00:00+07:00`),
    end: new Date(new Date(`${end}T00:00:00+07:00`).getTime() + DAY),
  }
}

export function isInRange(value, { start, end }) {
  const date = asDate(value)
  return Boolean(date && date >= start && date < end)
}

export function isToday(value, now = new Date()) {
  const jakarta = new Date(now.getTime() + JAKARTA_OFFSET)
  const start = new Date(Date.UTC(jakarta.getUTCFullYear(), jakarta.getUTCMonth(), jakarta.getUTCDate()) - JAKARTA_OFFSET)
  return isInRange(value, { start, end: new Date(start.getTime() + DAY) })
}

export function isThisMonth(value, now = new Date()) {
  const date = asDate(value)
  if (!date) return false
  const current = new Date(now.getTime() + JAKARTA_OFFSET)
  const target = new Date(date.getTime() + JAKARTA_OFFSET)
  return current.getUTCFullYear() === target.getUTCFullYear() && current.getUTCMonth() === target.getUTCMonth()
}

export const formatDate = (value, options = { dateStyle: 'long' }) => {
  const date = asDate(value)
  return date ? new Intl.DateTimeFormat('id-ID', { ...options, timeZone: JAKARTA_TIME_ZONE }).format(date) : '—'
}

export const formatTime = (value) => formatDate(value, { hour: '2-digit', minute: '2-digit' })

export const formatPeriod = ({ start, end }) =>
  `${formatDate(start)} – ${formatDate(new Date(end.getTime() - DAY))}`
