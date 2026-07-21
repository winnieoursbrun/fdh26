import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Sentry from '@sentry/react'
import { useFavorites } from './hooks/useFavorites'
import { useGroup } from './hooks/useGroup'
import { useInstallPrompt } from './hooks/useInstallPrompt'
import { useReminders } from './hooks/useReminders'
import { useRecapReminder } from './hooks/useRecapReminder'
import { useSecretTap } from './hooks/useSecretTap'
import { FaqTab } from './tabs/FaqTab'
import { MapTab } from './tabs/MapTab'
import { PrepTab } from './tabs/PrepTab'
import { ProgramTab } from './tabs/ProgramTab'
import { TimelineTab } from './tabs/TimelineTab'
import { RecapScreen } from './components/RecapScreen'
import { isRecapReady } from './lib/recap'
import eventsData from './data/events.json'
import type { FestEvent } from './types'

type Tab = 'map' | 'program' | 'timeline' | 'prep' | 'faq'

const TABS: { key: Tab; label: string }[] = [
  { key: 'map', label: 'Carte' },
  { key: 'program', label: 'Programme' },
  { key: 'timeline', label: 'Ma timeline' },
  { key: 'prep', label: 'Prépa' },
  { key: 'faq', label: 'FAQ' },
]

const events = eventsData as FestEvent[]

function TabIcon({ tab }: { tab: Tab }) {
  switch (tab) {
    case 'map':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Zm0 2.2 6 2v11.6l-6-2V6.2Z"
            fillRule="evenodd"
          />
        </svg>
      )
    case 'program':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 2v3M17 2v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <rect x="3.5" y="4.5" width="17" height="17" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M3.5 9.5h17" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="8.5" cy="14" r="1.4" />
          <circle cx="12" cy="14" r="1.4" />
          <circle cx="15.5" cy="14" r="1.4" />
        </svg>
      )
    case 'timeline':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.5c-5.5 0-9.5 4-9.8 8.7 0 .3.3.55.6.4 1-.5 2.4-.8 3.4-.1.4.3.9.3 1.3 0 1.2-.9 2.6-.9 3.8 0 .4.3.9.3 1.3 0 1.2-.9 2.6-.9 3.8 0 .4.3.9.3 1.3 0 1-.7 2.4-.4 3.4.1.3.15.6-.1.6-.4C21.5 6.5 17.5 2.5 12 2.5Z" />
          <path d="M12 12v6.5a1.6 1.6 0 0 1-3.2 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case 'prep':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="9" y="2.5" width="6" height="3" rx="1" />
          <rect
            x="5"
            y="4"
            width="14"
            height="17"
            rx="2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M8 11.2l2 2 4-4.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M8 16.5h8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    case 'faq':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
          <path
            d="M12 17v.01M9.5 9.5c0-1.4 1.1-2.5 2.5-2.5s2.5 1 2.5 2.3c0 1.2-.8 1.7-1.6 2.2-.7.4-1.4.9-1.4 1.9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
  }
}

function readJoinCode(): string | null {
  const match = /#join=([A-Za-z0-9-]+)/.exec(location.hash)
  return match ? match[1] : null
}

function tabFromHash(hash: string): Tab | null {
  const match = /^#\/(map|program|timeline|prep|faq)$/.exec(hash)
  return match ? (match[1] as Tab) : null
}

export default function App() {
  const [joinCode] = useState<string | null>(readJoinCode)
  const [tab, setTab] = useState<Tab>(
    () => (joinCode ? 'timeline' : tabFromHash(location.hash)) ?? 'program',
  )
  const initialTabRef = useRef(tab)
  const isFirstTabRender = useRef(true)
  const [iosHelpOpen, setIosHelpOpen] = useState(false)
  const [timelineScrollToken, setTimelineScrollToken] = useState(0)
  const { favorites, toggle } = useFavorites()
  const favoriteEvents = useMemo(
    () => events.filter((e) => favorites.has(e.id)),
    [favorites],
  )
  const reminders = useReminders(favoriteEvents)
  const groupApi = useGroup(favorites)
  const install = useInstallPrompt()
  const showInstall = install.canPrompt || install.needsIosHelp
  const [showRecap, setShowRecap] = useState(() => isRecapReady())
  useRecapReminder(reminders.status)
  const unlockRecap = useSecretTap(() => setShowRecap(true))

  // Chaque onglet a sa propre entrée d'historique : sur Android, le bouton
  // retour du système (PWA installée) revient à l'onglet précédent au lieu
  // de fermer l'application immédiatement.
  useEffect(() => {
    const initialTab = initialTabRef.current
    history.replaceState(
      { tab: initialTab },
      '',
      `${location.pathname}${location.search}#/${initialTab}`,
    )

    function onPopState(e: PopStateEvent) {
      const next = (e.state as { tab?: Tab } | null)?.tab ?? tabFromHash(location.hash) ?? 'program'
      setTab(next)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigateToTab = useCallback((next: Tab) => {
    setTab((current) => {
      if (next === current) {
        return current
      }
      history.pushState({ tab: next }, '', `#/${next}`)
      return next
    })
  }, [])

  useEffect(() => {
    if (isFirstTabRender.current) {
      isFirstTabRender.current = false
      return
    }
    Sentry.metrics.count('tab.view', 1, { attributes: { tab } })
  }, [tab])

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-text">
          <h1 className="wordmark" onClick={unlockRecap}>
            Fête <span className="wordmark-accent">de l'Humain</span>
          </h1>
          <p className="app-sub">11 – 13 septembre 2026 · Le Plessis-Pâté</p>
        </div>
        {showInstall && (
          <button
            type="button"
            className="install-btn"
            onClick={() => {
              if (install.canPrompt) {
                void install.promptInstall()
              } else {
                setIosHelpOpen(true)
              }
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 3v10m0 0 4-4m-4 4-4-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M4.5 16v3.5h15V16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Installer
          </button>
        )}
        {import.meta.env.DEV && (
          <button
            type="button"
            style={{ marginLeft: 8, opacity: 0.6 }}
            onClick={() => {
              Sentry.logger.info('User triggered test error', {
                action: 'test_error_button_click',
              })
              Sentry.metrics.count('test_counter', 1)
              throw new Error('This is your first error!')
            }}
          >
            Break the world (Sentry test)
          </button>
        )}
      </header>

      {showRecap && (
        <RecapScreen favoriteEvents={favoriteEvents} onClose={() => setShowRecap(false)} />
      )}

      {iosHelpOpen && (
        <div
          className="ios-sheet-backdrop"
          onClick={() => setIosHelpOpen(false)}
        >
          <div
            className="ios-sheet"
            role="dialog"
            aria-label="Installer l'application"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Installer l'app</h2>
            <ol>
              <li>
                Touche le bouton <strong>Partager</strong>
                <svg viewBox="0 0 24 24" aria-hidden="true" className="ios-share">
                  <path
                    d="M12 3v11m0-11-3.5 3.5M12 3l3.5 3.5M5.5 10H5a1.5 1.5 0 0 0-1.5 1.5v8A1.5 1.5 0 0 0 5 21h14a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 19 10h-.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </li>
              <li>
                Choisis <strong>« Sur l'écran d'accueil »</strong>
              </li>
            </ol>
            <button
              type="button"
              className="ios-sheet-close"
              onClick={() => setIosHelpOpen(false)}
            >
              Compris
            </button>
          </div>
        </div>
      )}

      <main className="app-main">
        {tab === 'map' && <MapTab />}
        {tab === 'program' && (
          <ProgramTab favorites={favorites} onToggleFavorite={toggle} groupApi={groupApi} />
        )}
        {tab === 'timeline' && (
          <TimelineTab
            favorites={favorites}
            onToggleFavorite={toggle}
            reminderStatus={reminders.status}
            onEnableReminders={reminders.enable}
            groupApi={groupApi}
            initialJoinCode={joinCode}
            scrollToken={timelineScrollToken}
          />
        )}
        {tab === 'prep' && <PrepTab />}
        {tab === 'faq' && (
          <FaqTab
            reminderStatus={reminders.status}
            onEnableReminders={reminders.enable}
            onDisableReminders={reminders.disable}
          />
        )}
      </main>

      <nav className="tabbar" aria-label="Navigation principale">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tabbar-btn${tab === t.key ? ' is-active' : ''}`}
            aria-current={tab === t.key ? 'page' : undefined}
            onClick={() => {
              navigateToTab(t.key)
              if (t.key === 'timeline') {
                setTimelineScrollToken((n) => n + 1)
              }
            }}
          >
            <TabIcon tab={t.key} />
            <span>{t.label}</span>
            {t.key === 'timeline' && favorites.size > 0 && (
              <span className="tabbar-badge">{favorites.size}</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}
