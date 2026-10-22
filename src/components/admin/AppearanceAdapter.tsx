'use client'
import { useTheme } from '@payloadcms/ui'
import { useEffect, useRef, useState } from 'react'
import { appearanceKey, readAppearance, type Appearance } from '../../modules/appearance'

export function AppearanceAdapter({ children }: { children?: React.ReactNode }) {
  const { theme, setTheme } = useTheme()
  const [preference, setPreference] = useState<Appearance>('system')
  const expected = useRef<string | null>(null)
  const pending = useRef(true)
  const preferenceRef = useRef<Appearance>('system')
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const apply = (value: Appearance) => {
      setPreference(value)
      preferenceRef.current = value
      const resolved = value === 'system' ? (media.matches ? 'dark' : 'light') : value
      expected.current = resolved
      pending.current = true
      setTheme(resolved)
    }
    apply(readAppearance())
    const sync = () => apply(readAppearance())
    const systemChange = () => { if (preferenceRef.current === 'system') apply('system') }
    window.addEventListener('storage', sync)
    window.addEventListener('bibliotheon:appearance', sync)
    media.addEventListener('change', systemChange)
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('bibliotheon:appearance', sync); media.removeEventListener('change', systemChange) }
  }, [setTheme])
  useEffect(() => {
    if (!expected.current) return
    if (pending.current) { if (theme === expected.current) pending.current = false; return }
    if (theme === expected.current) return
    expected.current = theme
    setPreference(theme)
    preferenceRef.current = theme
    try { localStorage.setItem(appearanceKey, theme) } catch { /* provider retains preference */ }
  }, [theme])
  return <>{children}<div className="bibliotheon-appearance"><label>Aparência <select value={preference} onChange={(e) => {
    const value = e.target.value as Appearance
    setPreference(value)
    preferenceRef.current = value
    const resolved = value === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : value
    expected.current = resolved
    pending.current = true
    setTheme(resolved)
    try { localStorage.setItem(appearanceKey, value) } catch { /* memory fallback */ }
  }}><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Escuro</option></select></label></div></>
}
