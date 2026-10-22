@ignore
Feature: Login reutilizable

Scenario:
  Given url baseUrl
  And path 'auth', 'login'
  And request { correoElectronico: '#(correo)', contrasena: '#(clave)' }
  When method post
  Then status 200
  * def token = responseCookies.auth_token.value