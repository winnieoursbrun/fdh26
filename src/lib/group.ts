const KEY_SALT = 'pdj26-group-v1'
const TAG_SALT = 'pdj26-tag-v1'
const PBKDF2_ITERATIONS = 100_000

// Mots sans accent ni ambiguïté, faciles à dicter à voix haute.
export const CODE_WORDS = [
  'PLUIE', 'AVERSE', 'ORAGE', 'NUAGE', 'ECLAIR', 'TONNERRE', 'BRUME', 'ROSEE',
  'FLAQUE', 'GOUTTE', 'DELUGE', 'CRACHIN', 'BRUINE', 'GIBOULEE', 'MOUSSON',
  'TEMPETE', 'RAFALE', 'BOURRASQUE', 'CYCLONE', 'BRISE', 'ZEPHYR', 'ALIZE',
  'GRELE', 'NEIGE', 'FLOCON', 'GIVRE', 'BROUILLARD', 'ARCADE', 'AURORE',
  'CREPUSCULE', 'HORIZON', 'ZENITH', 'ETOILE', 'LUNE', 'SOLEIL', 'COMETE',
  'PLANETE', 'GALAXIE', 'PARAPLUIE', 'BOTTES', 'PONCHO', 'CAPUCHE', 'CIRE',
  'FANFARE', 'GUITARE', 'BANJO', 'VIOLON', 'ACCORDEON', 'TROMPETTE', 'TAMBOUR',
  'MARACAS', 'SCENE', 'CONCERT', 'CHANSON', 'REFRAIN', 'COUPLET', 'MELODIE',
  'RYTHME', 'TEMPO', 'DANSE', 'GUINGUETTE', 'COTILLON', 'CONFETTI', 'GUIRLANDE',
  'LAMPION', 'BIVOUAC', 'TENTE', 'CAMPING', 'DUVET', 'HAMAC', 'PRAIRIE',
  'BOCAGE', 'POMMIER', 'CIDRE', 'POMME', 'POIRE', 'VERGER', 'POTAGER', 'RUCHE',
  'MIEL', 'TOURNESOL', 'COQUELICOT', 'MARGUERITE', 'TREFLE', 'FOUGERE',
  'MOUSSE', 'CHENE', 'HETRE', 'BOULEAU', 'SAULE', 'TILLEUL', 'ORTIE', 'RONCE',
  'MURE', 'FRAISE', 'CERISE', 'ABRICOT', 'MELON', 'PECHE', 'PRUNE', 'RAISIN',
  'CITRON', 'ORANGE', 'BANANE', 'KIWI', 'MANGUE', 'ANANAS', 'PAPAYE', 'LITCHI',
  'GOYAVE', 'CASSIS', 'GROSEILLE', 'MYRTILLE', 'FRAMBOISE', 'NOISETTE',
  'CHATAIGNE', 'RENARD', 'BLAIREAU', 'HERISSON', 'CHOUETTE', 'HIBOU', 'FAUCON',
  'BUSE', 'MERLE', 'MESANGE', 'PINSON', 'MOINEAU', 'HIRONDELLE', 'CIGOGNE',
  'HERON', 'CANARD', 'POULE', 'LAPIN', 'LIEVRE', 'CERF', 'BICHE', 'CHEVREUIL',
  'SANGLIER', 'ECUREUIL', 'LOUTRE', 'CASTOR', 'TAUPE', 'MULOT', 'GRENOUILLE',
  'CRAPAUD', 'TRITON', 'SALAMANDRE', 'LIBELLULE', 'PAPILLON', 'ABEILLE',
  'BOURDON', 'FOURMI', 'CIGALE', 'GRILLON', 'SAUTERELLE', 'COCCINELLE',
  'ESCARGOT', 'LANTERNE', 'BOUSSOLE', 'JUMELLES', 'GOURDE', 'THERMOS',
  'SIFFLET', 'DRAPEAU', 'FANION', 'BRACELET', 'TIPI', 'YOURTE', 'CABANE',
  'MOULIN', 'GRANGE', 'FERME', 'CONFITURE', 'TARTINE', 'CREPE', 'GALETTE',
  'BEIGNET', 'GAUFRE', 'SIROP', 'LIMONADE', 'GRENADINE', 'TISANE', 'CHOCOLAT',
  'CARAMEL', 'NOUGAT', 'PRALINE', 'VANILLE', 'CANNELLE', 'MENTHE', 'BASILIC',
  'THYM', 'ROMARIN', 'LAVANDE', 'SAUGE', 'PERSIL', 'ESTRAGON', 'SORBET',
  'TAMBOURIN', 'BOMBARDE', 'OCARINA', 'XYLOPHONE', 'HARMONICA', 'CLAIRON',
  'PICCOLO', 'MANDOLINE', 'UKULELE', 'CASTAGNETTE', 'TRIANGLE', 'CYMBALE',
]

export interface MemberState {
  name: string
  favorites: string[]
  updatedAt: number
  /** Id de l'événement où le membre se trouve en ce moment (un seul à la fois). */
  at?: string
  /** Tombstone publié au moment de quitter le groupe : les autres membres le purgent de leur liste. */
  left?: boolean
}

export interface GroupKeys {
  key: CryptoKey
  tag: string
}

export function generateGroupCode(): string {
  const rand = new Uint32Array(2)
  crypto.getRandomValues(rand)
  const word = CODE_WORDS[rand[0] % CODE_WORDS.length]
  const digits = String(rand[1] % 100).padStart(2, '0')
  return `${word}-${digits}`
}

export function normalizeCode(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) {
    binary += String.fromCharCode(b)
  }
  return btoa(binary)
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export async function deriveGroupKeys(code: string): Promise<GroupKeys> {
  const encoder = new TextEncoder()
  const normalized = normalizeCode(code)
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(normalized),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(KEY_SALT),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(normalized + TAG_SALT),
  )
  return { key, tag: toHex(digest).slice(0, 32) }
}

export async function encryptState(key: CryptoKey, state: MemberState): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = new TextEncoder().encode(JSON.stringify(state))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  const payload = new Uint8Array(iv.length + ciphertext.byteLength)
  payload.set(iv)
  payload.set(new Uint8Array(ciphertext), iv.length)
  return toBase64(payload)
}

function isMemberState(value: unknown): value is MemberState {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const v = value as Record<string, unknown>
  return (
    typeof v.name === 'string' &&
    typeof v.updatedAt === 'number' &&
    Array.isArray(v.favorites) &&
    v.favorites.every((id) => typeof id === 'string') &&
    (v.at === undefined || typeof v.at === 'string') &&
    (v.left === undefined || typeof v.left === 'boolean')
  )
}

export async function decryptState(key: CryptoKey, payload: string): Promise<MemberState | null> {
  try {
    const bytes = fromBase64(payload)
    const iv = bytes.slice(0, 12)
    const ciphertext = bytes.slice(12)
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
    const parsed: unknown = JSON.parse(new TextDecoder().decode(plaintext))
    return isMemberState(parsed) ? parsed : null
  } catch {
    return null
  }
}
