import { createHmac } from 'node:crypto'

/** Shared lock identity for capture and suppression, including contacts not created yet. */
export const contactFingerprint = (email: string, secret: string) => createHmac('sha256', secret).update(`request:${email}`).digest('hex')
