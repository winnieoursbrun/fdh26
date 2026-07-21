import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { usePackingList } from './usePackingList'

describe('usePackingList', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('démarre vide', () => {
    const { result } = renderHook(() => usePackingList())
    expect(result.current.checked.size).toBe(0)
  })

  it('coche puis décoche un item et persiste en localStorage', () => {
    const { result } = renderHook(() => usePackingList())

    act(() => {
      result.current.toggle('journee-gourde')
    })
    expect(result.current.checked.has('journee-gourde')).toBe(true)
    expect(JSON.parse(localStorage.getItem('pdj26-packing') ?? '[]')).toEqual(['journee-gourde'])

    act(() => {
      result.current.toggle('journee-gourde')
    })
    expect(result.current.checked.has('journee-gourde')).toBe(false)
    expect(JSON.parse(localStorage.getItem('pdj26-packing') ?? '[]')).toEqual([])
  })

  it('recharge l\'état coché depuis localStorage', () => {
    localStorage.setItem('pdj26-packing', JSON.stringify(['soir-frontale']))
    const { result } = renderHook(() => usePackingList())
    expect(result.current.checked.has('soir-frontale')).toBe(true)
  })
})
