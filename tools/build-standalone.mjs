/* Genera `reloj-standalone.html`: la app completa en un único archivo con todo
   (CSS, Three.js, Astronomy Engine y los módulos) embebido en línea. Útil para
   compartir/abrir sin la carpeta vendor. Uso:  node tools/build-standalone.mjs */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const css = rd('css/style.css');
const html = rd('index.html');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<!-- Librerías locales')).trim();

const js = [
  'vendor/three.min.js', 'vendor/OrbitControls.js', 'vendor/astronomy.browser.min.js',
  'js/cities.js', 'js/data.js', 'js/astro.js', 'js/scene.js', 'js/app.js'
].map((f) => '<script>\n' + rd(f) + '\n</script>').join('\n');

const out = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reloj Cósmico Geocéntrico 3D</title>
<style>
${css}
</style>
</head>
<body>
${body}
${js}
</body>
</html>
`;

fs.writeFileSync(path.join(root, 'reloj-standalone.html'), out);
console.log('reloj-standalone.html generado (' + Buffer.byteLength(out) + ' bytes)');
