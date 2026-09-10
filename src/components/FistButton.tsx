import { triggerHaptic } from '../lib/haptic'

/**
 * Raised-fist glyph, from Font Awesome Free 6.7.2 ("hand-fist", formerly
 * "fist-raised"): https://fontawesome.com/icons/hand-fist
 * Copyright 2024 Fonticons, Inc. — icon artwork licensed under CC BY 4.0
 * (https://creativecommons.org/licenses/by/4.0/). See CREDITS.md at the repo
 * root for the attribution notice.
 * The path is inlined instead of pulling @fortawesome/fontawesome-free as a
 * runtime dependency: the PWA must stay fully offline and light.
 * Native viewBox is "0 0 448 512" — keep it, the path is not normalised.
 */
export const FIST_VIEWBOX = '0 0 448 512'
export const FIST_PATH =
  'M192 0c17.7 0 32 14.3 32 32l0 112-64 0 0-112c0-17.7 14.3-32 32-32zM64 64c0-17.7 14.3-32 32-32s32 14.3 32 32l0 80-64 0 0-80zm192 0c0-17.7 14.3-32 32-32s32 14.3 32 32l0 96c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-96zm96 64c0-17.7 14.3-32 32-32s32 14.3 32 32l0 64c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-64zm-96 88l0-.6c9.4 5.4 20.3 8.6 32 8.6c13.2 0 25.4-4 35.6-10.8c8.7 24.9 32.5 42.8 60.4 42.8c11.7 0 22.6-3.1 32-8.6l0 8.6c0 52.3-25.1 98.8-64 128l0 96c0 17.7-14.3 32-32 32l-160 0c-17.7 0-32-14.3-32-32l0-78.4c-17.3-7.9-33.2-18.8-46.9-32.5L69.5 357.5C45.5 333.5 32 300.9 32 267l0-27c0-35.3 28.7-64 64-64l88 0c22.1 0 40 17.9 40 40s-17.9 40-40 40l-56 0c-8.8 0-16 7.2-16 16s7.2 16 16 16l56 0c39.8 0 72-32.2 72-72z'

interface FistButtonProps {
  active: boolean
  title: string
  onToggle: () => void
}

// App signature: the favourite toggle is a fist that gets raised, a nod to the
// gesture of solidarity of the Fête de l'Humanité. Both states share the same
// silhouette so the gesture stays readable at icon size; only the colour and
// the height of the fist change (held low and muted / punched up and solid).
export function FistButton({ active, title, onToggle }: FistButtonProps) {
  return (
    <button
      type="button"
      className={`fist-btn${active ? ' is-raised' : ''}`}
      aria-pressed={active}
      aria-label={
        active
          ? `Retirer « ${title} » de ma timeline`
          : `Ajouter « ${title} » à ma timeline`
      }
      onClick={() => {
        triggerHaptic()
        onToggle()
      }}
    >
      <svg viewBox={FIST_VIEWBOX} aria-hidden="true" focusable="false">
        <path className="fist-glyph" d={FIST_PATH} />
      </svg>
    </button>
  )
}
