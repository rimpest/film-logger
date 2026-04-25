import { describe, it, expect } from 'vitest'
import { generateRecoveryCode } from '../../server/utils/passwords'

describe('generateRecoveryCode', () => {
  it('produces a 17-character grouped string (5-5-5 with two dashes)', () => {
    const code = generateRecoveryCode()
    expect(code).toHaveLength(17)
    expect(code[5]).toBe('-')
    expect(code[11]).toBe('-')
  })

  it('uses only the unambiguous Crockford-ish alphabet', () => {
    const codes = Array.from({ length: 50 }, () => generateRecoveryCode())
    const allowed = /^[A-HJ-NP-Z2-9-]+$/
    for (const c of codes) {
      expect(c).toMatch(allowed)
    }
  })

  it('produces highly unique codes (50 calls, no collisions)', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateRecoveryCode()))
    expect(codes.size).toBe(50)
  })
})
