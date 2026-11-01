Feature: Autoevaluación

Background:
  * url baseUrl
  * configure headers = { Origin: '#(frontendUrl)', 'X-Requested-With': 'XMLHttpRequest' }

Scenario: El admin lista los indicadores
  * cookie auth_token = sesionAdmin.token
  Given path 'autoevaluacion', 'indicadores'
  When method get
  Then status 200

Scenario: Con una sesión inválida no se accede a la autoevaluación
  * cookie auth_token = 'invalido'
  Given path 'autoevaluacion', 'indicadores'
  When method get
  Then status 401

Scenario: El docente no puede acceder a la autoevaluación
  * cookie auth_token = sesionDocente.token
  Given path 'autoevaluacion', 'indicadores'
  When method get
  Then status 403