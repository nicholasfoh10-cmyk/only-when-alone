import { build } from 'esbuild';
import fs from 'fs';
const r = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false });
const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const F = (pkg, file, fam, w) => `@font-face{font-family:'${fam}';font-weight:${w};font-display:block;src:url(data:font/woff2;base64,${fs.readFileSync(`node_modules/@fontsource/${pkg}/files/${file}`).toString('base64')}) format('woff2')}`;
const fonts = '<style>' + F('jacquard-24', 'jacquard-24-latin-400-normal.woff2', 'Jacquard 24', 400) + F('pixelify-sans', 'pixelify-sans-latin-400-normal.woff2', 'Pixelify Sans', 400) + F('pixelify-sans', 'pixelify-sans-latin-600-normal.woff2', 'Pixelify Sans', 600) + F('silkscreen', 'silkscreen-latin-400-normal.woff2', 'Silkscreen', 400) + '</style>';
const html = fs.readFileSync('template.html', 'utf8').replace('</head>', () => fonts + '</head>').replace('<script>/*GAME*/</script>', () => '<script>' + js + '</script>');
fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/index.html', html);
console.log('ok', (html.length / 1024).toFixed(0) + 'KB');
