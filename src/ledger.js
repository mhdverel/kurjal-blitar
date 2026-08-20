export const ADMIN_PERCENTAGE = 0.1

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
  Boolean(customerName.trim()) &&
  ORDER_TYPES.some((type) => type.value === orderType) &&
  Number(deliveryFee) > 0
