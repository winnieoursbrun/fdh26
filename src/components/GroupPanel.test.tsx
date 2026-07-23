import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { GroupPanel } from './GroupPanel'

const triggerHaptic = vi.hoisted(() => vi.fn())
vi.mock('../lib/haptic', () => ({ triggerHaptic }))

function renderPanel(overrides: Partial<Parameters<typeof GroupPanel>[0]> = {}) {
  const props = {
    group: null,
    others: [],
    onCreate: vi.fn(() => 'AVERSE-42'),
    onJoin: vi.fn(),
    onLeave: vi.fn(),
    initialJoinCode: null,
    showFriends: true,
    onToggleShowFriends: vi.fn(),
    ...overrides,
  }
  render(<GroupPanel {...props} />)
  return props
}

describe('GroupPanel — création de groupe', () => {
  it('déclenche un retour haptique et crée le groupe au clic sur « Créer »', () => {
    triggerHaptic.mockClear()
    const { onCreate } = renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Créer un groupe' }))
    fireEvent.change(screen.getByPlaceholderText('Léa'), { target: { value: 'Léa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }))

    expect(triggerHaptic).toHaveBeenCalled()
    expect(onCreate).toHaveBeenCalledWith('Léa')
  })

  it('ne vibre pas si le pseudo est vide (bouton désactivé)', () => {
    triggerHaptic.mockClear()
    const { onCreate } = renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Créer un groupe' }))
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }))

    expect(triggerHaptic).not.toHaveBeenCalled()
    expect(onCreate).not.toHaveBeenCalled()
  })
})
