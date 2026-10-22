Feature: Estado del servidor

Scenario: El backend responde
  Given url baseUrl
  And path 'health'
  When method get
  Then status 200