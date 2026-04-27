import { describe, expect, it } from 'vitest'
import { F_STOPS, visibleFStops } from '../../shared/apertures'

describe('apertures', () => {
  it('hides uncommon stops by default', () => {
    const labels = visibleFStops().map(s => s.label)
    expect(labels).not.toContain('6.3')
    expect(labels).not.toContain('7.1')
    expect(labels).not.toContain('0.95')
    // Common stops are present
    expect(labels).toEqual(expect.arrayContaining(['1.4', '2.8', '5.6', '8', '11', '16', '22']))
  })

  it('reveals uncommon stops when asked', () => {
    const labels = visibleFStops({ showUncommon: true }).map(s => s.label)
    expect(labels).toContain('6.3')
    expect(labels).toContain('7.1')
    expect(labels).toContain('0.95')
  })

  it('clips wider stops the lens cannot open to', () => {
    // f/2.8 lens shouldn't show 1.4, 1.8, 2.
    const labels = visibleFStops({ maxAperture: 2.8 }).map(s => s.label)
    expect(labels).not.toContain('1.4')
    expect(labels).not.toContain('1.8')
    expect(labels).not.toContain('2')
    expect(labels[0]).toBe('2.8')
  })

  it('always exposes the lens’s exact max aperture even when uncommon', () => {
    // Noctilux f/0.95 — uncommon, but its owner needs the button.
    const labels = visibleFStops({ maxAperture: 0.95 }).map(s => s.label)
    expect(labels).toContain('0.95')
    // f/1, 1.1, 1.2 stay hidden because they aren't the lens's max and aren't common.
    expect(labels).not.toContain('1')
    expect(labels).not.toContain('1.1')
    expect(labels).not.toContain('1.2')
  })

  it('clips narrower stops past the lens’s minimum', () => {
    // Lens that only stops down to f/16 — f/22 button should disappear.
    const labels = visibleFStops({ minAperture: 16 }).map(s => s.label)
    expect(labels).toContain('16')
    expect(labels).not.toContain('22')
  })

  it('keeps stops sorted ascending', () => {
    const values = F_STOPS.map(s => s.value)
    const sorted = [...values].sort((a, b) => a - b)
    expect(values).toEqual(sorted)
  })
})
