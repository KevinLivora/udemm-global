Feature: Autenticación y sesión

Background:
  * url baseUrl
  * configure headers = { Origin: '#(frontendUrl)', 'X-Requested-With': 'XMLHttpRequest' }

Scenario: El admin consulta su sesión actual
  * cookie auth_token = sesionAdmin.token
  Given path 'auth', 'me'
  When method get
  Then status 200

Scenario: El docente consulta su sesión actual
  * cookie auth_token = sesionDocente.token
  Given path 'auth', 'me'
  When method get
  Then status 200

Scenario: Con una sesión inválida no se consulta la sesión actual
  * cookie auth_token = 'invalido'
  Given path 'auth', 'me'
  When method get
  Then status 401

Scenario: Renovar la sesión sin cookie de renovación es rechazado
  Given path 'auth', 'refresh'
  When method post
  Then status 401