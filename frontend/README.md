# Frontend do CarciControl

Interface em Vue, TypeScript e Vite. Requer Node.js 22.18+ ou 24.12+; recomendado Node.js 24 LTS.

Execute nesta pasta:

```powershell
npm ci
npm run dev
```

Abra `http://127.0.0.1:5173`. Inicie também o backend na porta `3000`.
Use a conta preparada pelo seed explícito de demonstração do backend.
As credenciais são as configuradas no `.env` local do backend; não há cadastro público.

O administrador pode consultar e cadastrar funcionários. O funcionário pode entrar
e navegar pelas áreas operacionais disponíveis. Os demais módulos serão integrados
nas próximas etapas.

## Configuração da API

As chamadas do navegador usam `/api`. O proxy do Vite encaminha para
`http://127.0.0.1:3000`, removendo o prefixo `/api`. Isso permite usar os cookies de
sessão pela mesma origem, sem armazenar tokens no navegador.
Ao abrir ou recarregar uma rota protegida, o frontend consulta `/auth/me`.
O perfil retornado pelo servidor define a navegação e as restrições de acesso.
Um erro 401 durante o uso retorna ao login com aviso de sessão expirada. Uma falha
de conexão permite tentar novamente, sem tratá-la como erro de credenciais.
O logout invalida a sessão no backend.

Os valores padrão funcionam sem `.env`. Para alterá-los, copie `.env.example`
para `.env` e configure `VITE_API_BASE_URL` e `API_PROXY_TARGET`. Em produção,
configure o servidor web para encaminhar `/api` ao backend e as demais rotas ao
`index.html` da aplicação.

## Estrutura

- `src/assets/main.css`: cores, espaçamentos, tipografia e estilos responsivos.
- `src/components/ui`: botões, campos, avisos, carregamento e estados vazios.
- `src/components/layout`: marca, cabeçalho e navegação.
- `src/config/navigation.ts`: seções e atalhos da aplicação.
- `src/services/api.ts`: cliente JSON com cookies e tratamento de erros HTTP.
- `src/stores/auth.ts`: usuário autenticado e ciclo da sessão.
- `src/views` e `src/router`: páginas e proteção das rotas por perfil.

## Verificação e compilação

```powershell
npm run type-check
npm run test:unit -- --run
npm run build
npm run preview
```

A prévia compilada abre na porta `4173` e também dispõe do proxy local da API.
Os testes verificam cookies, erros da API, restauração e encerramento da sessão,
restrições das rotas e retornos seguros após o login.
