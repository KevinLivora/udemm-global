@ignore
Feature: Intento de login fallido reutilizable

Scenario:
  Given url baseUrl
  And path 'auth', 'login'
  And request { correoElectronico: 'usuario.inexistente@udemm.test', contrasena: 'ClaveIncorrecta123' }
  When method post
  * def codigo = responseStatus