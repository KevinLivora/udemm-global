Feature: Parámetros generales (solo administrador)

Background:
  * url baseUrl
  * configure headers = { Origin: '#(frontendUrl)', 'X-Requested-With': 'XMLHttpRequest' }

Scenario: El admin lista los parámetros
  * cookie auth_token = sesionAdmin.token
  Given path 'configuracion', 'parametros'
  When method get
  Then status 200

Scenario: Con una sesión inválida no se accede a parámetros
  * cookie auth_token = 'invalido'
  Given path 'configuracion', 'parametros'
  When method get
  Then status 401

Scenario: El docente no puede listar parámetros
  * cookie auth_token = sesionDocente.token
  Given path 'configuracion', 'parametros'
  When method get
  Then status 403