import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  setUser: vi.fn(),
  metrics: { count: vi.fn() },
  browserTracingIntegration: vi.fn(() => ({})),
  replayIntegration: vi.fn(() => ({})),
  consoleLoggingIntegration: vi.fn(() => ({})),
}))

import * as Sentry from '@sentry/react'
import { getDeviceId, getDisplayMode, initSentry } from './sentry'

describe('getDeviceId', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('génère un id et le persiste dans localStorage', () => {
    const id = getDeviceId()
    expect(id).toBeTruthy()
    expect(localStorage.getItem('fdh26-device-id')).toBe(id)
  })

  it('renvoie le même id à chaque appel', () => {
    expect(getDeviceId()).toBe(getDeviceId())
  })

  it('réutilise un id existant', () => {
    localStorage.setItem('fdh26-device-id', 'deja-la')
    expect(getDeviceId()).toBe('deja-la')
  })
})

describe('getDisplayMode', () => {
  it('retombe sur browser quand matchMedia est indisponible (jsdom)', () => {
    expect(getDisplayMode()).toBe('browser')
  })
})

describe('initSentry', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it("attache l'id anonyme de l'appareil comme utilisateur Sentry", () => {
    initSentry()
    expect(Sentry.setUser).toHaveBeenCalledWith({ id: getDeviceId() })
  })

  it("compte une ouverture d'app avec le mode d'affichage", () => {
    initSentry()
    expect(Sentry.metrics.count).toHaveBeenCalledWith('app.open', 1, {
      attributes: { display_mode: 'browser' },
    })
  })
})
