Feature: Facultades con sesión de administrador

Background:
  * url baseUrl
  * def sesion = callonce read('login.feature') { correo: '#(adminCorreo)', clave: '#(adminClave)' }
  * configure headers = { Origin: '#(frontendUrl)', 'X-Requested-With': 'XMLHttpRequest' }

Scenario: El admin lista las facultades
  * cookie auth_token = sesion.token
  Given path 'facultades'
  When method get
  Then status 200

Scenario: Con una sesión inválida no se accede
  * cookie auth_token = 'invalido'
  Given path 'facultades'
  When method get
  Then status 401