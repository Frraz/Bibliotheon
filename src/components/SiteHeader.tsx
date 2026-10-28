'use client'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AppearanceSelect } from './Appearance'

export function SiteHeader() {
  const pathname = usePathname()
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  return <header className="site-header"><div className="container header-inner">
    <Link className="brand" href="/" aria-label="Bibliotheon, início">Bibliotheon</Link>
    <nav className="site-nav desktop-nav" aria-label="Principal"><Link href="/ebooks" aria-current={pathname.startsWith('/ebooks') ? 'page' : undefined}>Catálogo</Link><Link href="/artigos" aria-current={pathname.startsWith('/artigos') ? 'page' : undefined}>Artigos</Link></nav>
    <button className="mobile-menu-trigger" aria-haspopup="dialog" aria-expanded={open} aria-controls="site-menu" onClick={() => { dialog.current?.showModal(); setOpen(true) }}>Menu</button>
    <AppearanceSelect />
    <dialog id="site-menu" className="menu-dialog" ref={dialog} onClose={() => setOpen(false)} aria-label="Menu de navegação"><div className="menu-dialog-heading"><span className="brand">Bibliotheon</span><button onClick={() => dialog.current?.close()}>Fechar menu</button></div><nav aria-label="Navegação móvel"><Link onClick={() => dialog.current?.close()} href="/ebooks">Catálogo de e-books</Link><Link onClick={() => dialog.current?.close()} href="/artigos">Artigos</Link><Link onClick={() => dialog.current?.close()} href="/sobre">Sobre a Bibliotheon</Link><Link onClick={() => dialog.current?.close()} href="/contato">Contato</Link></nav></dialog>
    <noscript><nav className="no-js-nav" aria-label="Navegação sem JavaScript"><Link href="/ebooks" prefetch={false}>Catálogo</Link> <Link href="/artigos" prefetch={false}>Artigos</Link></nav></noscript>
  </div></header>
}
