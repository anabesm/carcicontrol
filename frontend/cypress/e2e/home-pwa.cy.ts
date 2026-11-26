function signIn(role: 'admin' | 'employee' = 'admin') {
  return cy
    .env<{ admin: string; employee: string; password: string }>(['admin', 'employee', 'password'])
    .then((credentials) =>
      cy.request({
        method: 'POST',
        url: '/api/auth/login',
        body: { email: credentials[role], senha: credentials.password },
        log: false,
      }),
    )
}

describe('Início e instalação do aplicativo', () => {
  it('oferece atalhos diretos e mantém os gráficos na área de indicadores', () => {
    signIn()
    cy.visit('/')
    cy.contains('h1', 'Olá,').should('be.visible')
    cy.contains('Acessos rápidos').should('be.visible')
    cy.contains('Aplicar filtros').should('not.exist')
    cy.contains('h2', 'Financeiro do período').should('not.exist')
    cy.contains('.home-shortcuts a', 'Registrar despesa').click()
    cy.get('form').first().should('be.visible')
    cy.contains('h2', 'Nova despesa').should('be.visible')
    cy.visit('/')
    cy.contains('.home-indicators-link', 'Indicadores do cultivo').click()
    cy.location('pathname').should('equal', '/indicadores')
    cy.contains('Evolução das medições').should('be.visible')
  })
  it('adapta os atalhos ao funcionário e mantém a sessão no celular', () => {
    signIn('employee')
    cy.viewport(390, 844)
    cy.visit('/')
    cy.contains('.home-shortcuts a', 'Registrar medição').should('be.visible')
    cy.contains('.home-shortcuts a', 'Registrar despesa').should('not.exist')
    cy.reload()
    cy.contains('h1', 'Olá,').should('be.visible')
    cy.document().then((doc) => expect(doc.documentElement.scrollWidth).to.be.at.most(391))
    cy.screenshot('inicio-funcionario-celular', { capture: 'viewport' })
  })
  it('calcula as barras com medições registradas e a previsão real do ciclo', () => {
    signIn()
    cy.env<{ prefix: string }>(['prefix']).then(({ prefix }) => {
      cy.request('POST', '/api/viveiros', {
        identificador: `${prefix}-progresso`,
        area: 10000,
        profundidadeMedia: 1.5,
      }).then((pondResponse) => {
        const pond = pondResponse.body.viveiro
        cy.request('POST', `/api/viveiros/${pond.id}/ciclos`, {
          dataInicio: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
          qtdLarvasInicial: 100000,
          previsaoDespesca: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        }).then((cycleResponse) => {
          const cycle = cycleResponse.body.ciclo
          cy.request('/api/parametros/catalogo').then((catalog) => {
            const oxygen = catalog.body.parametros.find(
              (p: { codigo: string }) => p.codigo === 'OD',
            )
            const horario = new Intl.DateTimeFormat('en-GB', {
              timeZone: 'America/Sao_Paulo',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }).format(new Date())
            cy.request('POST', '/api/rotinas', {
              viveiroId: pond.id,
              parametroId: oxygen.id,
              horario,
              fuso: 'America/Sao_Paulo',
              toleranciaMinutos: 30,
            })
            cy.request('POST', '/api/medicoes', {
              cicloId: cycle.id,
              parametroId: oxygen.id,
              valor: 6,
              unidade: 'mg/L',
              medidoEm: new Date().toISOString(),
            })
            cy.visit('/')
            cy.get('[role="progressbar"][aria-label="Medições realizadas hoje"]').should(
              'have.attr',
              'aria-valuenow',
              '1',
            )
            cy.visit(`/viveiros/${pond.id}`)
            cy.get('[role="progressbar"][aria-label="Prazo até a despesca prevista"]').should(
              'have.attr',
              'aria-valuemax',
              '31',
            )
            cy.contains('Despesca prevista:').should('be.visible')
          })
        })
      })
    })
  })
  it('disponibiliza o manifesto e a instalação sem armazenar dados da API', () => {
    signIn()
    cy.visit('/')
    cy.get('link[rel="manifest"]')
      .invoke('attr', 'href')
      .then((path) => {
        expect(path).to.match(/^\/manifest-[a-f0-9]{12}\.webmanifest$/)
        cy.request(String(path)).then((response) => {
          const manifest =
            typeof response.body === 'string' ? JSON.parse(response.body) : response.body
          expect(manifest.id).to.equal('/')
          expect(manifest.display).to.equal('standalone')
          expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).to.include.members([
            '192x192',
            '512x512',
          ])
          for (const icon of manifest.icons) {
            expect(icon.src).to.match(/^\/icons\/app-(192|512)-[a-f0-9]{12}\.png$/)
            cy.request(icon.src).its('status').should('equal', 200)
          }
        })
      })
    cy.window({ timeout: 20000 }).its('navigator.serviceWorker.controller').should('not.be.null')
    cy.window().then(async (win) => {
      const keys = await win.caches.keys()
      expect(keys.some((key) => key.startsWith('carcicontrol-static-'))).to.equal(true)
      for (const key of keys.filter((key) => key.startsWith('carcicontrol-static-'))) {
        const requests = await (await win.caches.open(key)).keys()
        expect(
          requests.some((request) => new URL(request.url).pathname.startsWith('/api')),
        ).to.equal(false)
        expect(
          requests.some((request) => new URL(request.url).pathname === '/offline.html'),
        ).to.equal(true)
      }
    })
    cy.window().then((win) => {
      const event = new win.Event('beforeinstallprompt', { cancelable: true })
      const prompt = cy.stub().as('installPrompt')
      prompt.resolves()
      Object.defineProperties(event, {
        prompt: { value: prompt },
        userChoice: { value: Promise.resolve({ outcome: 'accepted' }) },
      })
      win.dispatchEvent(event)
    })
    cy.get('.sidebar').contains('button', 'Instalar aplicativo').click()
    cy.get('@installPrompt').should('have.been.calledOnce')
    cy.get('.sidebar').contains('button', 'Instalar aplicativo').should('not.exist')
  })
})
