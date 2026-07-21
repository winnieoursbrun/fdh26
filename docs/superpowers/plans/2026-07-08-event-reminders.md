# Rappels de notification pour la timeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter des rappels de notification locaux (sans backend) 15 minutes avant chaque événement favori de la timeline, avec une bannière d'incitation au premier favori et un interrupteur persistant dans la FAQ.

**Architecture:** Un nouveau hook `useReminders(favoriteEvents)` gère la permission navigateur, l'état activé/désactivé (localStorage) et la programmation de `setTimeout` par événement. Deux nouveaux composants (`ReminderBanner`, `ReminderToggle`) consomment ce hook et sont câblés respectivement dans `TimelineTab` et `FaqTab` via des props passées depuis `App.tsx`. Une nouvelle fonction `eventStartDate()` dans `schedule.ts` convertit un `FestEvent` en vraie date calendaire 2026.

**Tech Stack:** React 19 + TypeScript, `Notification` Web API, `localStorage`, Vitest + `@testing-library/react` pour les tests (nouvelle infra de test, absente du projet à ce jour).

Spec source : `docs/superpowers/specs/2026-07-08-event-reminders-design.md`

## Global Constraints

- Délai de rappel fixe : 15 minutes avant `eventStartDate(event)` — pas de réglage utilisateur dans cette version.
- Aucun serveur : tout est local (`setTimeout` + `Notification`), cohérent avec l'absence de backend du projet.
- Clés `localStorage` exactes (préfixe `pdj26-`, comme `pdj26-favorites` existant) : `pdj26-reminders-enabled`, `pdj26-reminders-prompted`, `pdj26-reminders-notified`.
- Festival 2026 : jours `ven`=17, `sam`=18, `dim`=19 juillet ; une heure de début `< 05:00` bascule sur le jour calendaire suivant (même règle que `timeMinutes()` dans `src/lib/schedule.ts`).
- UI en français, cohérente avec les tokens CSS existants (`--pink`, `--yellow`, `--sticker`, `--sticker-sm`, police `--display`).
- `Notification` non supporté → statut `unsupported`, aucun appel à l'API. Permission refusée → statut `denied`, jamais de nouvelle demande automatique.
- Nouvelles dépendances (`vitest`, `jsdom`, `@testing-library/react`) en `devDependencies` uniquement — aucune dépendance de production ajoutée.

---

## Task 1: Mettre en place l'infrastructure de test Vitest

Le projet n'a aucun framework de test à ce jour. Cette tâche pose l'infra nécessaire pour le TDD des tâches suivantes.

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.node.json`
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: commande `npm run test` exécutant Vitest en mode `run` (CI-friendly, pas de watch).

- [ ] **Step 1: Installer les dépendances de test**

Run: `npm install --save-dev vitest jsdom @testing-library/react`

Expected: la commande se termine sans erreur ; `package.json` a maintenant `vitest`, `jsdom` et `@testing-library/react` dans `devDependencies`.

- [ ] **Step 2: Créer la config Vitest**

Create `vitest.config.ts` :

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
  },
})
```

- [ ] **Step 3: Inclure `vitest.config.ts` dans le projet TypeScript "node"**

Modify `tsconfig.node.json` — remplacer la ligne `"include": ["vite.config.ts"]` par :

```json
  "include": ["vite.config.ts", "vitest.config.ts"]
```

- [ ] **Step 4: Ajouter le script npm**

Modify `package.json`, dans `"scripts"`, ajouter après `"lint": "oxlint"` :

```json
    "test": "vitest run",
```

- [ ] **Step 5: Vérifier que l'infra tourne**

Run: `npx vitest run --passWithNoTests`

Expected: sortie du type `No test files found, exiting with code 0`, code de sortie `0` (aucune erreur de configuration).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.node.json vitest.config.ts
git commit -m "chore: add Vitest test infrastructure"
```

---

## Task 2: Ajouter `eventStartDate()` dans `schedule.ts`

**Files:**
- Modify: `src/lib/schedule.ts`
- Test: `src/lib/schedule.test.ts`

**Interfaces:**
- Consumes: `FestEvent` (`src/types.ts`), `DAYS` (déjà exporté par `schedule.ts`).
- Produces: `eventStartDate(e: FestEvent): Date` — utilisé par `useReminders` (Task 4).

- [ ] **Step 1: Écrire le test qui échoue**

Create `src/lib/schedule.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { eventStartDate } from './schedule'
import type { FestEvent } from '../types'

function makeEvent(overrides: Partial<FestEvent>): FestEvent {
  return {
    id: 'test-event',
    title: 'Test',
    artist: null,
    day: 'sam',
    start: '21:00',
    end: '22:00',
    venue: 'Scène test',
    category: 'concert',
    subtype: null,
    description: null,
    ...overrides,
  }
}

describe('eventStartDate', () => {
  it('retourne la date calendaire du jour de grille pour un créneau normal', () => {
    const event = makeEvent({ day: 'sam', start: '21:00' })
    const result = eventStartDate(event)

    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(6) // juillet = index 6
    expect(result.getDate()).toBe(18)
    expect(result.getHours()).toBe(21)
    expect(result.getMinutes()).toBe(0)
  })

  it('bascule sur le jour calendaire suivant pour un créneau après minuit', () => {
    const event = makeEvent({ day: 'ven', start: '00:40' })
    const result = eventStartDate(event)

    expect(result.getDate()).toBe(18) // nuit de vendredi 17 -> samedi 18
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(40)
  })
})
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

Run: `npx vitest run src/lib/schedule.test.ts`

Expected: FAIL — `eventStartDate` n'est pas exporté par `./schedule`.

- [ ] **Step 3: Implémenter `eventStartDate()`**

Modify `src/lib/schedule.ts` — ajouter à la fin du fichier :

```ts
export function eventStartDate(e: FestEvent): Date {
  const dayInfo = DAYS.find((d) => d.key === e.day)
  if (!dayInfo) {
    throw new Error(`Unknown day: ${e.day}`)
  }
  const [hours, minutes] = e.start.split(':').map(Number)
  const date = hours < 5 ? Number(dayInfo.date) + 1 : Number(dayInfo.date)
  return new Date(2026, 6, date, hours, minutes)
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

Run: `npx vitest run src/lib/schedule.test.ts`

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/schedule.ts src/lib/schedule.test.ts
git commit -m "feat: add eventStartDate to compute the real calendar date of an event"
```

---

## Task 3: Créer `useReminders` — gestion du statut et de la permission

**Files:**
- Create: `src/hooks/useReminders.ts`
- Test: `src/hooks/useReminders.test.ts`

**Interfaces:**
- Produces:
  - `type ReminderStatus = 'unsupported' | 'default' | 'denied' | 'enabled' | 'disabled'`
  - `useReminders(): { status: ReminderStatus; enable: () => void; disable: () => void }`
  - (Task 4 étendra la signature à `useReminders(favoriteEvents: FestEvent[])` — ne pas ajouter ce paramètre dans cette tâche pour éviter une erreur `noUnusedParameters`.)

- [ ] **Step 1: Écrire le test qui échoue**

Create `src/hooks/useReminders.test.ts` :

```ts
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReminders } from './useReminders'

class MockNotification {
  static permission: NotificationPermission = 'default'
  static requestPermission = vi.fn()
  static instances: MockNotification[] = []
  onclick: (() => void) | null = null
  constructor(
    public title: string,
    public options?: NotificationOptions,
  ) {
    MockNotification.instances.push(this)
  }
}

beforeEach(() => {
  localStorage.clear()
  MockNotification.permission = 'default'
  MockNotification.requestPermission = vi.fn()
  MockNotification.instances = []
  vi.stubGlobal('Notification', MockNotification)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useReminders status', () => {
  it('démarre à "default" quand la permission n\'a jamais été demandée', () => {
    const { result } = renderHook(() => useReminders())
    expect(result.current.status).toBe('default')
  })

  it('passe à "enabled" quand enable() obtient la permission', async () => {
    MockNotification.requestPermission.mockResolvedValue('granted' as NotificationPermission)
    const { result } = renderHook(() => useReminders())

    await act(async () => {
      result.current.enable()
    })

    expect(result.current.status).toBe('enabled')
    expect(localStorage.getItem('pdj26-reminders-enabled')).toBe('true')
  })

  it('passe à "denied" quand le navigateur refuse la permission', async () => {
    MockNotification.requestPermission.mockResolvedValue('denied' as NotificationPermission)
    const { result } = renderHook(() => useReminders())

    await act(async () => {
      result.current.enable()
    })

    expect(result.current.status).toBe('denied')
  })

  it('ne redemande pas la permission si elle est déjà refusée', () => {
    MockNotification.permission = 'denied'
    const { result } = renderHook(() => useReminders())

    act(() => {
      result.current.enable()
    })

    expect(MockNotification.requestPermission).not.toHaveBeenCalled()
    expect(result.current.status).toBe('denied')
  })

  it('passe de "enabled" à "disabled" via disable()', () => {
    MockNotification.permission = 'granted'
    localStorage.setItem('pdj26-reminders-enabled', 'true')
    const { result } = renderHook(() => useReminders())
    expect(result.current.status).toBe('enabled')

    act(() => {
      result.current.disable()
    })

    expect(result.current.status).toBe('disabled')
    expect(localStorage.getItem('pdj26-reminders-enabled')).toBe('false')
  })

  it('vaut "unsupported" quand l\'API Notification est absente', () => {
    vi.unstubAllGlobals()
    const { result } = renderHook(() => useReminders())
    expect(result.current.status).toBe('unsupported')
  })
})
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

Run: `npx vitest run src/hooks/useReminders.test.ts`

Expected: FAIL — le module `./useReminders` n'existe pas.

- [ ] **Step 3: Implémenter le hook (statut + permission uniquement)**

Create `src/hooks/useReminders.ts` :

```ts
import { useCallback, useState } from 'react'

export type ReminderStatus = 'unsupported' | 'default' | 'denied' | 'enabled' | 'disabled'

const ENABLED_KEY = 'pdj26-reminders-enabled'

function isEnabledInStorage(): boolean {
  return localStorage.getItem(ENABLED_KEY) === 'true'
}

function setEnabledInStorage(value: boolean) {
  localStorage.setItem(ENABLED_KEY, value ? 'true' : 'false')
}

function computeStatus(): ReminderStatus {
  if (typeof Notification === 'undefined') {
    return 'unsupported'
  }
  if (Notification.permission === 'denied') {
    return 'denied'
  }
  if (Notification.permission === 'default') {
    return 'default'
  }
  return isEnabledInStorage() ? 'enabled' : 'disabled'
}

export function useReminders() {
  const [status, setStatus] = useState<ReminderStatus>(computeStatus)

  const enable = useCallback(() => {
    if (typeof Notification === 'undefined') {
      return
    }
    if (Notification.permission === 'granted') {
      setEnabledInStorage(true)
      setStatus('enabled')
      return
    }
    if (Notification.permission === 'denied') {
      setStatus('denied')
      return
    }
    void Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        setEnabledInStorage(true)
        setStatus('enabled')
      } else {
        setStatus(permission === 'denied' ? 'denied' : 'default')
      }
    })
  }, [])

  const disable = useCallback(() => {
    setEnabledInStorage(false)
    setStatus('disabled')
  }, [])

  return { status, enable, disable }
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

Run: `npx vitest run src/hooks/useReminders.test.ts`

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useReminders.ts src/hooks/useReminders.test.ts
git commit -m "feat: add useReminders hook with permission/status management"
```

---

## Task 4: Étendre `useReminders` — programmation des rappels

**Files:**
- Modify: `src/hooks/useReminders.ts`
- Modify: `src/hooks/useReminders.test.ts`

**Interfaces:**
- Consumes: `eventStartDate` (`src/lib/schedule.ts`, Task 2), `FestEvent` (`src/types.ts`).
- Produces: `useReminders(favoriteEvents: FestEvent[]): { status: ReminderStatus; enable: () => void; disable: () => void }` (signature finale, remplace celle de Task 3).

- [ ] **Step 1: Écrire les tests qui échouent**

Modify `src/hooks/useReminders.test.ts` — ajouter en haut du fichier l'import de `FestEvent`, puis à la fin du fichier :

```ts
import type { FestEvent } from '../types'
```

```ts
describe('useReminders scheduling', () => {
  function makeEvent(overrides: Partial<FestEvent> = {}): FestEvent {
    return {
      id: 'evt-1',
      title: 'Concert test',
      artist: null,
      day: 'sam',
      start: '21:00',
      end: '22:00',
      venue: 'Scène test',
      category: 'concert',
      subtype: null,
      description: null,
      ...overrides,
    }
  }

  beforeEach(() => {
    MockNotification.permission = 'granted'
    localStorage.setItem('pdj26-reminders-enabled', 'true')
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('déclenche une notification 15 minutes avant le début d\'un favori', () => {
    vi.setSystemTime(new Date(2026, 6, 18, 20, 44))
    renderHook(({ events }) => useReminders(events), {
      initialProps: { events: [makeEvent()] },
    })

    expect(MockNotification.instances).toHaveLength(0)
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(MockNotification.instances).toHaveLength(1)
    expect(MockNotification.instances[0].title).toBe('Concert test')
  })

  it('rattrape immédiatement si la fenêtre de rappel est déjà entamée', () => {
    vi.setSystemTime(new Date(2026, 6, 18, 20, 50)) // 10 min avant, fenêtre déjà ouverte
    renderHook(({ events }) => useReminders(events), {
      initialProps: { events: [makeEvent()] },
    })

    expect(MockNotification.instances).toHaveLength(1)
  })

  it('ne déclenche rien si l\'événement a déjà commencé', () => {
    vi.setSystemTime(new Date(2026, 6, 18, 21, 30))
    renderHook(({ events }) => useReminders(events), {
      initialProps: { events: [makeEvent()] },
    })

    act(() => {
      vi.advanceTimersByTime(10 * 60_000)
    })
    expect(MockNotification.instances).toHaveLength(0)
  })

  it('ne redéclenche pas le même événement lors d\'un nouveau visibilitychange', () => {
    vi.setSystemTime(new Date(2026, 6, 18, 20, 50))
    renderHook(({ events }) => useReminders(events), {
      initialProps: { events: [makeEvent()] },
    })
    expect(MockNotification.instances).toHaveLength(1)

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(MockNotification.instances).toHaveLength(1)
  })

  it('annule le rappel en attente si le favori est retiré', () => {
    vi.setSystemTime(new Date(2026, 6, 18, 20, 44))
    const { rerender } = renderHook(({ events }) => useReminders(events), {
      initialProps: { events: [makeEvent()] },
    })

    rerender({ events: [] })
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(MockNotification.instances).toHaveLength(0)
  })

  it('ne programme rien tant que le statut n\'est pas "enabled"', () => {
    MockNotification.permission = 'default'
    localStorage.removeItem('pdj26-reminders-enabled')
    vi.setSystemTime(new Date(2026, 6, 18, 20, 59))
    renderHook(({ events }) => useReminders(events), {
      initialProps: { events: [makeEvent()] },
    })

    act(() => {
      vi.advanceTimersByTime(5 * 60_000)
    })
    expect(MockNotification.instances).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Lancer les tests et vérifier qu'ils échouent**

Run: `npx vitest run src/hooks/useReminders.test.ts`

Expected: FAIL sur les 6 nouveaux tests — `useReminders` n'accepte pas encore d'argument et ne programme rien.

- [ ] **Step 3: Implémenter la programmation des rappels**

Modify `src/hooks/useReminders.ts` — remplacer tout le fichier par :

```ts
import { useCallback, useEffect, useState } from 'react'
import { eventStartDate } from '../lib/schedule'
import type { FestEvent } from '../types'

export type ReminderStatus = 'unsupported' | 'default' | 'denied' | 'enabled' | 'disabled'

const ENABLED_KEY = 'pdj26-reminders-enabled'
const NOTIFIED_KEY = 'pdj26-reminders-notified'
const REMINDER_LEAD_MS = 15 * 60 * 1000

function isEnabledInStorage(): boolean {
  return localStorage.getItem(ENABLED_KEY) === 'true'
}

function setEnabledInStorage(value: boolean) {
  localStorage.setItem(ENABLED_KEY, value ? 'true' : 'false')
}

function getNotifiedIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

function markNotified(id: string) {
  const notified = getNotifiedIds()
  notified.add(id)
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...notified]))
}

function fireReminder(event: FestEvent) {
  const body = event.end
    ? `${event.start} – ${event.end} · ${event.venue}`
    : `${event.start} · ${event.venue}`
  const notification = new Notification(event.title, { body })
  notification.onclick = () => window.focus()
}

function computeStatus(): ReminderStatus {
  if (typeof Notification === 'undefined') {
    return 'unsupported'
  }
  if (Notification.permission === 'denied') {
    return 'denied'
  }
  if (Notification.permission === 'default') {
    return 'default'
  }
  return isEnabledInStorage() ? 'enabled' : 'disabled'
}

export function useReminders(favoriteEvents: FestEvent[]) {
  const [status, setStatus] = useState<ReminderStatus>(computeStatus)

  const enable = useCallback(() => {
    if (typeof Notification === 'undefined') {
      return
    }
    if (Notification.permission === 'granted') {
      setEnabledInStorage(true)
      setStatus('enabled')
      return
    }
    if (Notification.permission === 'denied') {
      setStatus('denied')
      return
    }
    void Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        setEnabledInStorage(true)
        setStatus('enabled')
      } else {
        setStatus(permission === 'denied' ? 'denied' : 'default')
      }
    })
  }, [])

  const disable = useCallback(() => {
    setEnabledInStorage(false)
    setStatus('disabled')
  }, [])

  useEffect(() => {
    if (status !== 'enabled') {
      return
    }

    let timers: ReturnType<typeof setTimeout>[] = []

    function schedule() {
      timers.forEach(clearTimeout)
      timers = []
      const notified = getNotifiedIds()
      const now = Date.now()

      for (const event of favoriteEvents) {
        if (notified.has(event.id)) {
          continue
        }
        const start = eventStartDate(event).getTime()
        if (now >= start) {
          continue
        }
        const delay = start - REMINDER_LEAD_MS - now

        if (delay <= 0) {
          fireReminder(event)
          markNotified(event.id)
          continue
        }

        timers.push(
          setTimeout(() => {
            fireReminder(event)
            markNotified(event.id)
          }, delay),
        )
      }
    }

    schedule()
    document.addEventListener('visibilitychange', schedule)

    return () => {
      timers.forEach(clearTimeout)
      document.removeEventListener('visibilitychange', schedule)
    }
  }, [status, favoriteEvents])

  return { status, enable, disable }
}
```

- [ ] **Step 4: Lancer tous les tests du hook et vérifier qu'ils passent**

Run: `npx vitest run src/hooks/useReminders.test.ts`

Expected: PASS (12 tests au total : 6 de Task 3 + 6 de cette tâche).

- [ ] **Step 5: Lancer la suite complète**

Run: `npm run test`

Expected: PASS, tous les fichiers de test au vert.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useReminders.ts src/hooks/useReminders.test.ts
git commit -m "feat: schedule local reminders 15 minutes before favorited events"
```

---

## Task 5: Composants `ReminderBanner` / `ReminderToggle` et câblage UI

Cette tâche regroupe la création des deux composants et leur câblage dans `TimelineTab`, `FaqTab` et `App.tsx` en une seule unité, pour ne jamais laisser le build cassé entre deux commits (les nouvelles props de `TimelineTab`/`FaqTab` n'ont de sens qu'une fois `App.tsx` mis à jour).

**Files:**
- Create: `src/components/ReminderBanner.tsx`
- Create: `src/components/ReminderToggle.tsx`
- Modify: `src/tabs/TimelineTab.tsx`
- Modify: `src/tabs/FaqTab.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useReminders` (Task 4), `ReminderStatus` (Task 3/4).
- Produces: `TimelineTab` accepte désormais `reminderStatus: ReminderStatus` et `onEnableReminders: () => void` en plus de ses props existantes. `FaqTab` accepte `reminderStatus: ReminderStatus`, `onEnableReminders: () => void`, `onDisableReminders: () => void`.

- [ ] **Step 1: Créer `ReminderBanner`**

Create `src/components/ReminderBanner.tsx` :

```tsx
import { useState } from 'react'
import type { ReminderStatus } from '../hooks/useReminders'

const PROMPTED_KEY = 'pdj26-reminders-prompted'

interface ReminderBannerProps {
  status: ReminderStatus
  enable: () => void
  favoritesCount: number
}

export function ReminderBanner({ status, enable, favoritesCount }: ReminderBannerProps) {
  const [prompted, setPrompted] = useState(() => localStorage.getItem(PROMPTED_KEY) === 'true')

  if (prompted || favoritesCount !== 1 || status !== 'default') {
    return null
  }

  const dismiss = () => {
    localStorage.setItem(PROMPTED_KEY, 'true')
    setPrompted(true)
  }

  return (
    <div className="reminder-banner" role="status">
      <p>Envie d'un rappel 15 min avant chaque événement de ta timeline ?</p>
      <div className="reminder-banner-actions">
        <button
          type="button"
          className="reminder-banner-enable"
          onClick={() => {
            enable()
            dismiss()
          }}
        >
          Activer les rappels
        </button>
        <button
          type="button"
          className="reminder-banner-dismiss"
          aria-label="Fermer"
          onClick={dismiss}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Créer `ReminderToggle`**

Create `src/components/ReminderToggle.tsx` :

```tsx
import type { ReminderStatus } from '../hooks/useReminders'

interface ReminderToggleProps {
  status: ReminderStatus
  enable: () => void
  disable: () => void
}

export function ReminderToggle({ status, enable, disable }: ReminderToggleProps) {
  if (status === 'unsupported') {
    return (
      <p className="reminder-toggle-note">
        Les rappels ne sont pas disponibles sur ce navigateur. Sur iPhone, installe d'abord
        l'appli sur l'écran d'accueil.
      </p>
    )
  }

  const checked = status === 'enabled'

  return (
    <div className="reminder-toggle-row">
      <span>Rappel 15 min avant chaque événement de ma timeline</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="Activer les rappels de notification"
        className={`reminder-toggle${checked ? ' is-on' : ''}`}
        disabled={status === 'denied'}
        onClick={() => (checked ? disable() : enable())}
      >
        <span className="reminder-toggle-knob" />
      </button>
      {status === 'denied' && (
        <p className="reminder-toggle-note">
          Les notifications sont bloquées pour ce site. Réautorise-les depuis les réglages de
          ton navigateur ou de ton téléphone.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Câbler `ReminderBanner` dans `TimelineTab`**

Modify `src/tabs/TimelineTab.tsx` :

```tsx
import type { Day, FestEvent } from '../types'
import { byTime, DAY_LONG, DAYS, formatRange } from '../lib/schedule'
import { UmbrellaButton } from '../components/Umbrella'
import { ReminderBanner } from '../components/ReminderBanner'
import type { ReminderStatus } from '../hooks/useReminders'
import eventsData from '../data/events.json'

const events = eventsData as FestEvent[]

interface TimelineTabProps {
  favorites: Set<string>
  onToggleFavorite: (id: string) => void
  reminderStatus: ReminderStatus
  onEnableReminders: () => void
}

export function TimelineTab({
  favorites,
  onToggleFavorite,
  reminderStatus,
  onEnableReminders,
}: TimelineTabProps) {
  const mine = events.filter((e) => favorites.has(e.id)).sort(byTime)

  if (mine.length === 0) {
    return (
      <section className="timeline-empty" aria-label="Ma timeline">
        <svg viewBox="0 0 24 24" className="empty-umbrella" aria-hidden="true">
          <path d="M12 2.5c-5.5 0-9.5 4-9.8 8.7 0 .3.3.55.6.4 1-.5 2.4-.8 3.4-.1.4.3.9.3 1.3 0 1.2-.9 2.6-.9 3.8 0 .4.3.9.3 1.3 0 1.2-.9 2.6-.9 3.8 0 .4.3.9.3 1.3 0 1-.7 2.4-.4 3.4.1.3.15.6-.1.6-.4C21.5 6.5 17.5 2.5 12 2.5Z" />
          <path
            d="M12 12v6.5a1.6 1.6 0 0 1-3.2 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <h2>Ta timeline est vide</h2>
        <p>
          Ouvre le parapluie d'un concert, d'un atelier ou d'une conférence dans le
          Programme pour le retrouver ici, dans l'ordre du week-end.
        </p>
      </section>
    )
  }

  const byDay = DAYS.map((d) => ({
    day: d.key as Day,
    items: mine.filter((e) => e.day === d.key),
  })).filter((g) => g.items.length > 0)

  return (
    <section aria-label="Ma timeline">
      <ReminderBanner
        status={reminderStatus}
        enable={onEnableReminders}
        favoritesCount={favorites.size}
      />
      {byDay.map((group) => (
        <div key={group.day} className="tl-day">
          <h2 className={`tl-day-title day-${group.day}`}>{DAY_LONG[group.day]}</h2>
          <ol className="tl-list">
            {group.items.map((e) => (
              <li key={e.id} className={`tl-item cat-${e.category}`}>
                <span className="tl-dot" aria-hidden="true" />
                <div className="tl-content">
                  <span className="pill pill-time">{formatRange(e)}</span>
                  <h3 className="card-title">{e.title}</h3>
                  {e.artist && <p className="card-artist">{e.artist}</p>}
                  <p className="card-venue">{e.venue}</p>
                </div>
                <UmbrellaButton
                  active
                  title={e.title}
                  onToggle={() => onToggleFavorite(e.id)}
                />
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  )
}
```

- [ ] **Step 4: Câbler `ReminderToggle` dans `FaqTab`**

Modify `src/tabs/FaqTab.tsx` — ajouter les imports et props, et insérer le toggle dans le groupe "L'application" :

```tsx
import { useState } from 'react'
import type { FaqItem } from '../types'
import type { ReminderStatus } from '../hooks/useReminders'
import { ReminderToggle } from '../components/ReminderToggle'
import faqData from '../data/faq.json'

const faq = faqData as FaqItem[]

const APP_FAQ: FaqItem[] = [
  {
    id: 'app-hors-ligne',
    question: "L'appli fonctionne-t-elle sans connexion ?",
    category: "L'application",
    answer:
      "Oui. Une fois que tu as ouvert l'appli au moins une fois, la carte, le programme et cette FAQ restent disponibles hors-ligne — pratique si le réseau sature sur le site.",
  },
  {
    id: 'app-installation',
    question: "Comment installer l'appli sur mon téléphone ?",
    category: "L'application",
    answer:
      "Un bouton « Installer » apparaît en haut de l'écran quand c'est possible. Sur iPhone, utilise le bouton Partager de Safari puis « Sur l'écran d'accueil ».",
  },
  {
    id: 'app-favoris',
    question: 'Mes favoris sont-ils sauvegardés ?',
    category: "L'application",
    answer:
      "Oui, ils restent enregistrés sur ton téléphone tant que tu ne les retires pas ou que tu ne vides pas les données du navigateur. Aucun compte n'est nécessaire.",
  },
  {
    id: 'app-mise-a-jour',
    question: 'Le programme peut-il encore changer ?',
    category: "L'application",
    answer:
      "En cas de changement de dernière minute, consulte www.lespluiesdejuillet.org pour les infos les plus à jour.",
  },
]

const ALL_ITEMS = [...faq, ...APP_FAQ]
const CATEGORIES = [...new Set(ALL_ITEMS.map((item) => item.category))]

function Question({ item }: { item: FaqItem }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="faq-item">
      <button
        type="button"
        className="faq-question"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        {item.question}
        <span className="faq-chevron" aria-hidden="true" />
      </button>
      {expanded && <p className="faq-answer">{item.answer}</p>}
    </div>
  )
}

interface FaqTabProps {
  reminderStatus: ReminderStatus
  onEnableReminders: () => void
  onDisableReminders: () => void
}

export function FaqTab({ reminderStatus, onEnableReminders, onDisableReminders }: FaqTabProps) {
  return (
    <section aria-label="FAQ et infos pratiques">
      <div className="legend">
        {CATEGORIES.map((category, i) => (
          <details key={category} className="legend-group faq-group" open={i === 0}>
            <summary>{category}</summary>
            <div className="faq-list">
              {ALL_ITEMS.filter((item) => item.category === category).map((item) => (
                <Question key={item.id} item={item} />
              ))}
            </div>
            {category === "L'application" && (
              <ReminderToggle
                status={reminderStatus}
                enable={onEnableReminders}
                disable={onDisableReminders}
              />
            )}
          </details>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Câbler `useReminders` dans `App.tsx`**

Modify `src/App.tsx` :

- Ajouter les imports en haut du fichier (après les imports existants) :

```tsx
import { useMemo, useState } from 'react'
import { useReminders } from './hooks/useReminders'
import eventsData from './data/events.json'
import type { FestEvent } from './types'
```

(Remplace la ligne `import { useState } from 'react'` existante par `import { useMemo, useState } from 'react'`.)

- Ajouter juste après `const TABS: ...` :

```tsx
const events = eventsData as FestEvent[]
```

- Dans `App()`, après `const { favorites, toggle } = useFavorites()`, ajouter :

```tsx
  const favoriteEvents = useMemo(
    () => events.filter((e) => favorites.has(e.id)),
    [favorites],
  )
  const reminders = useReminders(favoriteEvents)
```

- Remplacer le rendu des onglets `timeline` et `faq` :

```tsx
        {tab === 'timeline' && (
          <TimelineTab
            favorites={favorites}
            onToggleFavorite={toggle}
            reminderStatus={reminders.status}
            onEnableReminders={reminders.enable}
          />
        )}
        {tab === 'faq' && (
          <FaqTab
            reminderStatus={reminders.status}
            onEnableReminders={reminders.enable}
            onDisableReminders={reminders.disable}
          />
        )}
```

- [ ] **Step 6: Vérifier que le build passe**

Run: `npm run build`

Expected: `tsc -b` puis `vite build` se terminent sans erreur (aucune prop manquante, aucun type incompatible).

- [ ] **Step 7: Lancer la suite de tests complète**

Run: `npm run test`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/ReminderBanner.tsx src/components/ReminderToggle.tsx src/tabs/TimelineTab.tsx src/tabs/FaqTab.tsx src/App.tsx
git commit -m "feat: wire reminder banner and FAQ toggle into the UI"
```

---

## Task 6: Styles CSS de la bannière et de l'interrupteur

**Files:**
- Modify: `src/index.css`

**Interfaces:**
- Consumes: classes `reminder-banner`, `reminder-banner-actions`, `reminder-banner-enable`, `reminder-banner-dismiss` (produites par `ReminderBanner`, Task 5) et `reminder-toggle-row`, `reminder-toggle`, `reminder-toggle-knob`, `reminder-toggle-note` (produites par `ReminderToggle`, Task 5).

- [ ] **Step 1: Ajouter les styles à la fin de `src/index.css`**

Append à `src/index.css` :

```css
/* ---------- Rappels de notification ---------- */
.reminder-banner {
  margin: 0 0 16px;
  padding: 12px 14px;
  background: var(--card);
  border: 2px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--sticker-sm);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.reminder-banner p {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.4;
}

.reminder-banner-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.reminder-banner-enable {
  padding: 8px 14px;
  background: var(--yellow);
  color: #141414;
  border: 2px solid var(--line);
  border-radius: 999px;
  box-shadow: var(--sticker-sm);
  font-weight: 800;
  font-family: var(--display);
  text-transform: uppercase;
  font-size: 0.8rem;
}

.reminder-banner-enable:active {
  box-shadow: none;
  transform: translate(2px, 2px);
}

.reminder-banner-dismiss {
  margin-left: auto;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border: 2px solid var(--line);
  border-radius: 999px;
  background: var(--paper);
  font-size: 0.9rem;
  line-height: 1;
}

.reminder-toggle-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  font-size: 0.88rem;
}

.reminder-toggle-row span {
  flex: 1;
}

.reminder-toggle {
  flex-shrink: 0;
  position: relative;
  width: 46px;
  height: 26px;
  border: 2px solid var(--line);
  border-radius: 999px;
  background: var(--paper);
  padding: 0;
}

.reminder-toggle.is-on {
  background: var(--pink);
}

.reminder-toggle:disabled {
  opacity: 0.5;
}

.reminder-toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border: 2px solid var(--line);
  border-radius: 50%;
  background: var(--card);
  transition: transform 0.15s ease;
}

.reminder-toggle.is-on .reminder-toggle-knob {
  transform: translateX(20px);
}

.reminder-toggle-note {
  margin: 0 10px 10px;
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--muted);
}
```

- [ ] **Step 2: Vérification visuelle**

Run: `npm run dev`

Expected: ouvrir `http://localhost:5173/pdj/`, ajouter un favori dans le Programme, aller dans l'onglet Timeline → la bannière s'affiche avec le style "sticker" cohérent avec `.install-btn`/`.ios-sheet-close`. Ouvrir l'onglet FAQ, dérouler "L'application" → l'interrupteur s'affiche sous les questions existantes.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "style: add reminder banner and toggle styles"
```

---

## Task 7: Vérification manuelle de bout en bout

Cette étape n'est pas automatisable en CI (dépend de la permission navigateur réelle et du minutage) — c'est un test manuel final avant de considérer la fonctionnalité complète.

- [ ] **Step 1: Build de prod et preview**

Run: `npm run build && npm run preview`

Expected: build sans erreur, preview accessible sur `http://localhost:4173/pdj/`.

- [ ] **Step 2: Parcours "premier favori"**

Dans un navigateur desktop (Chrome ou Firefox, qui supportent `Notification` sans installation) :
1. Ouvrir l'onglet Programme, ajouter un favori (ouvrir le parapluie) sur un événement dont l'heure de début est dans moins de 20 minutes (modifier temporairement `src/data/events.json` en local si besoin pour ce test, sans committer ce changement).
2. Aller sur l'onglet Timeline → la bannière "Envie d'un rappel..." doit apparaître.
3. Cliquer "Activer les rappels" → le navigateur doit proposer sa popup native de permission de notification.
4. Accepter → la bannière disparaît.

Expected : dans le DevTools → Application → Local Storage, `pdj26-reminders-enabled` = `"true"` et `pdj26-reminders-prompted` = `"true"`.

- [ ] **Step 3: Réception du rappel**

Laisser l'onglet ouvert (ou le mettre en arrière-plan) jusqu'à 15 minutes avant l'heure de début choisie à l'étape 2.

Expected : une notification système apparaît avec le titre de l'événement et son horaire/lieu en corps de texte. Cliquer dessus doit ramener le focus sur l'onglet.

- [ ] **Step 4: Toggle FAQ**

Aller dans l'onglet FAQ → "L'application" → vérifier que l'interrupteur est affiché "activé". Le désactiver.

Expected : `pdj26-reminders-enabled` passe à `"false"` dans le Local Storage ; plus aucune notification ne se déclenche pour les favoris restants tant qu'il n'est pas réactivé.

- [ ] **Step 5: Cas refus de permission**

Dans un profil de navigateur neuf (ou après avoir réinitialisé les permissions du site), refuser la popup de permission à l'étape "Activer les rappels".

Expected : le statut passe à `denied`, la bannière ne réapparaît pas, et le toggle FAQ est grisé avec le message expliquant comment réautoriser depuis les réglages du navigateur.
