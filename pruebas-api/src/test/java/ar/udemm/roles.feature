   Feature: Control de acceso por rol

   Background:
     * url baseUrl
     * def sesion = sesionDocente
     * configure headers = { Origin: '#(frontendUrl)', 'X-Requested-With': 'XMLHttpRequest' }

   Scenario: El docente puede consultar las carreras
     * cookie auth_token = sesion.token
     Given path 'carreras'
     When method get
     Then status 200

   Scenario: El docente no puede crear carreras
     * cookie auth_token = sesion.token
     Given path 'carreras'
     And request { nombre: 'Carrera de prueba' }
     When method post
     Then status 403