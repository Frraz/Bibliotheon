'use client'
export default function ErrorPage({ retry }: { retry: () => void }) {
  return <div className="container hero"><h1>Não foi possível carregar esta página.</h1><p>Tente novamente em alguns instantes.</p><button onClick={retry}>Tentar novamente</button></div>
}
