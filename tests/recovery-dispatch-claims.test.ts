import assert from 'node:assert/strict'
import test from 'node:test'
import {
  messageProcessingClaimStaleBefore,
  staleMessageProcessingClaimFilter,
} from '../lib/message-processing-claim'

test('message claims use a 15-minute stale cutoff', () => {
  assert.equal(
    messageProcessingClaimStaleBefore(Date.parse('2026-10-03T12:00:00.000Z')),
    '2026-10-03T11:45:00.000Z'
  )
})

test('stale claim filter preserves active and recent legacy queued rows', () => {
  const cutoff = '2026-10-03T11:45:00.000Z'

  assert.equal(
    staleMessageProcessingClaimFilter(cutoff),
    [
      `processing_started_at.lt.${cutoff}`,
      `and(processing_started_at.is.null,created_at.lt.${cutoff})`,
    ].join(',')
  )
})
