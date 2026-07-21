import type { FriendPresence } from '../hooks/useGroup'

function PinIcon({ label }: { label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
    </svg>
  )
}

/** Pastilles des copains sur un événement ; celles avec `here` signalent qu'ils y sont en ce moment. */
export function FriendChips({ friends }: { friends: FriendPresence[] }) {
  // Les copains présents d'abord : c'est l'info la plus utile sur le moment.
  const sorted = [...friends].sort((a, b) => Number(b.here) - Number(a.here))
  return (
    <span className="friend-chips">
      {sorted.map((f) => (
        <span
          key={f.name}
          className={`friend-chip${f.here ? ' friend-chip-here' : ''}`}
          title={f.here ? `${f.name} y est en ce moment` : undefined}
        >
          {f.here && <PinIcon label="y est en ce moment" />}
          {f.name}
        </span>
      ))}
    </span>
  )
}

/** Bouton « J'y suis » sur un événement en cours, visible quand on est dans un groupe. */
export function PresenceButton({
  here,
  eventTitle,
  onToggle,
}: {
  here: boolean
  eventTitle: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={`presence-btn${here ? ' is-here' : ''}`}
      aria-pressed={here}
      aria-label={
        here
          ? `Ne plus signaler ma présence à « ${eventTitle} »`
          : `Dire à mon groupe que je suis à « ${eventTitle} »`
      }
      onClick={onToggle}
    >
      <PinIcon />
      {here ? 'Tu y es' : "J'y suis"}
    </button>
  )
}
