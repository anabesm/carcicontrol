export function safeRedirect(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    [...value].some((character) => character.charCodeAt(0) < 32)
  )
    return '/'
  try {
    const target = new URL(value, 'http://carcicontrol.local')
    if (
      target.origin !== 'http://carcicontrol.local' ||
      ['/login', '/conexao'].includes(target.pathname)
    )
      return '/'
    return target.pathname + target.search + target.hash
  } catch {
    return '/'
  }
}
