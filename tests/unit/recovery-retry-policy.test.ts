import assert from 'node:assert/strict'
import test from 'node:test'

import {
  dueRecoveryScheduleFilter,
  nextRecoveryAt,
  RECOVERY_INACTIVITY_MS,
} from '../../lib/recovery-retry-policy'

test('schedules a first recovery attempt after the inactivity window', () => {
  const now = Date.parse('2026-10-07T11:00:00.000Z')

  assert.equal(
    nextRecoveryAt(now),
    new Date(now + RECOVERY_INACTIVITY_MS).toISOString()
  )
})

test('selects due schedules while keeping legacy unscheduled carts eligible', () => {
  const now = Date.parse('2026-10-07T12:00:00.000Z')

  assert.equal(
    dueRecoveryScheduleFilter(now),
    'scheduled_message_at.is.null,scheduled_message_at.lte.2026-10-07T12:00:00.000Z'
  )
})
