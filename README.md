# CarciControl

Aplicação web responsiva para gestão de viveiros e ciclos de cultivo de camarão.

Requisitos: Node.js 24 LTS, npm e Docker Desktop com containers Linux.

No primeiro uso, configure `backend/.env` a partir de `backend/.env.example`.
Defina a senha do PostgreSQL e as credenciais locais de demonstração.

Em um terminal na pasta `backend`:

```powershell
npm ci
npm run db:start
npm run db:migrate
npm run db:seed:demo
npm run db:seed:medicoes
npm run dev
```

Em outro terminal na pasta `frontend`:

```powershell
npm ci
npm run dev
```

Abra `http://127.0.0.1:5173`. Os detalhes de configuração e testes estão nos
READMEs de cada pasta. O banco utiliza volume persistente. Não remova o volume
nem execute reset para reiniciar o projeto.

Para acrescentar exemplos fictícios de cultivo, execute explicitamente na pasta
`backend`:

```powershell
npm run db:seed:cultivo
```

O comando cria três viveiros identificados por `DEMO`, com cultivo ativo, venda
e perda total. Uma nova execução preserva os exemplos e todos os dados existentes.
