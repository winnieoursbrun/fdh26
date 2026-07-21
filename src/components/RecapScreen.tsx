import { useEffect, useRef, useState } from 'react'
import { buildRecapSlides, computeRecapStats, type RecapSlide } from '../lib/recap'
import { DAY_LONG, formatRange } from '../lib/schedule'
import type { FestEvent } from '../types'

interface RecapScreenProps {
  favoriteEvents: FestEvent[]
  onClose: () => void
}

const SLIDE_THEMES = ['pink', 'yellow', 'sky', 'green', 'peri', 'violet', 'poppy']
const SWIPE_THRESHOLD_PX = 40

function SlideContent({ slide }: { slide: RecapSlide }) {
  switch (slide.kind) {
    case 'intro':
      return (
        <div className="recap-panel">
          <span className="recap-eyebrow">Les Pluies de Juillet 2026</span>
          <h2 className="recap-headline">
            Ton festival
            <br />
            en un coup d'œil
          </h2>
          <p className="recap-hint">Tape pour avancer →</p>
        </div>
      )
    case 'empty':
      return (
        <div className="recap-panel">
          <h2 className="recap-headline">Aucun favori cette année</h2>
          <p className="recap-body">
            Tu n'as mis aucun événement en favori cette année — à l'année prochaine !
          </p>
        </div>
      )
    case 'total':
      return (
        <div className="recap-panel">
          <span className="recap-eyebrow">Au total, tu as vu</span>
          <p className="recap-number">{slide.total}</p>
          <h2 className="recap-headline">événement{slide.total > 1 ? 's' : ''}</h2>
          <p className="recap-body">
            sur {slide.days} jour{slide.days > 1 ? 's' : ''} de festival
          </p>
        </div>
      )
    case 'venue':
      return (
        <div className="recap-panel">
          <span className="recap-eyebrow">Ton endroit préféré</span>
          <h2 className="recap-headline">{slide.venue}</h2>
          <p className="recap-body">
            {slide.count} événement{slide.count > 1 ? 's' : ''} vu{slide.count > 1 ? 's' : ''} ici
          </p>
        </div>
      )
    case 'category':
      return (
        <div className="recap-panel">
          <span className="recap-eyebrow">Tu es plutôt</span>
          <h2 className="recap-headline">{slide.label}</h2>
          <p className="recap-body">
            {slide.count} sur {slide.total} événements favoris
          </p>
        </div>
      )
    case 'first':
      return (
        <div className="recap-panel">
          <span className="recap-eyebrow">Ton premier coup de cœur</span>
          <h2 className="recap-headline">{slide.event.title}</h2>
          <p className="recap-body">
            {DAY_LONG[slide.event.day]} · {formatRange(slide.event)}
          </p>
        </div>
      )
    case 'last':
      return (
        <div className="recap-panel">
          <span className="recap-eyebrow">Ton dernier moment</span>
          <h2 className="recap-headline">{slide.event.title}</h2>
          <p className="recap-body">
            {DAY_LONG[slide.event.day]} · {formatRange(slide.event)}
          </p>
        </div>
      )
    case 'outro':
      return (
        <div className="recap-panel">
          <h2 className="recap-headline">À l'année prochaine !</h2>
          <ul className="recap-summary-list">
            <li>
              {slide.stats.total} événement{slide.stats.total > 1 ? 's' : ''}
            </li>
            <li>
              {slide.stats.daysAttended} jour{slide.stats.daysAttended > 1 ? 's' : ''}
            </li>
            {slide.stats.topVenue && <li>{slide.stats.topVenue.venue}</li>}
          </ul>
        </div>
      )
  }
}

export function RecapScreen({ favoriteEvents, onClose }: RecapScreenProps) {
  const stats = computeRecapStats(favoriteEvents)
  const slides = buildRecapSlides(stats)
  const [index, setIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)

  const isLast = index === slides.length - 1
  const goNext = () => setIndex((i) => Math.min(i + 1, slides.length - 1))
  const goPrev = () => setIndex((i) => Math.max(i - 1, 0))
  const advanceOrClose = () => (isLast ? onClose() : goNext())

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowRight') {
        advanceOrClose()
      } else if (e.key === 'ArrowLeft') {
        goPrev()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLast])

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) {
      return
    }
    const delta = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) {
      return
    }
    if (delta < 0) {
      advanceOrClose()
    } else {
      goPrev()
    }
  }

  const theme = SLIDE_THEMES[index % SLIDE_THEMES.length]

  return (
    <div
      className={`recap-backdrop recap-theme-${theme}`}
      role="dialog"
      aria-modal="true"
      aria-label="Récap de ton festival"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="recap-progress" aria-hidden="true">
        {slides.map((_, i) => (
          <span key={i} className={`recap-progress-seg${i <= index ? ' is-done' : ''}`} />
        ))}
      </div>

      <button type="button" className="recap-close" aria-label="Fermer le récap" onClick={onClose}>
        ✕
      </button>

      <div className="recap-slide" key={index}>
        <SlideContent slide={slides[index]} />
      </div>

      <button
        type="button"
        className="recap-tap-zone recap-tap-prev"
        aria-label="Écran précédent"
        onClick={goPrev}
        disabled={index === 0}
      />
      <button
        type="button"
        className="recap-tap-zone recap-tap-next"
        aria-label={isLast ? 'Fermer le récap' : 'Écran suivant'}
        onClick={isLast ? onClose : goNext}
      />
    </div>
  )
}
