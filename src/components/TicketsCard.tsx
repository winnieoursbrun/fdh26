import { useRef, useState } from 'react'
import { renderSVG } from 'uqr'
import { decodeQrFromFile, useTickets } from '../hooks/useTickets'

export function TicketsCard() {
  const { tickets, add, rename, remove } = useTickets()
  const inputRef = useRef<HTMLInputElement>(null)
  const [decoding, setDecoding] = useState(false)
  const [decodeError, setDecodeError] = useState(false)
  const [pendingValue, setPendingValue] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [fullscreenId, setFullscreenId] = useState<string | null>(null)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) {
      return
    }
    setDecodeError(false)
    setDecoding(true)
    try {
      const value = await decodeQrFromFile(file)
      setPendingValue(value)
      setLabel(tickets.length === 0 ? 'Festival' : '')
    } catch {
      setDecodeError(true)
    } finally {
      setDecoding(false)
    }
  }

  function confirmAdd() {
    if (!pendingValue || !label.trim()) {
      return
    }
    add(label.trim(), pendingValue)
    setPendingValue(null)
    setLabel('')
  }

  const fullscreenTicket = tickets.find((t) => t.id === fullscreenId) ?? null

  return (
    <section className="group-panel tickets-card" aria-label="Mes billets">
      <h2 className="group-title">Mes billets</h2>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="ticket-input"
        onChange={(e) => void handleChange(e)}
      />

      {tickets.length === 0 && !pendingValue && (
        <p className="group-hint">
          Importe une photo de ton billet : le QR code est extrait et reste stocké
          uniquement sur ton téléphone (le reste de la photo n'est pas conservé). Utile
          pour l'entrée du festival ou du camping, même sans réseau. Un billet par photo
          — importe-en plusieurs si tu en as reçu plusieurs.
        </p>
      )}

      {tickets.length > 0 && (
        <ul className="tickets-list">
          {tickets.map((t) => (
            <li key={t.id} className="ticket-row">
              <button
                type="button"
                className="ticket-thumb"
                aria-label={`Afficher le billet ${t.label} en plein écran`}
                onClick={() => setFullscreenId(t.id)}
                dangerouslySetInnerHTML={{ __html: renderSVG(t.value, { border: 1 }) }}
              />
              <span className="ticket-label">{t.label}</span>
              <div className="ticket-actions">
                <button
                  type="button"
                  className="ticket-icon-btn"
                  aria-label={`Renommer le billet ${t.label}`}
                  onClick={() => {
                    const next = window.prompt('Nom du billet', t.label)
                    if (next && next.trim()) {
                      rename(t.id, next.trim())
                    }
                  }}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="ticket-icon-btn"
                  aria-label={`Supprimer le billet ${t.label}`}
                  onClick={() => {
                    if (window.confirm(`Supprimer le billet « ${t.label} » ?`)) {
                      remove(t.id)
                    }
                  }}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {decoding && <p className="group-hint">Lecture du QR code…</p>}

      {pendingValue && (
        <div className="ticket-naming">
          <p className="group-hint">QR code détecté ! Donne un nom à ce billet :</p>
          <input
            type="text"
            className="group-input"
            value={label}
            maxLength={24}
            placeholder="Festival, Camping…"
            autoFocus
            onChange={(e) => setLabel(e.target.value)}
          />
          <div className="group-actions">
            <button type="button" className="group-btn" disabled={!label.trim()} onClick={confirmAdd}>
              Ajouter
            </button>
            <button
              type="button"
              className="group-btn group-btn-ghost"
              onClick={() => {
                setPendingValue(null)
                setLabel('')
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {decodeError && (
        <p className="ticket-error">
          QR code introuvable sur cette photo. Recadre bien dessus (sans le code-barre)
          et réessaie.
        </p>
      )}

      {!pendingValue && (
        <div className="group-actions">
          <button type="button" className="group-btn" onClick={() => inputRef.current?.click()}>
            {tickets.length === 0 ? 'Importer un billet' : 'Ajouter un billet'}
          </button>
        </div>
      )}

      {fullscreenTicket && (
        <div
          className="ticket-backdrop"
          role="button"
          tabIndex={0}
          aria-label="Fermer l'affichage plein écran"
          onClick={() => setFullscreenId(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setFullscreenId(null)
            }
          }}
        >
          <p className="ticket-fullscreen-label">{fullscreenTicket.label}</p>
          <div
            className="ticket-fullscreen-qr"
            dangerouslySetInnerHTML={{ __html: renderSVG(fullscreenTicket.value, { border: 2 }) }}
          />
        </div>
      )}
    </section>
  )
}
