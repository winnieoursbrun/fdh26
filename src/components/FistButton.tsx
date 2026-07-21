interface FistButtonProps {
  active: boolean
  title: string
  onToggle: () => void
}

// Signature de l'app : le favori est un poing qui se lève, clin d'œil au
// geste de solidarité de la Fête de l'Humanité.
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
      onClick={onToggle}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {active ? (
          <g>
            <path
              className="fist-head"
              d="M12 3a5 5 0 0 1 5 5 5 5 0 0 1-1.2 3.3c1.4.3 2.4 1.6 2.4 3.1a3.2 3.2 0 0 1-3.2 3.2h-1.6a5 5 0 0 1-5-5V8a5 5 0 0 1 3.6-4.8Z"
            />
            <path
              className="fist-arm"
              d="M12 17.5v3.5"
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        ) : (
          <g>
            <path
              className="fist-head"
              d="M12 8.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8Z"
              fill="none"
              strokeWidth="1.6"
            />
            <path
              className="fist-arm"
              d="M12 15.4V21"
              fill="none"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </g>
        )}
      </svg>
    </button>
  )
}
