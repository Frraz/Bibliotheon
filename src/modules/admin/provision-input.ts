export function parseProvisionInput(input: string): { email: string; password: string } {
  let value: unknown
  try { value = JSON.parse(input) } catch { throw new Error('Envie um JSON válido pelo canal privado de entrada.') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Informe e-mail e senha válidos.')
  const data = value as Record<string, unknown>
  if (Object.keys(data).some(key => !['email', 'password'].includes(key))) throw new Error('Informe apenas e-mail e senha.')
  if (typeof data.email !== 'string' || data.email.length > 254 || !/^[^\s<>@\x00-\x1f\x7f]+@[^\s<>@\x00-\x1f\x7f]+\.[^\s<>@\x00-\x1f\x7f]+$/.test(data.email) || typeof data.password !== 'string' || data.password.length < 16 || Buffer.byteLength(data.password) > 1024 || data.password.includes('\0')) throw new Error('E-mail válido e senha de pelo menos 16 caracteres, até 1024 bytes, necessários.')
  return { email: data.email.trim().toLowerCase(), password: data.password }
}
