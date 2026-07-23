import { afterEach, describe, expect, it, vi } from 'vitest'
import { triggerHaptic } from './haptic'

afterEach(() => {
  vi.unstubAllGlobals()
  document.querySelectorAll('label[aria-hidden="true"]').forEach((el) => el.remove())
})

describe('triggerHaptic', () => {
  it('appelle navigator.vibrate avec le motif fourni quand il existe', () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { vibrate })

    triggerHaptic()
    expect(vibrate).toHaveBeenCalledWith(10)

    triggerHaptic([5, 5])
    expect(vibrate).toHaveBeenCalledWith([5, 5])
  })

  it('ne jette pas quand la Vibration API est absente', () => {
    vi.stubGlobal('navigator', {})
    expect(() => triggerHaptic()).not.toThrow()
  })

  it('avale une exception jetée par navigator.vibrate', () => {
    vi.stubGlobal('navigator', {
      vibrate: () => {
        throw new Error('hors geste utilisateur')
      },
    })
    expect(() => triggerHaptic()).not.toThrow()
  })

  it('injecte un switch caché et le clique pour le hack iOS', () => {
    const clicked: HTMLElement[] = []
    const originalClick = HTMLElement.prototype.click
    HTMLElement.prototype.click = function () {
      clicked.push(this)
    }
    try {
      triggerHaptic()
      const label = document.querySelector('label[aria-hidden="true"]')
      expect(label).not.toBeNull()
      expect(label?.querySelector('input[type="checkbox"][switch]')).not.toBeNull()
      expect(clicked).toContain(label)
    } finally {
      HTMLElement.prototype.click = originalClick
    }
  })

  it('réutilise le même switch entre deux appels', () => {
    triggerHaptic()
    triggerHaptic()
    expect(document.querySelectorAll('label[aria-hidden="true"]')).toHaveLength(1)
  })
})
