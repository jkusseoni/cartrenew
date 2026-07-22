type RecoveryCartState = {
  id: string
  status: string
} | null

export function shouldDispatchImmediateRecovery({
  cart,
  created,
  customerPhone,
  previousPhone,
  checkoutUrl,
}: {
  cart: RecoveryCartState
  created: boolean
  customerPhone: string | null
  previousPhone: string | null
  checkoutUrl: string | null
}): boolean {
  const hasSendTarget = Boolean(customerPhone && (checkoutUrl || cart?.id))
  const phoneJustArrived = Boolean(customerPhone && !previousPhone)

  return (
    hasSendTarget &&
    (!cart || cart.status === 'pending') &&
    (created || phoneJustArrived)
  )
}
