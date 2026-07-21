import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ReminderBanner } from './ReminderBanner'
import type { ReminderStatus } from '../hooks/useReminders'

function renderBanner(status: ReminderStatus = 'default', favoritesCount = 1) {
  const enable = vi.fn()
  render(<ReminderBanner status={status} enable={enable} favoritesCount={favoritesCount} />)
  return { enable }
}

const BANNER_TEXT = /Envie d'un rappel 15 min avant/

describe('ReminderBanner', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('s’affiche pour un premier favori quand la permission n’est pas encore demandée', () => {
    renderBanner('default', 1)
    expect(screen.getByText(BANNER_TEXT)).toBeInTheDocument()
  })

  it('ne s’affiche pas sans favori ni pour un autre statut de permission', () => {
    renderBanner('default', 0)
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument()

    for (const status of ['enabled', 'disabled', 'denied', 'unsupported'] as const) {
      renderBanner(status, 3)
      expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument()
    }
  })

  it('ne se réaffiche plus une fois l’incitation vue', () => {
    localStorage.setItem('pdj26-reminders-prompted', 'true')
    renderBanner('default', 3)
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument()
  })

  it('active les rappels puis se ferme définitivement', () => {
    const { enable } = renderBanner()
    fireEvent.click(screen.getByRole('button', { name: 'Activer les rappels' }))

    expect(enable).toHaveBeenCalledOnce()
    expect(localStorage.getItem('pdj26-reminders-prompted')).toBe('true')
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument()
  })

  it('se ferme sans activer via la croix', () => {
    const { enable } = renderBanner()
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(enable).not.toHaveBeenCalled()
    expect(localStorage.getItem('pdj26-reminders-prompted')).toBe('true')
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument()
  })
})
