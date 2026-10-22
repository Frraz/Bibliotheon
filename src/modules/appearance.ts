export type Appearance = 'system' | 'light' | 'dark'
export const appearanceKey = 'bibliotheon:appearance:v1'
export const appearanceBootstrap = `(function(){try{var t=localStorage.getItem('bibliotheon:appearance:v1');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}})();`
export function readAppearance(): Appearance {
  try { const saved = localStorage.getItem(appearanceKey); return saved === 'light' || saved === 'dark' ? saved : 'system' } catch { return 'system' }
}
export function saveAppearance(value: Appearance) {
  try { localStorage.setItem(appearanceKey, value) } catch { /* preference remains in memory */ }
  const age = value === 'system' ? 0 : 31536000
  document.cookie = `payload-theme=${value === 'system' ? '' : value}; Max-Age=${age}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
}
