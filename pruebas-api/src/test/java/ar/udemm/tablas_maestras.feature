Feature: Tablas maestras

Background:
  * url baseUrl
  * configure headers = { Origin: '#(frontendUrl)', 'X-Requested-With': 'XMLHttpRequest' }

Scenario: El admin lista los cargos
  * cookie auth_token = sesionAdmin.token
  Given path 'configuracion', 'tablas-maestras', 'cargos'
  When method get
  Then status 200

Scenario: Con una sesión inválida no se accede a las tablas maestras
  * cookie auth_token = 'invalido'
  Given path 'configuracion', 'tablas-maestras', 'cargos'
  When method get
  Then status 401

Scenario: El docente no puede gestionar las tablas maestras
  * cookie auth_token = sesionDocente.token
  Given path 'configuracion', 'tablas-maestras', 'cargos'
  When method get
  Then status 403