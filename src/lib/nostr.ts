import { SimplePool } from 'nostr-tools/pool'
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure'

export { generateSecretKey, getPublicKey }

export const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://offchain.pub',
]

// NIP-78 : données applicatives arbitraires, événement remplaçable paramétré.
export const GROUP_EVENT_KIND = 30078

const pool = new SimplePool()

export function skToHex(sk: Uint8Array): string {
  return [...sk].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function skFromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/** Publie l'état chiffré du membre ; résout dès qu'un relais a accepté. */
export async function publishState(
  sk: Uint8Array,
  groupTag: string,
  ciphertext: string,
): Promise<void> {
  const event = finalizeEvent(
    {
      kind: GROUP_EVENT_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['d', groupTag]],
      content: ciphertext,
    },
    sk,
  )
  try {
    await Promise.any(pool.publish(RELAYS, event))
  } catch {
    // Aucun relais joignable (hors ligne) : l'état local reste la source de
    // vérité, la prochaine publication (online/visibilitychange) rattrapera.
  }
}

/** S'abonne aux états du groupe ; rend une fonction de désabonnement. */
export function subscribeGroup(
  groupTag: string,
  onEvent: (pubkey: string, content: string, createdAt: number) => void,
): () => void {
  const sub = pool.subscribeMany(
    RELAYS,
    { kinds: [GROUP_EVENT_KIND], '#d': [groupTag] },
    {
      onevent(event) {
        onEvent(event.pubkey, event.content, event.created_at)
      },
    },
  )
  return () => {
    sub.close()
  }
}
