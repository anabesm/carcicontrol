export const currency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const decimal = (value: string) => Number(value.trim().replace(',', '.'))
export const dateTime = (value: string) => new Date(value).toLocaleString('pt-BR')
export const today = () => new Date().toLocaleDateString('en-CA')
export const localNow = () => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
export const queryString = (values: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value))
  })
  return query.toString()
}
