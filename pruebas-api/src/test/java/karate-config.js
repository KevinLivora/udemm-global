function fn() {
  var env = karate.env || 'local';
  var config = {
    baseUrl: 'http://localhost:5000',
    frontendUrl: 'http://localhost:3000',
    adminCorreo: 'admin@udemm.edu.ar',
    adminClave: 'Admin1234!'
  };
  karate.configure('connectTimeout', 60000);
  karate.configure('readTimeout', 60000);
  return config;
}