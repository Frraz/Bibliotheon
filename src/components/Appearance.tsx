'use client'
import { useEffect, useRef, useState } from 'react'
import { appearanceKey, readAppearance, saveAppearance, type Appearance } from '../modules/appearance'

const options: { value: Appearance; label: string; detail: string }[] = [
  { value: 'system', label: 'Sistema', detail: 'Acompanhar seu dispositivo' },
  { value: 'light', label: 'Claro', detail: 'Papel e tinta' },
  { value: 'dark', label: 'Escuro', detail: 'Leitura à noite' },
]
function ThemeIcon({ value }: { value: Appearance }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{value === 'light' ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5" /></> : value === 'dark' ? <path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z" /> : <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>}</svg>
}
export function AppearanceSelect() {
  const [preference, setPreference] = useState<Appearance>('system')
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const sync = () => {
      const value = readAppearance()
      setPreference(value)
      if (value === 'system') delete document.documentElement.dataset.theme
      else document.documentElement.dataset.theme = value
    }
    sync()
    const storage = (event: StorageEvent) => { if (event.key === appearanceKey || event.key === null) sync() }
    window.addEventListener('storage', storage)
    return () => window.removeEventListener('storage', storage)
  }, [])
  useEffect(() => {
    if (!open) return
    root.current?.querySelector<HTMLInputElement>('input:checked')?.focus()
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  return <div className="appearance" ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); trigger.current?.focus() }
  }}>
    <button ref={trigger} type="button" className="appearance-trigger" aria-label="Aparência" title={`Aparência: ${options.find(option => option.value === preference)?.label}`} aria-expanded={open} aria-controls="appearance-options" onClick={() => setOpen(value => !value)}><ThemeIcon value={preference} /></button>
    {open && <fieldset id="appearance-options" className="appearance-options"><legend>Aparência</legend>{options.map(option => <label key={option.value} className="appearance-option"><ThemeIcon value={option.value} /><span>{option.label}<small>{option.detail}</small></span><input type="radio" name="appearance" value={option.value} checked={preference === option.value} onChange={() => {
      setPreference(option.value)
      if (option.value === 'system') delete document.documentElement.dataset.theme
      else document.documentElement.dataset.theme = option.value
      saveAppearance(option.value)
    }} /></label>)}</fieldset>}
  </div>
}
