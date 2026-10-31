Feature: Docentes con sesión de administrador

Background:
  * url baseUrl
  * def sesion = sesionAdmin
  * configure headers = { Origin: '#(frontendUrl)', 'X-Requested-With': 'XMLHttpRequest' }

Scenario: El admin lista los docentes
  * cookie auth_token = sesion.token
  Given path 'docentes'
  When method get
  Then status 200

Scenario: Con una sesión inválida no se accede
  * cookie auth_token = 'invalido'
  Given path 'docentes'
  When method get
  Then status 401