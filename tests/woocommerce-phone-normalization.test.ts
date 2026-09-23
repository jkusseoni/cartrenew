import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import vm from 'node:vm'

type NormalizePhone = (raw: string, countryCallingCode: string) => string

function loadNormalizePhone(): NormalizePhone {
  const source = readFileSync(
    join(process.cwd(), 'cartrenew-svn/trunk/assets/consent.js'),
    'utf8'
  )
  const sandbox: {
    jQuery: (callback: unknown) => void
    cartrenewNormalizePhone?: NormalizePhone
  } = {
    jQuery: () => undefined,
  }

  vm.runInNewContext(source, sandbox)
  assert.ok(sandbox.cartrenewNormalizePhone)
  return sandbox.cartrenewNormalizePhone
}

test('local WooCommerce phone numbers use the store calling code', () => {
  const normalizePhone = loadNormalizePhone()

  assert.equal(normalizePhone('(415) 555-2671', '+1'), '14155552671')
  assert.equal(normalizePhone('07123 456789', '+44'), '447123456789')
  assert.equal(normalizePhone('98765 43210', '+91'), '919876543210')
})

test('explicit international phone numbers are preserved', () => {
  const normalizePhone = loadNormalizePhone()

  assert.equal(normalizePhone('+61 412 345 678', '+44'), '61412345678')
  assert.equal(normalizePhone('0049 151 23456789', '+44'), '4915123456789')
})

test('missing store country metadata does not invent a calling code', () => {
  const normalizePhone = loadNormalizePhone()

  assert.equal(normalizePhone('415-555-2671', ''), '4155552671')
})

test('the consent form supplies the WooCommerce store calling code', () => {
  const source = readFileSync(
    join(
      process.cwd(),
      'cartrenew-svn/trunk/includes/class-cr-consent.php'
    ),
    'utf8'
  )

  assert.match(source, /get_base_country\(\)/)
  assert.match(source, /get_country_calling_code\( \$base_country \)/)
  assert.match(source, /'country_calling_code' => \$calling_code/)
})
