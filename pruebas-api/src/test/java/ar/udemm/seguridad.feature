Feature: Seguridad de acceso

  Background:
    * url baseUrl

  Scenario: Login con contraseña incorrecta es rechazado
    Given path 'auth/login'
    And request { correoElectronico: 'usuario.inexistente@udemm.test', contrasena: 'ClaveIncorrecta123' }
    When method post
    Then status 401

  Scenario: Sin sesión no se accede a facultades
    Given path 'facultades'
    When method get
    Then status 401

  Scenario: Una operación de escritura sin Origin es rechazada por CSRF
    Given path 'facultades'
    And cookie auth_token = 'invalido'
    And request { nombre: 'Prueba CSRF' }
    When method post
    Then status 403