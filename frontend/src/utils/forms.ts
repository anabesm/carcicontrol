export function emailError(value: string): string {
  if (!value.trim()) return 'Informe o e-mail.'
  if (value.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
    return 'Informe um e-mail válido.'
  return ''
}

export function passwordError(value: string, minimum = 1): string {
  if (!value) return 'Informe a senha.'
  if (value.length < minimum || value.length > 128) return `Use entre ${minimum} e 128 caracteres.`
  return ''
}
