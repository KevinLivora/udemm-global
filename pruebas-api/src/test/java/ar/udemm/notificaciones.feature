Feature: Notificaciones

Background:
  * url baseUrl
  * configure headers = { Origin: '#(frontendUrl)', 'X-Requested-With': 'XMLHttpRequest' }

Scenario: El admin consulta sus notificaciones
  * cookie auth_token = sesionAdmin.token
  Given path 'notificaciones'
  When method get
  Then status 200

Scenario: El docente consulta sus notificaciones
  * cookie auth_token = sesionDocente.token
  Given path 'notificaciones'
  When method get
  Then status 200

Scenario: Con una sesión inválida no se accede a las notificaciones
  * cookie auth_token = 'invalido'
  Given path 'notificaciones'
  When method get
  Then status 401