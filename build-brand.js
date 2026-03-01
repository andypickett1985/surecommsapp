const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const brandId = process.argv[2];
if (!brandId) {
  console.error('Usage: node build-brand.js <brand-id>');
  console.error('  e.g. node build-brand.js hypercloud');
  process.exit(1);
}

const brandDir = path.join(__dirname, 'brands', brandId);
const brandJson = JSON.parse(fs.readFileSync(path.join(brandDir, 'brand.json'), 'utf8'));
const buildDir = path.join(__dirname, `build-${brandId}`);

console.log(`\nBuilding ${brandJson.appName} (${brandId})...\n`);

// 1. Copy app/ to build dir
console.log('1. Copying app source...');
if (fs.existsSync(buildDir)) fs.rmSync(buildDir, { recursive: true });
copyDirSync(path.join(__dirname, 'app'), buildDir);

// 2. Replace branding in all source files
console.log('2. Applying branding...');
const replacements = [
  ['SureCloudVoice by Sure', brandJson.copyright],
  ['by Sure', `by ${brandJson.companyName}`],
  ['communicator.surecloudvoice.com', brandJson.domain],
  ['wss://communicator.surecloudvoice.com', brandJson.wsUrl],
  ['https://communicator.surecloudvoice.com', brandJson.apiUrl],
  ['SureCloudVoice', brandJson.appName],
  ['SureCloudComms', brandJson.appName],
  ['surecloudvoice', brandId],
  ['Sure by Beyon', brandJson.companyName],
];

const extensions = ['.js', '.jsx', '.html', '.css', '.json'];
replaceInDir(path.join(buildDir, 'src'), replacements, extensions);

// 3. Replace colors in CSS/JSX
console.log('3. Applying colors...');
if (brandJson.colors) {
  const colorReplacements = [];
  if (brandJson.colors.navy) {
    colorReplacements.push(['#202A44', brandJson.colors.navy]);
    colorReplacements.push(['#2a3654', brandJson.colors.secondary || lighten(brandJson.colors.navy)]);
    colorReplacements.push(['#151d30', brandJson.colors.dark || darken(brandJson.colors.navy)]);
  }
  if (brandJson.colors.accent) {
    colorReplacements.push(['#CE0037', brandJson.colors.accent]);
    colorReplacements.push(['#a8002d', brandJson.colors.accent]);
  }
  if (brandJson.colors.electricBlue || brandJson.colors.cloud) {
    colorReplacements.push(['#4C00FF', brandJson.colors.electricBlue || brandJson.colors.accent]);
    colorReplacements.push(['#6B33FF', brandJson.colors.cloud || brandJson.colors.accent]);
  }
  if (brandJson.colors.cloud) {
    colorReplacements.push(['#E5E1E6', brandJson.colors.cloud]);
  }
  if (colorReplacements.length) {
    replaceInDir(path.join(buildDir, 'src'), colorReplacements, ['.jsx', '.css']);
  }
}

function lighten(hex) {
  const r = Math.min(255, parseInt(hex.slice(1,3),16) + 30);
  const g = Math.min(255, parseInt(hex.slice(3,5),16) + 30);
  const b = Math.min(255, parseInt(hex.slice(5,7),16) + 30);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}
function darken(hex) {
  const r = Math.max(0, parseInt(hex.slice(1,3),16) - 20);
  const g = Math.max(0, parseInt(hex.slice(3,5),16) - 20);
  const b = Math.max(0, parseInt(hex.slice(5,7),16) - 20);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// 4. Copy brand logos
console.log('4. Copying brand assets...');
const logoSrc = path.join(brandDir, brandJson.logos?.horizontal || 'img/logo-horizontal.png');
if (fs.existsSync(logoSrc)) {
  fs.copyFileSync(logoSrc, path.join(buildDir, 'src', 'renderer', 'assets', 'sure-logo.png'));
  fs.copyFileSync(logoSrc, path.join(buildDir, 'src', 'renderer', 'assets', 'sure-icon.png'));
}
const loginLogoSrc = path.join(brandDir, brandJson.logos?.login || '');
if (brandJson.logos?.login && fs.existsSync(loginLogoSrc)) {
  fs.copyFileSync(loginLogoSrc, path.join(buildDir, 'src', 'renderer', 'assets', 'sure-logo.png'));
}
const icoSrc = path.join(brandDir, 'icon.ico');
if (fs.existsSync(icoSrc)) {
  fs.copyFileSync(icoSrc, path.join(buildDir, 'assets', 'icon.ico'));
}
const pngSrc = path.join(brandDir, 'icon.png');
if (fs.existsSync(pngSrc)) {
  fs.copyFileSync(pngSrc, path.join(buildDir, 'assets', 'icon.png'));
}

// 5. Update package.json
console.log('5. Updating package.json...');
const pkgPath = path.join(buildDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.name = brandId;
pkg.productName = brandJson.appName;
pkg.description = `${brandJson.appName} Desktop App`;
if (pkg.build) {
  pkg.build.appId = brandJson.installer.appId;
  pkg.build.productName = brandJson.installer.productName;
  if (pkg.build.win) pkg.build.win.publisherName = brandJson.installer.publisherName;
}
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

// 6. Install deps and build
console.log('6. Installing dependencies...');
execSync('npm install', { cwd: buildDir, stdio: 'inherit' });

console.log('7. Building renderer...');
execSync('npx vite build', { cwd: buildDir, stdio: 'inherit' });

console.log('8. Building installer...');
execSync('npx electron-builder --win', { cwd: buildDir, stdio: 'inherit', env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' } });

console.log(`\n=== ${brandJson.appName} build complete! ===`);
console.log(`Installer: ${buildDir}/dist/`);

// --- Helpers ---
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'dist-renderer') continue;
    if (entry.isDirectory()) copyDirSync(s, d);
    else fs.copyFileSync(s, d);
  }
}

function replaceInDir(dir, replacements, exts) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      replaceInDir(full, replacements, exts);
    } else if (exts.some(e => entry.name.endsWith(e))) {
      let content = fs.readFileSync(full, 'utf8');
      let changed = false;
      for (const [from, to] of replacements) {
        if (content.includes(from)) {
          content = content.split(from).join(to);
          changed = true;
        }
      }
      if (changed) fs.writeFileSync(full, content);
    }
  }
}
