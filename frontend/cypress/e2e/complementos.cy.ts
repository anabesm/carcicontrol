function field(label: string, value: string) {
  return cy
    .contains('label', label)
    .invoke('attr', 'for')
    .then((id) => cy.get(`#${id}`).clear().type(value))
}
function login() {
  return cy.env<{ admin: string; password: string }>(['admin', 'password']).then((credentials) =>
    cy.request({
      method: 'POST',
      url: '/api/auth/login',
      body: { email: credentials.admin, senha: credentials.password },
      log: false,
    }),
  )
}
function createCycle() {
  return cy
    .env<{ prefix: string }>(['prefix'])
    .then(({ prefix }) =>
      cy.request('POST', '/api/viveiros', {
        identificador: `${prefix}-${Date.now()}`,
        area: 10000,
        profundidadeMedia: 1.5,
      }),
    )
    .then((result) => {
      const pond = result.body.viveiro
      return cy
        .request('POST', `/api/viveiros/${pond.id}/ciclos`, {
          dataInicio: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
          qtdLarvasInicial: 100000,
        })
        .then((opened) => ({ pond, cycle: opened.body.ciclo }))
    })
}
describe('Configurações e complementos do cultivo', () => {
  it('configura fase e horário e resolve uma anomalia preservando o histórico', () => {
    login()
    createCycle().then(({ pond, cycle }) => {
      cy.request('/api/parametros/catalogo').then((catalog) => {
        const oxygen = catalog.body.parametros.find((p: { codigo: string }) => p.codigo === 'OD')
        cy.visit('/faixas')
        cy.contains('button', 'Nova faixa').click()
        cy.get('form')
          .first()
          .within(() => {
            cy.get('select[name="viveiroId"]').select(String(pond.id))
            cy.get('select[name="parametroId"]').select(String(oxygen.id))
            field('Mínimo ideal', '6')
            field('Máximo ideal', '8')
            cy.contains('label', 'Aplicar a uma fase').find('input').check()
            field('Nome da fase', 'Fase de teste E2E')
            field('Dia final', '30')
            cy.contains('label', 'Faixa demonstrativa').find('input').check()
            cy.contains('button', 'Salvar faixa').click()
          })
        cy.contains('Faixa salva.').should('be.visible')
        cy.reload()
        cy.contains('Fase de teste E2E').should('be.visible')
        cy.visit('/rotina')
        cy.contains('button', 'Novo horário').click()
        cy.get('form')
          .first()
          .within(() => {
            cy.get('select[name="viveiroId"]').select(String(pond.id))
            cy.get('select[name="parametroId"]').select(String(oxygen.id))
            field('Tolerância', '30')
            cy.contains('button', 'Salvar horário').click()
          })
        cy.contains('Horário salvo.').should('be.visible')
        cy.request('POST', '/api/medicoes', {
          cicloId: cycle.id,
          parametroId: oxygen.id,
          valor: 4,
          unidade: 'mg/L',
          medidoEm: new Date(Date.now() - 60000).toISOString(),
          confirmarAnomalia: true,
        })
        cy.visit(`/medicoes?viveiroId=${pond.id}&cicloId=${cycle.id}`)
        cy.contains('button', 'Resolver').click()
        cy.get('dialog.confirm-dialog')
          .should('be.visible')
          .within(() => {
            field('Justificativa', 'Aerador ajustado e leitura conferida')
            cy.contains('button', 'Confirmar').click()
          })
        cy.contains('.measurement-alert-list', 'Resolvido').should('be.visible')
        cy.reload()
        cy.contains('.measurement-alert-list', 'Aerador ajustado').should('be.visible')
      })
    })
  })
  it('edita, inativa e reativa funcionário pela interface', () => {
    login()
    cy.env<{ prefix: string; password: string }>(['prefix', 'password']).then(
      ({ prefix, password }) => {
        cy.request('POST', '/api/usuarios', {
          nome: 'Equipe de teste',
          email: `${prefix}-gestao@example.test`,
          senha: password,
        }).then((result) => {
          cy.visit(`/funcionarios/${result.body.usuario.id}/editar`)
          field('Nome', 'Equipe atualizada')
          cy.contains('button', 'Salvar alterações').click()
          cy.contains('Dados atualizados.').should('be.visible')
          cy.contains('button', 'Inativar funcionário').click()
          cy.get('dialog.confirm-dialog').within(() => cy.contains('button', 'Confirmar').click())
          cy.contains('button', 'Ativar funcionário').should('be.visible').click()
          cy.get('dialog.confirm-dialog').within(() => cy.contains('button', 'Confirmar').click())
          cy.contains('button', 'Inativar funcionário').should('be.visible')
          cy.reload()
          cy.get('input').first().should('have.value', 'Equipe atualizada')
        })
      },
    )
  })
  it('recupera a senha por um link entregue na caixa local e invalida a senha anterior', () => {
    cy.env<{ employee: string; password: string }>(['employee', 'password']).then(
      ({ employee, password }) => {
        cy.visit('/recuperar-senha')
        field('E-mail', employee)
        cy.contains('button', 'Enviar instruções').click()
        cy.contains('Se o endereço estiver cadastrado e ativo').should('be.visible')
        function findMessage(attempt = 0): Cypress.Chainable<string> {
          return cy
            .request({ url: 'http://127.0.0.1:8025/api/v1/messages', log: false })
            .then((result) => {
              const message = result.body.messages.find((m: { To: { Address: string }[] }) =>
                m.To.some((to) => to.Address === employee),
              )
              if (message) return cy.wrap(String(message.ID), { log: false })
              if (attempt >= 20)
                throw new Error('O e-mail de recuperação não chegou à caixa local.')
              return cy.wait(250, { log: false }).then(() => findMessage(attempt + 1))
            })
        }
        findMessage()
          .then((id) =>
            cy.request({ url: `http://127.0.0.1:8025/api/v1/message/${id}`, log: false }),
          )
          .then((result) => {
            const link = result.body.Text.match(
              /http:\/\/127\.0\.0\.1:4173\/redefinir-senha#token=[a-f0-9]{64}/,
            )?.[0]
            expect(Boolean(link), 'link de recuperação local').to.equal(true)
            cy.visit(link, { log: false })
            field('Nova senha', 'NovaSenhaLocal123')
            field('Confirmar nova senha', 'NovaSenhaLocal123')
            cy.contains('button', 'Salvar nova senha').click()
            cy.contains('Senha redefinida.').should('be.visible')
            cy.request({
              method: 'POST',
              url: '/api/auth/login',
              body: { email: employee, senha: password },
              failOnStatusCode: false,
              log: false,
            })
              .its('status')
              .should('equal', 401)
            cy.request({
              method: 'POST',
              url: '/api/auth/login',
              body: { email: employee, senha: 'NovaSenhaLocal123' },
              log: false,
            })
              .its('status')
              .should('equal', 200)
            login()
            cy.request('/api/usuarios').then((users) => {
              const user = users.body.usuarios.find(
                (row: { email: string }) => row.email === employee,
              )
              cy.request({
                method: 'POST',
                url: `/api/usuarios/${user.id}/senha`,
                body: { senha: password },
                log: false,
              })
            })
          })
      },
    )
  })
  it('mostra configuração pendente do WhatsApp e permite prévia sem mensagens reais', () => {
    login()
    cy.visit('/whatsapp')
    cy.contains('Integração ainda não configurada').should('be.visible')
    cy.contains('button', 'Enviar para contatos ativos').should('be.disabled')
    cy.contains('button', 'Gerar prévia').click()
    cy.get('.summary-preview').should('contain.text', 'CarciControl')
    cy.contains('button', 'Novo contato').click()
    cy.env<{ prefix: string }>(['prefix']).then(({ prefix }) => {
      field('Nome do contato', `${prefix} contato`)
      field('País + DDD', `5585${String(Date.now()).slice(-9)}`)
      cy.contains('label', 'autorizou o recebimento').find('input').check()
      cy.contains('button', 'Salvar contato').click()
      cy.contains('Contato salvo.').should('be.visible')
    })
  })
  it('apresenta as áreas em computador e celular sem ultrapassar a largura da página', () => {
    login()
    createCycle().then(({ pond, cycle }) => {
      const pages = [
        ['inicio', '/', '/api/indicadores/resumo*'],
        ['viveiros', '/viveiros', '/api/viveiros'],
        ['medicoes', `/medicoes?viveiroId=${pond.id}&cicloId=${cycle.id}`, '/api/medicoes*'],
        ['ocorrencias', '/eventos', '/api/eventos*'],
        ['despesas', '/despesas', '/api/despesas*'],
        ['vendas', '/vendas', '/api/vendas*'],
        ['equipe', '/funcionarios', '/api/usuarios'],
        ['rotina', '/rotina', '/api/rotinas/pendencias*'],
        ['parametros', '/faixas', '/api/faixas'],
        ['relatorios', '/relatorios', '/api/relatorios*'],
        ['whatsapp', '/whatsapp', '/api/whatsapp/envios*'],
        ['detalhes', `/viveiros/${pond.id}`, `/api/viveiros/${pond.id}`],
        ['editar-viveiro', `/viveiros/${pond.id}/editar`, `/api/viveiros/${pond.id}`],
        [
          'encerrar-ciclo',
          `/viveiros/${pond.id}/ciclos/${cycle.id}/encerrar`,
          `/api/viveiros/${pond.id}`,
        ],
      ]
      for (const device of ['desktop', 'celular']) {
        cy.viewport(device === 'desktop' ? 1440 : 390, device === 'desktop' ? 1000 : 844)
        for (const [name, route, endpoint] of pages) {
          cy.intercept('GET', endpoint).as('pageData')
          cy.visit(route)
          cy.wait('@pageData').its('response.statusCode').should('equal', 200)
          cy.get('h1').should('be.visible')
          cy.contains('Carregando', { timeout: 10000 }).should('not.exist')
          cy.document().then((doc) =>
            expect(doc.documentElement.scrollWidth, `${device}: ${name}`).to.be.at.most(
              device === 'desktop' ? 1441 : 391,
            ),
          )
          cy.screenshot(`${device}-${name}`, { capture: 'viewport' })
        }
      }
      cy.contains('.mobile-nav button', 'Mais').click()
      cy.get('#more-navigation')
        .should('be.visible')
        .within(() => {
          cy.contains('a', 'Relatórios').click()
        })
      cy.location('pathname').should('equal', '/relatorios')
      cy.get('#more-navigation').should('not.be.visible')
      cy.contains('.mobile-nav button', 'Mais').click()
      cy.screenshot('celular-menu', { capture: 'viewport' })
      cy.get('[aria-label="Fechar menu"]').click()
    })
  })
})
