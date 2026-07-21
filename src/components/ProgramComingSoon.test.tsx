import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgramComingSoon } from './ProgramComingSoon'
import lineupData from '../data/lineup.json'
import newsData from '../data/news.json'

describe('ProgramComingSoon', () => {
  it('affiche le message d’attente de la grille horaire', () => {
    render(<ProgramComingSoon />)
    expect(
      screen.getByText(/grille horaire complète n'est pas encore publiée/),
    ).toBeInTheDocument()
  })

  it('liste tous les artistes du line-up, groupés par vague', () => {
    render(<ProgramComingSoon />)
    for (const artist of lineupData) {
      expect(screen.getByText(artist.name)).toBeInTheDocument()
    }
  })

  it('affiche toutes les actualités', () => {
    render(<ProgramComingSoon />)
    for (const item of newsData) {
      expect(screen.getByText(item.title)).toBeInTheDocument()
    }
  })
})
