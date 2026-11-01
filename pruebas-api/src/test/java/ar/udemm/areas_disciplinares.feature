Feature: Áreas disciplinares

Background:
  * url baseUrl
  * configure headers = { Origin: '#(frontendUrl)', 'X-Requested-With': 'XMLHttpRequest' }

Scenario: El admin lista las áreas disciplinares
  * cookie auth_token = sesionAdmin.token
  Given path 'configuracion', 'subareas'
  When method get
  Then status 200

Scenario: Con una sesión inválida no se accede a las áreas disciplinares
  * cookie auth_token = 'invalido'
  Given path 'configuracion', 'subareas'
  When method get
  Then status 401