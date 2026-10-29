// https://on.cypress.io/api

describe('Navegação principal', () => {
  it('abre a visão geral e permite acessar os viveiros', () => {
    cy.visit('/')
    cy.contains('h1', 'Visão geral')
    cy.get('.section-card').contains('Viveiros e ciclos').click()
    cy.location('pathname').should('eq', '/viveiros')
    cy.contains('h1', 'Viveiros e ciclos')
  })
})
