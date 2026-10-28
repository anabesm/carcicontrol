# Backend do CarciControl

API em Express e TypeScript, com Prisma 6 e PostgreSQL.

## Requisitos

- Node.js 22.18+ ou 24.12+; recomendado Node.js 24 LTS.
- npm e Docker Desktop com suporte a containers Linux, ou PostgreSQL instalado.
- Execute os comandos desta página na pasta `backend`.

Confira `node --version` antes de instalar. Node.js 14 não é compatível.

## Configuração local

No PowerShell:

```powershell
Copy-Item .env.example .env
```

Defina uma senha local em `POSTGRES_PASSWORD` e atualize a mesma senha em
`DATABASE_URL`. Caracteres especiais na URL devem ser codificados como URL.
O arquivo `.env` não é versionado.

```powershell
npm ci
npm run db:start
npm run db:migrate
npm run dev
```

O PostgreSQL do Docker usa a porta local `5433` e um volume persistente. Para
utilizar outro PostgreSQL, configure `DATABASE_URL` e pule `npm run db:start`.

O Prisma Client é gerado na instalação. Para gerar novamente:

```powershell
npm run db:generate
```

## Verificação

```powershell
npm run db:validate
npm run db:status
npm run type-check
npm test
Invoke-RestMethod http://127.0.0.1:3000/health
```

`GET /health` consulta o PostgreSQL e responde `200` com
`{"status":"ok","database":"up"}`. Se a conexão falhar durante a execução,
responde `503` com `{"status":"error","database":"down"}`. A API só abre a
porta depois de conseguir conectar ao banco.

Para executar o JavaScript compilado:

```powershell
npm run build
npm start
```

`HOST` e `PORT` controlam o endereço da API. Os padrões são `127.0.0.1:3000`.
`npm run db:stop` para o container sem remover os dados.

## Migrations e dados existentes

`npm run db:migrate` aplica as migrations pendentes; não redefine o banco.
A migration inicial reproduz o schema existente do projeto.

Se o banco já possui tabelas e ainda não tem histórico do Prisma Migrate, não
aplique a inicial diretamente nem execute reset. Primeiro faça backup e compare
o banco com o schema usando uma consulta que não altera os dados:

```powershell
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code
```

Prossiga somente se não houver diferenças e o comando terminar com código `0`.
Nesse caso, registre a inicial como aplicada:

```powershell
npx prisma migrate resolve --applied 0_init
npm run db:status
```

Esse comando registra o histórico sem recriar as tabelas. Não use `migrate reset`,
`db push --force-reset` nem remova o volume para configurar um banco existente.
