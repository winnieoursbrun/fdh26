import { describe, expect, it } from 'vitest'
import {
  CODE_WORDS,
  decryptState,
  deriveGroupKeys,
  encryptState,
  generateGroupCode,
  normalizeCode,
  type MemberState,
} from './group'

const SAMPLE: MemberState = {
  name: 'Léa',
  favorites: ['ev-1', 'ev-3'],
  updatedAt: 1000,
}

describe('normalizeCode', () => {
  it('met en majuscules et remplace les séparateurs', () => {
    expect(normalizeCode('averse 42')).toBe('AVERSE-42')
    expect(normalizeCode('  averse--42 ')).toBe('AVERSE-42')
  })

  it('retire les accents', () => {
    expect(normalizeCode('éclair-07')).toBe('ECLAIR-07')
  })
})

describe('generateGroupCode', () => {
  it('produit un code MOT-NN issu de la wordlist', () => {
    const code = generateGroupCode()
    const [word, digits] = code.split('-')
    expect(CODE_WORDS).toContain(word)
    expect(digits).toMatch(/^\d{2}$/)
    expect(normalizeCode(code)).toBe(code)
  })
})

describe('deriveGroupKeys', () => {
  it('est déterministe pour un même code, quel que soit le format saisi', async () => {
    const a = await deriveGroupKeys('AVERSE-42')
    const b = await deriveGroupKeys('averse 42')
    expect(a.tag).toBe(b.tag)
    expect(a.tag).toHaveLength(32)
  })

  it('donne des tags différents pour des codes différents', async () => {
    const a = await deriveGroupKeys('AVERSE-42')
    const b = await deriveGroupKeys('AVERSE-43')
    expect(a.tag).not.toBe(b.tag)
  })
})

describe('encryptState / decryptState', () => {
  it('fait un aller-retour complet', async () => {
    const { key } = await deriveGroupKeys('AVERSE-42')
    const payload = await encryptState(key, SAMPLE)
    expect(await decryptState(key, payload)).toEqual(SAMPLE)
  })

  it('rend null avec la clé d’un autre groupe', async () => {
    const { key } = await deriveGroupKeys('AVERSE-42')
    const other = await deriveGroupKeys('TONNERRE-07')
    const payload = await encryptState(key, SAMPLE)
    expect(await decryptState(other.key, payload)).toBeNull()
  })

  it('rend null sur un payload corrompu ou mal formé', async () => {
    const { key } = await deriveGroupKeys('AVERSE-42')
    expect(await decryptState(key, 'pas-du-base64!!')).toBeNull()
    expect(await decryptState(key, btoa('trop court'))).toBeNull()
  })

  it('accepte le tombstone left: true (quitte le groupe)', async () => {
    const { key } = await deriveGroupKeys('AVERSE-42')
    const tombstone: MemberState = { name: 'Max', favorites: [], updatedAt: 2000, left: true }
    const payload = await encryptState(key, tombstone)
    expect(await decryptState(key, payload)).toEqual(tombstone)
  })

  it('rend null si left a un type invalide', async () => {
    const { key } = await deriveGroupKeys('AVERSE-42')
    const malformed = { name: 'Max', favorites: [], updatedAt: 2000, left: 'yes' }
    const payload = await encryptState(key, malformed as unknown as MemberState)
    expect(await decryptState(key, payload)).toBeNull()
  })

  it('conserve la présence at au roundtrip', async () => {
    const { key } = await deriveGroupKeys('AVERSE-42')
    const withPresence: MemberState = { ...SAMPLE, at: 'miossec-ven-2135' }
    const payload = await encryptState(key, withPresence)
    expect(await decryptState(key, payload)).toEqual(withPresence)
  })

  it('rend null si at a un type invalide', async () => {
    const { key } = await deriveGroupKeys('AVERSE-42')
    const malformed = { name: 'Max', favorites: [], updatedAt: 2000, at: 42 }
    const payload = await encryptState(key, malformed as unknown as MemberState)
    expect(await decryptState(key, payload)).toBeNull()
  })
})
