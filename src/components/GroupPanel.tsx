import { useEffect, useState } from 'react'
import { renderSVG } from 'uqr'
import type { MemberState } from '../lib/group'

interface GroupPanelProps {
  group: { code: string; name: string } | null
  others: MemberState[]
  onCreate: (name: string) => string
  onJoin: (code: string, name: string) => void
  onLeave: () => void
  initialJoinCode: string | null
  showFriends: boolean
  onToggleShowFriends: () => void
}

export function GroupPanel({
  group,
  others,
  onCreate,
  onJoin,
  onLeave,
  initialJoinCode,
  showFriends,
  onToggleShowFriends,
}: GroupPanelProps) {
  const [mode, setMode] = useState<'idle' | 'create' | 'join'>(
    initialJoinCode ? 'join' : 'idle',
  )
  const [name, setName] = useState('')
  const [code, setCode] = useState(initialJoinCode ?? '')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (initialJoinCode) {
      setMode('join')
      setCode(initialJoinCode)
    }
  }, [initialJoinCode])

  if (!group) {
    if (mode === 'idle') {
      return (
        <section className="group-panel" aria-label="Groupe de copains">
          <h2 className="group-title">Entre copains</h2>
          <p className="group-hint">
            Crée un groupe pour voir qui va à quoi et vous retrouver aux mêmes
            concerts. Ça se synchronise tout seul dès qu'il y a du réseau.
          </p>
          <div className="group-actions">
            <button type="button" className="group-btn" onClick={() => setMode('create')}>
              Créer un groupe
            </button>
            <button
              type="button"
              className="group-btn group-btn-ghost"
              onClick={() => setMode('join')}
            >
              J'ai un code
            </button>
          </div>
        </section>
      )
    }

    const canSubmit = name.trim().length > 0 && (mode === 'create' || code.trim().length > 0)

    return (
      <section className="group-panel" aria-label="Groupe de copains">
        <h2 className="group-title">
          {mode === 'create' ? 'Créer un groupe' : 'Rejoindre un groupe'}
        </h2>
        <form
          className="group-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!canSubmit) {
              return
            }
            if (mode === 'create') {
              onCreate(name.trim())
              setInviteOpen(true)
            } else {
              onJoin(code, name.trim())
            }
          }}
        >
          <label className="group-label">
            Ton pseudo
            <input
              type="text"
              className="group-input"
              value={name}
              maxLength={20}
              placeholder="Léa"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {mode === 'join' && (
            <label className="group-label">
              Code du groupe
              <input
                type="text"
                className="group-input group-input-code"
                value={code}
                placeholder="AVERSE-42"
                autoCapitalize="characters"
                autoCorrect="off"
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
          )}
          <div className="group-actions">
            <button type="submit" className="group-btn" disabled={!canSubmit}>
              {mode === 'create' ? 'Créer' : 'Rejoindre'}
            </button>
            <button
              type="button"
              className="group-btn group-btn-ghost"
              onClick={() => setMode('idle')}
            >
              Annuler
            </button>
          </div>
        </form>
      </section>
    )
  }

  const link = `${location.origin}${import.meta.env.BASE_URL}#join=${group.code}`

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Rejoins notre groupe FDH26',
          text: `Rejoins notre groupe sur l'appli de la Fête de l'Humain avec le code ${group?.code}`,
          url: link,
        })
        return
      } catch {
        // partage annulé → on retombe sur la copie
      }
    }
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard indisponible : le code reste affiché, dictable à voix haute
    }
  }

  return (
    <section className="group-panel" aria-label="Groupe de copains">
      <div className="group-head">
        <h2 className="group-title">Entre copains</h2>
        <span className="group-code" aria-label="Code du groupe">
          {group.code}
        </span>
      </div>
      <p className="group-members">
        {[`${group.name} (toi)`, ...others.map((m) => m.name)].join(' · ')}
        {others.length === 0 && ' — invite tes copains !'}
      </p>
      <div className="group-actions">
        <button
          type="button"
          className="group-btn"
          aria-expanded={inviteOpen}
          onClick={() => setInviteOpen((v) => !v)}
        >
          {inviteOpen ? "Fermer l'invitation" : 'Inviter'}
        </button>
        <button
          type="button"
          className="group-btn group-btn-ghost"
          onClick={() => {
            if (window.confirm('Quitter le groupe ? Tes copains ne verront plus tes favoris.')) {
              onLeave()
            }
          }}
        >
          Quitter
        </button>
      </div>
      {inviteOpen && (
        <div className="group-invite">
          <div
            className="group-qr"
            role="img"
            aria-label={`QR code d'invitation au groupe ${group.code}`}
            dangerouslySetInnerHTML={{ __html: renderSVG(link, { border: 2 }) }}
          />
          <p className="group-hint">
            Fais scanner ce QR, partage le lien, ou dicte le code{' '}
            <strong>{group.code}</strong>.
          </p>
          <button type="button" className="group-btn" onClick={() => void share()}>
            {copied ? 'Lien copié !' : 'Partager le lien'}
          </button>
        </div>
      )}
      <div className="group-toggle">
        <span>Voir les favoris de mes amis dans ma timeline</span>
        <button
          type="button"
          role="switch"
          aria-checked={showFriends}
          aria-label="Afficher les favoris de mes amis dans ma timeline"
          className={`toggle-switch${showFriends ? ' is-on' : ''}`}
          onClick={onToggleShowFriends}
        >
          <span className="toggle-switch-knob" />
        </button>
      </div>
    </section>
  )
}
