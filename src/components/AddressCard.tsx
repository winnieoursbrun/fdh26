import { ADDRESS, MAPS_HREF } from '../lib/address'

export function AddressCard() {
  return (
    <a className="address-card" href={MAPS_HREF}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="address-pin">
        <path
          d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="9" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
      <span className="address-text">{ADDRESS}</span>
      <span className="address-cta">Itinéraire</span>
    </a>
  )
}
