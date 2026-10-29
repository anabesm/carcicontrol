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
`DATABASE_URL` e `TEST_DATABASE_URL`. Caracteres especiais na URL devem ser codificados como URL.
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

## Autenticação e funcionários

As sessões são persistidas no PostgreSQL. O login envia o cookie
`carcicontrol_session` com `HttpOnly`, `SameSite=Lax` e validade de oito horas.
Em produção, o cookie também exige HTTPS (`Secure`). O logout remove a sessão
do servidor e invalida o cookie anterior. O banco armazena apenas o hash do token
da sessão. O perfil e a situação do usuário são consultados no servidor a cada
requisição autenticada.

| Método | Rota | Acesso | Corpo JSON |
| --- | --- | --- | --- |
| POST | `/auth/login` | Público | `email`, `senha` |
| GET | `/auth/me` | Autenticado | — |
| POST | `/auth/logout` | Autenticado | — |
| GET | `/usuarios` | Administrador | — |
| POST | `/usuarios` | Administrador | `nome`, `email`, `senha`, `telefone` opcional |

As respostas de login, consulta e cadastro usam `{ "usuario": ... }`; a listagem
usa `{ "usuarios": [...] }` e inclui somente funcionários. Nenhuma resposta
inclui senha ou hash. O cadastro define o perfil `FUNCIONARIO`, situação `ATIVO`
e administrador responsável no servidor. Campos extras como `perfil` são
rejeitados. E-mails são normalizados, senhas de cadastro têm entre 8 e 128
caracteres e são armazenadas com scrypt e salt exclusivo.

Erros usam `{ "error": "mensagem" }`, com `400` para dados inválidos, `401` para
credenciais/sessão inválidas, `403` para falta de permissão e `409` para e-mail já
cadastrado. O logout bem-sucedido responde `204`. O cliente deve conservar o
cookie recebido e fazer as requisições pela mesma origem da aplicação.

### Administrador de demonstração

Defina `DEMO_ADMIN_NAME`, `DEMO_ADMIN_EMAIL` e `DEMO_ADMIN_PASSWORD` no `.env` local.
Depois de aplicar as migrations, execute explicitamente:

```powershell
npm run db:seed:demo
```

O comando cria somente a conta inicial de administrador. Se o administrador já
existir, preserva seus dados, situação e senha. Se o e-mail pertencer a um
funcionário, recusa a criação sem alterar seu perfil. Não há seed automático na
inicialização da API, nem recuperação de senha ou edição de usuários nesta versão.

### Testes de integração

Os testes comuns (`npm test`) verificam o endpoint de saúde, o hash das senhas e
a validação de viveiros e povoamento.
Para os testes com PostgreSQL, crie uma vez o banco separado de testes:

```powershell
docker compose exec db createdb -U carcicontrol carcicontrol_test
npm run test:integration
```

Se o banco já existir, reutilize-o. Configure `TEST_DATABASE_URL` para esse banco
antes de executar. A suíte exige um nome terminado em `_test`, recusa o banco da
aplicação, aplica as migrations e cria usuários com identificadores exclusivos.
Ao terminar, remove somente os usuários, sessões, viveiros e ciclos que criou.

Os testes cobrem credenciais incorretas, sessão ausente/expirada, permissões,
cadastro concorrente, respostas sem senhas, inativação, logout e seed repetido.
Também verificam permissões de viveiros, histórico, identificadores equivalentes,
oito aberturas simultâneas no mesmo viveiro e reversão da ocupação em caso de falha.

## Viveiros e ciclos

| Método | Rota | Acesso | Corpo JSON |
| --- | --- | --- | --- |
| GET | `/viveiros` | Administrador e funcionário | — |
| GET | `/viveiros/:id` | Administrador e funcionário | — |
| POST | `/viveiros` | Administrador | `identificador`, `area`, `profundidadeMedia`, `localizacao` opcional |
| POST | `/viveiros/:id/ciclos` | Administrador | `dataInicio`, `qtdLarvasInicial`, `fornecedorLarvas` e `previsaoDespesca` opcionais |

O cadastro do viveiro responde `201` com `{ "viveiro": ... }` e define a situação
`DISPONIVEL` no servidor. Área e profundidade média devem ser números positivos;
o identificador admite até 80 caracteres e a localização até 240. Identificadores
equivalentes por maiúsculas/minúsculas ou espaços nas extremidades são duplicados
e retornam `409`. Os textos dos registros existentes são preservados.

A listagem usa `{ "viveiros": [...] }`, ordenada por identificador e ID. Cada
item inclui os dados do viveiro, `cicloAtivo` (ou `null`) e `totalCiclos`. O detalhe
usa `{ "viveiro": ... }` e inclui também `ciclos`, com todo o histórico em ordem
decrescente de início e, em caso de empate, de ID. Ciclos finalizados e cancelados
continuam disponíveis para consulta.

Exemplo de abertura de ciclo:

```json
{
  "dataInicio": "2026-10-28",
  "qtdLarvasInicial": 120000,
  "fornecedorLarvas": "Fornecedor de demonstração",
  "previsaoDespesca": "2027-02-28"
}
```

As datas de entrada usam `AAAA-MM-DD` e são armazenadas à meia-noite UTC. A
previsão não pode anteceder o início. A quantidade de larvas deve ser um inteiro
entre 1 e 2147483647; o fornecedor admite até 160 caracteres. Campos extras,
incluindo `status`, `viveiroId` ou `criadoPor`, são rejeitados. A resposta `201`
usa `{ "ciclo": ... }`; a autoria vem da sessão e a situação inicial é `ATIVO`.

Somente um viveiro `DISPONIVEL` e sem ciclo ativo pode iniciar um ciclo. A abertura
disputa a linha do viveiro por atualização condicional e grava `OCUPADO` junto
com o novo ciclo em uma única transação. O índice único parcial do PostgreSQL
também impede dois ciclos ativos no mesmo viveiro, inclusive em gravações que
não passem pela API. Várias solicitações simultâneas produzem uma única abertura;
as demais recebem `409`. Falhas na gravação desfazem a alteração de ocupação.

IDs inválidos retornam `400`; viveiros inexistentes, `404`; ausência de sessão,
`401`; e operações administrativas feitas por funcionário, `403`. Edição,
inativação e encerramento de ciclos ficam para as próximas etapas.

## Migrations e dados existentes

`npm run db:migrate` aplica as migrations pendentes; não redefine o banco.
A migration inicial reproduz o schema existente do projeto.

A migration `20261028010000_viveiros_ciclos_constraints` adiciona os índices de
identificador normalizado, ciclo ativo único e histórico de ciclos. Os dois
primeiros são definidos em SQL porque o Prisma 6 não os representa no schema.
A migration não altera registros e executa os índices na mesma transação. Se já
houver identificadores equivalentes ou múltiplos ciclos ativos em um viveiro, ela
falha preservando os dados; essas inconsistências precisam ser revisadas antes
de tentar aplicá-la novamente. Use migrations para manter essas restrições.

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
