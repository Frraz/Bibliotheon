import next from 'eslint-config-next/core-web-vitals'
import ts from 'eslint-config-next/typescript'
const config = [...next, ...ts, { ignores: ['.next/**', '.next-*/**', '.local/**', '.release/**', 'artifacts/**', 'src/payload-types.ts', 'src/app/(payload)/admin/importMap.js'] }]
export default config
