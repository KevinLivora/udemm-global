@ignore
Feature: Sesiones de prueba reutilizables

Scenario:
  * url baseUrl
  Given path 'auth', 'login'
  And request { correoElectronico: '#(adminCorreo)', contrasena: '#(adminClave)' }
  When method post
  Then status 200
  * def tokenAdmin = responseCookies.auth_token.value
  * configure cookies = null
  Given path 'auth', 'login'
  And request { correoElectronico: '#(docenteCorreo)', contrasena: '#(docenteClave)' }
  When method post
  Then status 200
  * def tokenDocente = responseCookies.auth_token.value