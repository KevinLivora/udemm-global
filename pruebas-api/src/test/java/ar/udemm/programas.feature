Feature: Programas de asignatura

Background:
  * url baseUrl
  * configure headers = { Origin: '#(frontendUrl)', 'X-Requested-With': 'XMLHttpRequest' }

Scenario: El admin consulta los contadores de programas
  * cookie auth_token = sesionAdmin.token
  Given path 'programas', 'contadores'
  When method get
  Then status 200

Scenario: Con una sesión inválida no se accede a programas
  * cookie auth_token = 'invalido'
  Given path 'programas', 'contadores'
  When method get
  Then status 401

Scenario: El docente no puede ver las solicitudes de aprobación
  * cookie auth_token = sesionDocente.token
  Given path 'programas', 'solicitudes'
  When method get
  Then status 403