function field(label: string, value: string) {
  return cy
    .contains('label', label)
    .invoke('attr', 'for')
    .then((id) => cy.get(`#${id}`).clear().type(value))
}
function login(employee = false) {
  return cy
    .env<{ admin: string; employee: string; password: string }>(['admin', 'employee', 'password'])
    .then((credentials) =>
      cy.request('POST', '/api/auth/login', {
        email: employee ? credentials.employee : credentials.admin,
        senha: credentials.password,
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
describe('Jornada integrada do cultivo', () => {
  it('registra ocorrência e despesa, encerra com venda e preserva os dados', () => {
    login()
    createCycle().then(({ pond, cycle }) => {
      cy.visit('/eventos')
      cy.contains('button', 'Nova ocorrência').click()
      cy.get('form')
        .first()
        .within(() => {
          cy.get('select[name="viveiroId"]').select(String(pond.id))
          cy.get('select[name="cicloId"]').select(String(cycle.id))
          field('Tipo', 'Revisão da bomba')
          cy.get('textarea').type('Ocorrência registrada pelo teste integrado.')
          cy.contains('button', 'Registrar ocorrência').click()
        })
      cy.contains('Ocorrência registrada.').should('be.visible')
      cy.reload()
      cy.contains('Revisão da bomba').should('be.visible')
      cy.visit('/despesas')
      cy.contains('button', 'Nova despesa').click()
      cy.get('form')
        .first()
        .within(() => {
          cy.get('select[name="viveiroId"]').select(String(pond.id))
          cy.get('select[name="cicloId"]').select(String(cycle.id))
          field('Descrição', 'Ração do teste integrado')
          field('Quantidade', '3')
          field('Valor unitário', '10,15')
          cy.contains('button', 'Salvar despesa').click()
        })
      cy.contains('Despesa registrada.').should('be.visible')
      cy.reload()
      cy.contains('Ração do teste integrado').should('be.visible')
      cy.visit(`/viveiros/${pond.id}`)
      cy.contains('a', 'Encerrar ciclo').click()
      field('Comprador', 'Comprador do teste integrado')
      field('Peso total', '2000')
      field('Preço por kg', '25,15')
      cy.contains('button', 'Revisar encerramento').click()
      cy.get('dialog')
        .should('be.visible')
        .within(() => cy.contains('button', 'Encerrar ciclo').click())
      cy.location('pathname').should('equal', `/viveiros/${pond.id}`)
      cy.reload()
      cy.contains('Disponível').should('be.visible')
      cy.contains('Venda / despesca').should('be.visible')
      cy.request(`/api/indicadores/resumo?cicloId=${cycle.id}`)
        .its('body.financeiro')
        .should('deep.include', { despesas: 30.45, receitas: 50300, saldoRegistrado: 50269.55 })
      cy.visit('/vendas')
      cy.contains('Comprador do teste integrado').should('be.visible')
    })
  })
  it('funcionário consulta e permanece autenticado ao recarregar, sem acesso administrativo', () => {
    login(true)
    cy.visit('/viveiros')
    cy.contains('h1', 'Viveiros').should('be.visible')
    cy.reload()
    cy.location('pathname').should('equal', '/viveiros')
    cy.visit('/despesas')
    cy.location('pathname').should('equal', '/acesso-negado')
    cy.request({ method: 'POST', url: '/api/eventos', body: {}, failOnStatusCode: false })
      .its('status')
      .should('equal', 403)
    cy.request('POST', '/api/auth/logout')
    cy.visit('/viveiros')
    cy.location('pathname').should('equal', '/login')
  })
  it('permite perda total em celular e exige justificativa', () => {
    cy.viewport(390, 844)
    login()
    createCycle().then(({ pond, cycle }) => {
      cy.visit(`/viveiros/${pond.id}/ciclos/${cycle.id}/encerrar`)
      cy.get('select[name="motivo"]').select('PERDA_TOTAL')
      field('Justificativa', 'Mortalidade total observada no cultivo')
      cy.contains('button', 'Revisar encerramento').click()
      cy.get('dialog')
        .should('be.visible')
        .within(() => cy.contains('button', 'Encerrar ciclo').click())
      cy.location('pathname').should('equal', `/viveiros/${pond.id}`)
      cy.contains('Disponível').should('be.visible')
      cy.contains('Perda total').should('be.visible')
      cy.document().then((doc) => expect(doc.documentElement.scrollWidth).to.be.at.most(391))
    })
  })
})
