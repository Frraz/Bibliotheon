'use client'
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="container hero"><h1>Não foi possível carregar esta página.</h1><p>Tente novamente em alguns instantes.</p><button onClick={reset}>Tentar novamente</button></div>
}
