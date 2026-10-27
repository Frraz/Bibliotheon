import { withPayload } from '@payloadcms/next/withPayload'

export default withPayload({
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: 'standalone',
  poweredByHeader: false,
  agentRules: false,
  async headers() {
    return [{ source: '/(.*)', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ] }, { source: '/admin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Cache-Control', value: 'private, no-store' }] }, { source: '/preview/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Cache-Control', value: 'private, no-store' }] }, ...['/api/v1/admin/privacy/:path*', '/api/v1/admin/report-evidence', '/api/v1/admin/report-evidence/:path*', '/api/v1/admin/settlement-evidence', '/api/v1/admin/financial-costs', '/api/v1/admin/financial-report/:path*', '/amostras/confirmar', '/preferencias', '/api/v1/admin/imports', '/api/v1/admin/imports/:path*', '/api/v1/admin/catalog-resolutions', '/api/v1/admin/catalog-resolutions/:path*', '/api/v1/admin/transaction-resolutions', '/api/v1/admin/transaction-resolutions/:path*'].map(source => ({ source, headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Cache-Control', value: 'private, no-store' }, { key: 'Referrer-Policy', value: 'no-referrer' }] }))]
  },
})
