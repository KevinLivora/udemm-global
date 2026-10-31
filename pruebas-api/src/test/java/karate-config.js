function fn() {
  var env = karate.env || 'local';
  var baseUrl = 'http://localhost:5000';
  var config = {
    baseUrl: baseUrl,
    frontendUrl: 'http://localhost:3000',
    adminCorreo: 'admin@udemm.edu.ar',
    adminClave: 'Admin1234!',
    docenteCorreo: 'docente.prueba@udemm.edu.ar',
    docenteClave: 'Docente1234!'
  };
  karate.configure('connectTimeout', 60000);
  karate.configure('readTimeout', 60000);
    var s = karate.callSingle('classpath:ar/udemm/sesiones.feature', {
    baseUrl: baseUrl, adminCorreo: config.adminCorreo, adminClave: config.adminClave,
    docenteCorreo: config.docenteCorreo, docenteClave: config.docenteClave });
  config.sesionAdmin = { token: s.tokenAdmin };
  config.sesionDocente = { token: s.tokenDocente };
  return config;
}