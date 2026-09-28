'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const publicVendor = path.join(root, 'public', 'vendor');

function copyDir(source, target) {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing runtime dependency: ${source}`);
  }
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(source, target, { recursive: true, force: true });
}

function copyFile(source, target) {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing runtime dependency: ${source}`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

const nodeModules = path.join(root, 'node_modules');

// Font Awesome: keep css/ and webfonts/ side-by-side because all.min.css uses ../webfonts/*.
copyDir(
  path.join(nodeModules, '@fortawesome', 'fontawesome-free', 'css'),
  path.join(publicVendor, 'fontawesome', 'css')
);
copyDir(
  path.join(nodeModules, '@fortawesome', 'fontawesome-free', 'webfonts'),
  path.join(publicVendor, 'fontawesome', 'webfonts')
);

// Fontsource CSS references ./files/*.woff2, so copy each package intact.
for (const family of ['kanit', 'prompt', 'noto-sans-thai']) {
  copyDir(
    path.join(nodeModules, '@fontsource', family),
    path.join(publicVendor, 'fonts', family)
  );
}

copyFile(
  path.join(nodeModules, 'xlsx', 'dist', 'xlsx.full.min.js'),
  path.join(publicVendor, 'xlsx', 'xlsx.full.min.js')
);

console.log('Runtime browser assets copied to public/vendor');
