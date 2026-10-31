Feature: Planes de estudio con sesión de administrador

Background:
  * url baseUrl
  * def sesion = sesionAdmin
  * configure headers = { Origin: '#(frontendUrl)', 'X-Requested-With': 'XMLHttpRequest' }

Scenario: El admin lista los planes
  * cookie auth_token = sesion.token
  Given path 'plan-estudios'
  When method get
  Then status 200

Scenario: Con una sesión inválida no se accede
  * cookie auth_token = 'invalido'
  Given path 'plan-estudios'
  When method get
  Then status 401