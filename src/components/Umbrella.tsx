interface UmbrellaButtonProps {
  active: boolean
  title: string
  onToggle: () => void
}

// Signature de l'app : le favori est un parapluie qui s'ouvre,
// clin d'œil au nom du festival et à sa grande scène « Le Parapluie ».
export function UmbrellaButton({ active, title, onToggle }: UmbrellaButtonProps) {
  return (
    <button
      type="button"
      className={`umbrella${active ? ' is-open' : ''}`}
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
              className="canopy"
              d="M12 2.5c-5.5 0-9.5 4-9.8 8.7 0 .3.3.55.6.4 1-.5 2.4-.8 3.4-.1.4.3.9.3 1.3 0 1.2-.9 2.6-.9 3.8 0 .4.3.9.3 1.3 0 1.2-.9 2.6-.9 3.8 0 .4.3.9.3 1.3 0 1-.7 2.4-.4 3.4.1.3.15.6-.1.6-.4C21.5 6.5 17.5 2.5 12 2.5Z"
            />
            <path
              className="stem"
              d="M12 12v6.5a1.6 1.6 0 0 1-3.2 0"
              fill="none"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </g>
        ) : (
          <g>
            <path className="canopy" d="M12 2.5 14.4 13h-4.8L12 2.5Z" />
            <path
              className="stem"
              d="M12 13v5.5a1.6 1.6 0 0 1-3.2 0"
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
