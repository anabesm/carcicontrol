describe('Acesso ao sistema', () => {
  it('encaminha uma visita sem sessão ao login', () => {
    cy.intercept('GET', '/api/auth/me', {
      statusCode: 401,
      body: { error: 'Autenticação necessária.' },
    })
    cy.visit('/funcionarios/novo')
    cy.location('pathname').should('eq', '/login')
    cy.contains('h1', 'Acesse sua conta')
    cy.contains('button', 'Entrar').click()
    cy.contains('Informe o e-mail.')
    cy.contains('Informe a senha.')
  })
})
