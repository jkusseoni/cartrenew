export const MESSAGE_PROCESSING_CLAIM_STALE_MS = 15 * 60 * 1000

export function messageProcessingClaimStaleBefore(nowMs = Date.now()) {
  return new Date(nowMs - MESSAGE_PROCESSING_CLAIM_STALE_MS).toISOString()
}

/**
 * A timestamped claim is stale by its processing time. Legacy rows have no
 * processing timestamp, so they are reclaimable only after their creation time
 * is older than the same timeout.
 */
export function staleMessageProcessingClaimFilter(staleBefore: string) {
  return [
    `processing_started_at.lt.${staleBefore}`,
    `and(processing_started_at.is.null,created_at.lt.${staleBefore})`,
  ].join(',')
}
