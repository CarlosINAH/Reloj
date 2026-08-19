/* ============================================================================
   cities.js — Lista de lugares integrada (funciona sin conexión) con
   coordenadas y zona horaria IANA. Enfocada en México + capitales/ciudades
   principales. Búsqueda sin distinción de acentos. Expone `Cities`.
   ========================================================================== */
(function () {
  'use strict';

  // [nombre, región/país, lat, lon, zona IANA]
  var LIST = [
    // México
    ['Ciudad de México', 'CDMX, México', 19.4326, -99.1332, 'America/Mexico_City'],
    ['Guadalajara', 'Jalisco, México', 20.6597, -103.3496, 'America/Mexico_City'],
    ['Monterrey', 'Nuevo León, México', 25.6866, -100.3161, 'America/Monterrey'],
    ['Puebla', 'Puebla, México', 19.0414, -98.2063, 'America/Mexico_City'],
    ['Toluca', 'Edo. de México, México', 19.2826, -99.6557, 'America/Mexico_City'],
    ['Querétaro', 'Querétaro, México', 20.5888, -100.3899, 'America/Mexico_City'],
    ['León', 'Guanajuato, México', 21.1229, -101.6820, 'America/Mexico_City'],
    ['Tijuana', 'Baja California, México', 32.5149, -117.0382, 'America/Tijuana'],
    ['Mérida', 'Yucatán, México', 20.9674, -89.5926, 'America/Merida'],
    ['Cancún', 'Quintana Roo, México', 21.1619, -86.8515, 'America/Cancun'],
    ['Ciudad Juárez', 'Chihuahua, México', 31.6904, -106.4245, 'America/Ciudad_Juarez'],
    ['Chihuahua', 'Chihuahua, México', 28.6353, -106.0889, 'America/Chihuahua'],
    ['Culiacán', 'Sinaloa, México', 24.7993, -107.3938, 'America/Mazatlan'],
    ['Mazatlán', 'Sinaloa, México', 23.2494, -106.4111, 'America/Mazatlan'],
    ['Hermosillo', 'Sonora, México', 29.0729, -110.9559, 'America/Hermosillo'],
    ['La Paz', 'BCS, México', 24.1426, -110.3128, 'America/Mazatlan'],
    ['Oaxaca', 'Oaxaca, México', 17.0732, -96.7266, 'America/Mexico_City'],
    ['Veracruz', 'Veracruz, México', 19.1738, -96.1342, 'America/Mexico_City'],
    ['Acapulco', 'Guerrero, México', 16.8531, -99.8237, 'America/Mexico_City'],
    ['Aguascalientes', 'Aguascalientes, México', 21.8853, -102.2916, 'America/Mexico_City'],
    ['Morelia', 'Michoacán, México', 19.7008, -101.1844, 'America/Mexico_City'],
    ['San Luis Potosí', 'SLP, México', 22.1565, -100.9855, 'America/Mexico_City'],
    ['Tuxtla Gutiérrez', 'Chiapas, México', 16.7516, -93.1029, 'America/Mexico_City'],
    ['Villahermosa', 'Tabasco, México', 17.9895, -92.9475, 'America/Mexico_City'],
    ['Tepic', 'Nayarit, México', 21.5039, -104.8942, 'America/Mexico_City'],
    ['Saltillo', 'Coahuila, México', 25.4383, -100.9737, 'America/Monterrey'],
    ['Cuernavaca', 'Morelos, México', 18.9242, -99.2216, 'America/Mexico_City'],
    ['Pachuca', 'Hidalgo, México', 20.1011, -98.7591, 'America/Mexico_City'],
    // América
    ['Nueva York', 'EE. UU.', 40.7128, -74.0060, 'America/New_York'],
    ['Los Ángeles', 'EE. UU.', 34.0522, -118.2437, 'America/Los_Angeles'],
    ['Chicago', 'EE. UU.', 41.8781, -87.6298, 'America/Chicago'],
    ['Houston', 'EE. UU.', 29.7604, -95.3698, 'America/Chicago'],
    ['Miami', 'EE. UU.', 25.7617, -80.1918, 'America/New_York'],
    ['Toronto', 'Canadá', 43.6532, -79.3832, 'America/Toronto'],
    ['Ciudad de Guatemala', 'Guatemala', 14.6349, -90.5069, 'America/Guatemala'],
    ['San Salvador', 'El Salvador', 13.6929, -89.2182, 'America/El_Salvador'],
    ['La Habana', 'Cuba', 23.1136, -82.3666, 'America/Havana'],
    ['Bogotá', 'Colombia', 4.7110, -74.0721, 'America/Bogota'],
    ['Lima', 'Perú', -12.0464, -77.0428, 'America/Lima'],
    ['Quito', 'Ecuador', -0.1807, -78.4678, 'America/Guayaquil'],
    ['Santiago', 'Chile', -33.4489, -70.6693, 'America/Santiago'],
    ['Buenos Aires', 'Argentina', -34.6037, -58.3816, 'America/Argentina/Buenos_Aires'],
    ['Montevideo', 'Uruguay', -34.9011, -56.1645, 'America/Montevideo'],
    ['Caracas', 'Venezuela', 10.4806, -66.9036, 'America/Caracas'],
    ['São Paulo', 'Brasil', -23.5505, -46.6333, 'America/Sao_Paulo'],
    // Europa
    ['Madrid', 'España', 40.4168, -3.7038, 'Europe/Madrid'],
    ['Barcelona', 'España', 41.3851, 2.1734, 'Europe/Madrid'],
    ['Londres', 'Reino Unido', 51.5074, -0.1278, 'Europe/London'],
    ['París', 'Francia', 48.8566, 2.3522, 'Europe/Paris'],
    ['Berlín', 'Alemania', 52.5200, 13.4050, 'Europe/Berlin'],
    ['Roma', 'Italia', 41.9028, 12.4964, 'Europe/Rome'],
    // Otros
    ['Tokio', 'Japón', 35.6762, 139.6503, 'Asia/Tokyo'],
    ['Sídney', 'Australia', -33.8688, 151.2093, 'Australia/Sydney']
  ];

  var CITIES = LIST.map(function (c) {
    return { name: c[0], region: c[1], lat: c[2], lon: c[3], tz: c[4] };
  });

  function normalize(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function search(query, limit) {
    var q = normalize(query);
    if (!q) return [];
    var starts = [], contains = [];
    CITIES.forEach(function (c) {
      var n = normalize(c.name);
      if (n.indexOf(q) === 0) starts.push(c);
      else if (n.indexOf(q) >= 0 || normalize(c.region).indexOf(q) >= 0) contains.push(c);
    });
    return starts.concat(contains).slice(0, limit || 8);
  }

  function byName(name) {
    var q = normalize(name);
    return CITIES.find(function (c) { return normalize(c.name) === q; }) || null;
  }

  window.Cities = { CITIES: CITIES, search: search, byName: byName, DEFAULT: 'Ciudad de México' };
})();
