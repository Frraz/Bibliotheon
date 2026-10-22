import path from 'node:path'
export const mediaDirectory = () => path.resolve(process.env.MEDIA_DIR || path.join(process.cwd(), 'uploads'))
