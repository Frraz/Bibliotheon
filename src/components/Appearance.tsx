'use client'
import { useEffect, useState } from 'react'
import { readAppearance, saveAppearance, type Appearance } from '../modules/appearance'

export function AppearanceSelect() {
  const [preference, setPreference] = useState<Appearance>('system')
  useEffect(() => {
    const sync = () => {
      const value = readAppearance()
      setPreference(value)
      if (value === 'system') delete document.documentElement.dataset.theme
      else document.documentElement.dataset.theme = value
    }
    sync()
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  return <label className="appearance">Aparência<select value={preference} onChange={(e) => {
    const value = e.target.value as Appearance
    setPreference(value)
    if (value === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = value
    saveAppearance(value)
  }}><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Escuro</option></select></label>
}
