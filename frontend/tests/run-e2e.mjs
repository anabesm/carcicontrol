import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const backend = resolve(frontend, '../backend')
const backendRequire = createRequire(resolve(backend, 'package.json'))
backendRequire('dotenv').config({ path: resolve(backend, '.env'), quiet: true })
const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.endsWith('_test'))
  throw new Error('Configure TEST_DATABASE_URL em um banco separado terminado em _test.')
if (process.env.DATABASE_URL) {
  const main = new URL(process.env.DATABASE_URL),
    test = new URL(url)
  if (main.host === test.host && main.pathname === test.pathname)
    throw new Error('O banco E2E deve ser diferente do banco da aplicação.')
}
const { PrismaClient } = backendRequire('@prisma/client')
const db = new PrismaClient({ datasourceUrl: url })
const prefix = `e2e-${randomUUID()}`
const password = `Teste-${randomUUID()}`
const adminEmail = `${prefix}-admin@example.test`,
  employeeEmail = `${prefix}-employee@example.test`
let api,
  site,
  failed = true
const newParams = [],
  newRanges = []
function start(args, cwd, env) {
  return spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}
async function waitFor(url, child) {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error('O servidor de testes terminou antes de iniciar.')
    try {
      if ((await fetch(url)).ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error('O servidor de testes não iniciou.')
}
async function stop(child) {
  if (!child || child.exitCode !== null) return
  child.kill()
  await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 3000))])
}
try {
  execFileSync(
    process.execPath,
    [resolve(backend, 'node_modules/typescript/lib/tsc.js'), '-p', 'tsconfig.json'],
    { cwd: backend, stdio: 'inherit', windowsHide: true },
  )
  execFileSync(
    process.execPath,
    [resolve(backend, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
    { cwd: backend, env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe', windowsHide: true },
  )
  const { hashPassword } = backendRequire('./dist/auth/password')
  const { seedDemoMedicoes } = backendRequire('./dist/demo/seed-medicoes')
  const hash = await hashPassword(password)
  const admin = await db.usuario.create({
    data: { nome: 'Administrador E2E', email: adminEmail, senha: hash, perfil: 'ADMINISTRADOR' },
  })
  await db.usuario.create({
    data: {
      nome: 'Funcionário E2E',
      email: employeeEmail,
      senha: hash,
      perfil: 'FUNCIONARIO',
      criadoPor: admin.id,
    },
  })
  const oldParams = await db.parametro.findMany({ select: { id: true } }),
    oldRanges = await db.faixaParametro.findMany({ select: { id: true } })
  await seedDemoMedicoes(db, admin.id)
  for (const p of await db.parametro.findMany({ select: { id: true } }))
    if (!oldParams.some((old) => old.id === p.id)) newParams.push(p.id)
  for (const r of await db.faixaParametro.findMany({ select: { id: true } }))
    if (!oldRanges.some((old) => old.id === r.id)) newRanges.push(r.id)
  api = start([resolve(backend, 'dist/server.js')], backend, {
    DATABASE_URL: url,
    HOST: '127.0.0.1',
    PORT: '3001',
    NODE_ENV: 'test',
    PUBLIC_APP_URL: 'http://127.0.0.1:4173',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: '1025',
    SMTP_SECURE: 'false',
    SMTP_USER: '',
    SMTP_PASSWORD: '',
    WHATSAPP_ACCESS_TOKEN: '',
    WHATSAPP_PHONE_NUMBER_ID: '',
    WHATSAPP_APP_SECRET: '',
    WHATSAPP_VERIFY_TOKEN: '',
  })
  await waitFor('http://127.0.0.1:3001/health', api)
  execFileSync(process.execPath, [resolve(frontend, 'node_modules/vite/bin/vite.js'), 'build'], {
    cwd: frontend,
    stdio: 'pipe',
    windowsHide: true,
    env: { ...process.env, NODE_ENV: 'production' },
  })
  site = start(
    [
      resolve(frontend, 'node_modules/vite/bin/vite.js'),
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      '4173',
      '--strictPort',
    ],
    frontend,
    { API_PROXY_TARGET: 'http://127.0.0.1:3001' },
  )
  await waitFor('http://127.0.0.1:4173', site)
  const { default: cypress } = await import('cypress')
  const result = await cypress.run({
    project: frontend,
    spec: process.env.E2E_SPEC || 'cypress/e2e/*.cy.ts',
    browser: process.env.E2E_BROWSER || 'electron',
    config: { baseUrl: 'http://127.0.0.1:4173', video: false },
    env: { admin: adminEmail, employee: employeeEmail, password, prefix },
  })
  failed = 'failures' in result || result.totalFailed > 0
} finally {
  await stop(site)
  await stop(api)
  const ponds = await db.viveiro.findMany({
    where: { identificador: { startsWith: prefix } },
    select: { id: true },
  })
  const ids = ponds.map((pond) => pond.id)
  await db.alerta.deleteMany({ where: { medicao: { ciclo: { viveiroId: { in: ids } } } } })
  await db.medicao.deleteMany({ where: { ciclo: { viveiroId: { in: ids } } } })
  await db.compraDespesa.deleteMany({ where: { viveiroId: { in: ids } } })
  await db.venda.deleteMany({ where: { viveiroId: { in: ids } } })
  await db.eventoOperacional.deleteMany({ where: { viveiroId: { in: ids } } })
  await db.cicloCultivo.deleteMany({ where: { viveiroId: { in: ids } } })
  await db.faixaParametro.deleteMany({ where: { viveiroId: { in: ids } } })
  const users = await db.usuario.findMany({
    where: { email: { startsWith: prefix } },
    select: { id: true },
  })
  await db.envioWhatsApp.deleteMany({
    where: { contato: { criadoPor: { in: users.map((user) => user.id) } } },
  })
  await db.contatoWhatsApp.deleteMany({
    where: { criadoPor: { in: users.map((user) => user.id) } },
  })
  await db.viveiro.deleteMany({ where: { id: { in: ids } } })
  await db.faixaParametro.deleteMany({ where: { id: { in: newRanges } } })
  await db.parametro.deleteMany({ where: { id: { in: newParams } } })
  await db.usuario.deleteMany({ where: { email: { startsWith: prefix } } })
  await db.$disconnect()
}
process.exitCode = failed ? 1 : 0
