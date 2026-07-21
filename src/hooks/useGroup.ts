import { useCallback, useEffect, useMemo, useState } from 'react'
import * as Sentry from '@sentry/react'
import {
  decryptState,
  deriveGroupKeys,
  encryptState,
  generateGroupCode,
  normalizeCode,
  type MemberState,
} from '../lib/group'
import {
  generateSecretKey,
  getPublicKey,
  publishState,
  skFromHex,
  skToHex,
  subscribeGroup,
} from '../lib/nostr'
import { isEventOngoing } from '../lib/schedule'
import type { FestEvent } from '../types'
import eventsData from '../data/events.json'

const GROUP_KEY = 'fdh26-group'
const SK_KEY = 'fdh26-group-sk'
const MEMBERS_KEY = 'fdh26-group-members'
const AT_KEY = 'fdh26-group-at'
const PUBLISH_DEBOUNCE_MS = 2000
const PRESENCE_TICK_MS = 60_000

const eventById = new Map((eventsData as FestEvent[]).map((e) => [e.id, e]))

/** Pastille d'un ami sur un événement : favori, et éventuellement présent en ce moment. */
export interface FriendPresence {
  name: string
  here: boolean
}

// Une présence n'est valide que pendant l'événement : au-delà, elle est
// considérée comme expirée (pas de « il y est encore » à 4 h du matin).
function ongoingEventId(id: string | null | undefined, now: number): string | null {
  if (!id) {
    return null
  }
  const event = eventById.get(id)
  return event && isEventOngoing(event, now) ? id : null
}

function loadMyEventId(): string | null {
  return ongoingEventId(localStorage.getItem(AT_KEY), Date.now())
}

// Identité stable de l'appareil : réutilisée quand on quitte/rejoint un
// groupe, pour que notre événement remplaçable écrase l'ancien au lieu de
// laisser un membre fantôme sur les relais.
function deviceSk(): string {
  const existing = localStorage.getItem(SK_KEY)
  if (existing) {
    return existing
  }
  const sk = skToHex(generateSecretKey())
  localStorage.setItem(SK_KEY, sk)
  return sk
}

interface StoredGroup {
  code: string
  name: string
  sk: string
}

function loadStored(): StoredGroup | null {
  try {
    const raw = localStorage.getItem(GROUP_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as StoredGroup
    if (
      typeof parsed.code === 'string' &&
      typeof parsed.name === 'string' &&
      typeof parsed.sk === 'string'
    ) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

function loadMembers(): Record<string, MemberState> {
  try {
    return JSON.parse(localStorage.getItem(MEMBERS_KEY) ?? '{}') as Record<
      string,
      MemberState
    >
  } catch {
    return {}
  }
}

export function useGroup(favorites: Set<string>) {
  const [stored, setStored] = useState<StoredGroup | null>(loadStored)
  const [members, setMembers] = useState<Record<string, MemberState>>(loadMembers)
  const [syncTick, setSyncTick] = useState(0)
  const [myEventId, setMyEventId] = useState<string | null>(loadMyEventId)
  const [presenceTick, setPresenceTick] = useState(0)

  const myPubkey = useMemo(
    () => (stored ? getPublicKey(skFromHex(stored.sk)) : null),
    [stored],
  )

  // Réveil : retour du réseau ou de l'app au premier plan → réabonnement
  // (les WebSockets sont coupés en arrière-plan sur mobile) + republication.
  useEffect(() => {
    if (!stored) {
      return
    }
    const bump = () => setSyncTick((t) => t + 1)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        bump()
      }
    }
    window.addEventListener('online', bump)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', bump)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [stored])

  // Abonnement aux états des membres du groupe.
  useEffect(() => {
    if (!stored) {
      return
    }
    let cancelled = false
    let unsubscribe: (() => void) | null = null
    void deriveGroupKeys(stored.code).then(({ key, tag }) => {
      if (cancelled) {
        return
      }
      unsubscribe = subscribeGroup(tag, (pubkey, content) => {
        void decryptState(key, content).then((state) => {
          if (!state || cancelled) {
            return
          }
          setMembers((prev) => {
            const existing = prev[pubkey]
            if (existing && existing.updatedAt >= state.updatedAt) {
              return prev
            }
            const next = { ...prev }
            if (state.left) {
              delete next[pubkey]
            } else {
              next[pubkey] = state
            }
            localStorage.setItem(MEMBERS_KEY, JSON.stringify(next))
            return next
          })
        })
      })
    })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [stored, syncTick])

  // Publication débouncée de mon propre état.
  useEffect(() => {
    if (!stored) {
      return
    }
    const timer = setTimeout(() => {
      void deriveGroupKeys(stored.code).then(async ({ key, tag }) => {
        const state: MemberState = {
          name: stored.name,
          favorites: [...favorites],
          updatedAt: Date.now(),
          at: myEventId ?? undefined,
        }
        const payload = await encryptState(key, state)
        await publishState(skFromHex(stored.sk), tag, payload)
      })
    }, PUBLISH_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [stored, favorites, myEventId, syncTick])

  // Horloge de présence : fait expirer les « j'y suis » (les miens comme ceux
  // des amis) quand l'événement se termine, sans attendre une republication.
  useEffect(() => {
    if (!stored) {
      return
    }
    const timer = setInterval(() => setPresenceTick((t) => t + 1), PRESENCE_TICK_MS)
    return () => {
      clearInterval(timer)
    }
  }, [stored])

  const checkIn = useCallback((eventId: string | null) => {
    if (eventId) {
      localStorage.setItem(AT_KEY, eventId)
      Sentry.metrics.count('group.checkin', 1)
    } else {
      localStorage.removeItem(AT_KEY)
    }
    // Un seul événement à la fois : la nouvelle présence remplace l'ancienne.
    setMyEventId(eventId)
  }, [])

  useEffect(() => {
    if (myEventId && !ongoingEventId(myEventId, Date.now())) {
      checkIn(null)
    }
  }, [myEventId, presenceTick, checkIn])

  const enter = useCallback((code: string, name: string) => {
    const next: StoredGroup = { code, name, sk: deviceSk() }
    localStorage.setItem(GROUP_KEY, JSON.stringify(next))
    localStorage.removeItem(MEMBERS_KEY)
    localStorage.removeItem(AT_KEY)
    setMembers({})
    setMyEventId(null)
    setStored(next)
  }, [])

  const create = useCallback(
    (name: string): string => {
      const code = generateGroupCode()
      enter(code, name)
      Sentry.metrics.count('group.create', 1)
      return code
    },
    [enter],
  )

  const join = useCallback(
    (codeInput: string, name: string) => {
      enter(normalizeCode(codeInput), name)
      Sentry.metrics.count('group.join', 1)
    },
    [enter],
  )

  const leave = useCallback(() => {
    if (stored) {
      Sentry.metrics.count('group.leave', 1)
      // Tombstone best-effort : si un relais est joignable, les autres
      // membres purgent immédiatement mes favoris de leur timeline.
      const leaving = stored
      void deriveGroupKeys(leaving.code).then(async ({ key, tag }) => {
        const payload = await encryptState(key, {
          name: leaving.name,
          favorites: [],
          updatedAt: Date.now(),
          left: true,
        })
        await publishState(skFromHex(leaving.sk), tag, payload)
      })
    }
    localStorage.removeItem(GROUP_KEY)
    localStorage.removeItem(MEMBERS_KEY)
    localStorage.removeItem(AT_KEY)
    setStored(null)
    setMembers({})
    setMyEventId(null)
  }, [stored])

  // Les copains = tous les états reçus sauf le mien.
  const others = useMemo(
    () =>
      Object.entries(members)
        .filter(([pubkey]) => pubkey !== myPubkey)
        .map(([, state]) => state),
    [members, myPubkey],
  )

  useEffect(() => {
    if (!stored) {
      return
    }
    Sentry.metrics.gauge('group.members', others.length)
  }, [stored, others.length])

  const friendsByEvent = useMemo(() => {
    // presenceTick force un recalcul périodique : la présence d'un ami expire
    // à la fin de l'événement même sans nouvel événement reçu du relais.
    void presenceTick
    const now = Date.now()
    const map = new Map<string, FriendPresence[]>()
    for (const member of others) {
      const here = ongoingEventId(member.at, now)
      const ids = new Set(member.favorites)
      if (here) {
        ids.add(here)
      }
      for (const id of ids) {
        map.set(id, [...(map.get(id) ?? []), { name: member.name, here: id === here }])
      }
    }
    return map
  }, [others, presenceTick])

  return {
    group: stored ? { code: stored.code, name: stored.name } : null,
    others,
    create,
    join,
    leave,
    friendsByEvent,
    myEventId,
    checkIn,
  }
}

export type GroupApi = ReturnType<typeof useGroup>
