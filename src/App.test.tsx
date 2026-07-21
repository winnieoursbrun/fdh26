import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import App from './App'

vi.mock('@sentry/react', () => ({
  metrics: { count: vi.fn(), gauge: vi.fn() },
  logger: { info: vi.fn() },
}))

vi.mock('./lib/nostr', () => ({
  generateSecretKey: () => new Uint8Array(32).fill(7),
  getPublicKey: () => 'my-pubkey',
  skToHex: (sk: Uint8Array) => [...sk].map((b) => b.toString(16).padStart(2, '0')).join(''),
  skFromHex: () => new Uint8Array(32).fill(7),
  publishState: vi.fn(() => Promise.resolve()),
  subscribeGroup: vi.fn(() => () => {}),
}))

vi.mock('./hooks/useWeather', () => ({
  useWeather: () => ({ status: 'ok', days: [] }),
}))

vi.mock('react-zoom-pan-pinch', () => ({
  TransformWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TransformComponent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

function tabButton(label: string) {
  return within(screen.getByRole('navigation', { name: 'Navigation principale' })).getByRole(
    'button',
    { name: new RegExp(label) },
  )
}

describe('App — onglets et historique', () => {
  beforeEach(() => {
    localStorage.clear()
    history.replaceState(null, '', '/')
  })

  it('ouvre sur le Programme par défaut', () => {
    render(<App />)
    expect(tabButton('Programme')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('region', { name: 'Programme' })).toBeInTheDocument()
  })

  it('restaure l’onglet depuis le hash initial', () => {
    history.replaceState(null, '', '/#/faq')
    render(<App />)
    expect(tabButton('FAQ')).toHaveAttribute('aria-current', 'page')
  })

  it('retombe sur le Programme pour un hash inconnu', () => {
    history.replaceState(null, '', '/#/inconnu')
    render(<App />)
    expect(tabButton('Programme')).toHaveAttribute('aria-current', 'page')
  })

  it('change d’onglet au clic et pousse le hash dans l’historique', () => {
    render(<App />)
    fireEvent.click(tabButton('Carte'))
    expect(screen.getByRole('region', { name: 'Carte du site' })).toBeInTheDocument()
    expect(location.hash).toBe('#/map')
  })

  it('revient à l’onglet précédent sur popstate (bouton retour Android)', () => {
    render(<App />)
    fireEvent.click(tabButton('Prépa'))
    expect(tabButton('Prépa')).toHaveAttribute('aria-current', 'page')

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { tab: 'program' } }))
    })
    expect(tabButton('Programme')).toHaveAttribute('aria-current', 'page')
  })

  it('force l’onglet timeline quand l’URL contient un code d’invitation', () => {
    history.replaceState(null, '', '/#join=PLUIE-42')
    render(<App />)
    expect(tabButton('Ma timeline')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('region', { name: 'Ma timeline' })).toBeInTheDocument()
  })
})

describe('App — badge favoris et auto-scroll de la timeline', () => {
  beforeEach(() => {
    localStorage.clear()
    history.replaceState(null, '', '/')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('affiche le nombre de favoris en badge sur « Ma timeline »', () => {
    localStorage.setItem(
      'pdj26-favorites',
      JSON.stringify(['larzac-ven-1700', 'miossec-ven-2135']),
    )
    render(<App />)
    expect(within(tabButton('Ma timeline')).getByText('2')).toHaveClass('tabbar-badge')
  })

  it('n’affiche pas de badge sans favoris', () => {
    render(<App />)
    expect(within(tabButton('Ma timeline')).queryByText(/^\d+$/)).not.toBeInTheDocument()
  })

  it('redéclenche l’auto-scroll à chaque clic sur « Ma timeline », même déjà actif', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 17, 18, 0))
    localStorage.setItem('pdj26-favorites', JSON.stringify(['larzac-ven-1700']))
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView')

    render(<App />)
    fireEvent.click(tabButton('Ma timeline'))
    expect(spy).toHaveBeenCalledTimes(1)

    fireEvent.click(tabButton('Ma timeline'))
    expect(spy).toHaveBeenCalledTimes(2)
  })
})

describe('App — installation PWA', () => {
  beforeEach(() => {
    localStorage.clear()
    history.replaceState(null, '', '/')
  })

  it('n’affiche pas le bouton Installer sans beforeinstallprompt', () => {
    render(<App />)
    expect(screen.queryByRole('button', { name: /Installer/ })).not.toBeInTheDocument()
  })

  it('affiche le bouton Installer après un beforeinstallprompt', () => {
    render(<App />)
    act(() => {
      window.dispatchEvent(
        Object.assign(new Event('beforeinstallprompt'), {
          prompt: vi.fn(() => Promise.resolve()),
          userChoice: Promise.resolve({ outcome: 'accepted' as const }),
        }),
      )
    })
    expect(screen.getByRole('button', { name: /Installer/ })).toBeInTheDocument()
  })
})
