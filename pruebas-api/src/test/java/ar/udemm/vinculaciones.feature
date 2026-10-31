Feature: Vinculaciones a cátedra con sesión de administrador

Background:
  * url baseUrl
  * def sesion = sesionAdmin
  * configure headers = { Origin: '#(frontendUrl)', 'X-Requested-With': 'XMLHttpRequest' }

Scenario: El admin lista las vinculaciones
  * cookie auth_token = sesion.token
  Given path 'vinculaciones-catedra'
  When method get
  Then status 200

Scenario: Con una sesión inválida no se accede
  * cookie auth_token = 'invalido'
  Given path 'vinculaciones-catedra'
  When method get
  Then status 401