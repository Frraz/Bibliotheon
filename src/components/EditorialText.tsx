import { RichText, type JSXConvertersFunction } from '@payloadcms/richtext-lexical/react'
import type { Ebook } from '../payload-types'
import { createElement } from 'react'

function plainText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const value = node as Record<string, unknown>
  if (typeof value.text === 'string') return value.text
  return Array.isArray(value.children) ? value.children.map(plainText).join('') : ''
}
export function TableOfContents({ data }: { data: Ebook['body'] }) {
  const headings = data?.root.children.flatMap((node, index) => node.type === 'heading' && (node.tag === 'h1' || node.tag === 'h2') ? [{ id: `secao-${index}`, title: plainText(node) }] : []) || []
  return headings.length >= 4 ? <nav className="table-of-contents" aria-label="Neste artigo"><h2>Neste artigo</h2><ol>{headings.map(item => <li key={item.id}><a href={`#${item.id}`}>{item.title}</a></li>)}</ol></nav> : null
}

function safeHref(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  if (/^\/(?!\/)/.test(value) || /^#[a-zA-Z0-9_-]+$/.test(value)) return value
  try { const url = new URL(value); if (url.protocol === 'https:' || url.protocol === 'mailto:') return value } catch { /* render as text */ }
}
const converters: JSXConvertersFunction = ({ defaultConverters }) => ({
  ...defaultConverters,
  heading: ({ node, nodesToJSX, childIndex }) => createElement(['h2', 'h3', 'h4', 'h5', 'h6'].includes(node.tag) ? node.tag : 'h2', { id: `secao-${childIndex}` }, nodesToJSX({ nodes: node.children })),
  link: ({ node, nodesToJSX }) => {
    const href = safeHref(node.fields.url)
    const children = nodesToJSX({ nodes: node.children })
    return href ? <a href={href} target={node.fields.newTab ? '_blank' : undefined} rel={node.fields.newTab ? 'noopener noreferrer' : undefined}>{children}</a> : <>{children}</>
  },
  autolink: ({ node, nodesToJSX }) => {
    const href = safeHref(node.fields.url)
    const children = nodesToJSX({ nodes: node.children })
    return href ? <a href={href}>{children}</a> : <>{children}</>
  },
  upload: () => null,
  relationship: () => null,
  unknown: () => null,
})
export function EditorialText({ data }: { data: Ebook['body'] }) {
  return data ? <RichText className="prose" data={data} converters={converters} /> : null
}
