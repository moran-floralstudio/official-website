/**
 * Moran Floral - Image Asset Manager
 *
 * Usage:
 *   node image-manager.js download <url> <category> [filename]
 *   node image-manager.js urls
 *   node image-manager.js verify
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ASSETS_DIR = path.join(__dirname, 'assets', 'images');
const URLS_FILE = path.join(__dirname, 'assets', 'image-urls.json');

const CATEGORIES = ['hero', 'service', 'portfolio'];

// Ensure category directories exist
function ensureDirs() {
  CATEGORIES.forEach(cat => {
    const dir = path.join(ASSETS_DIR, cat);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Download image from URL
function downloadImage(url, category, filename = null) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, { headers: { 'User-Agent': 'MoranFloral-AssetManager/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadImage(res.headers.location, category, filename).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusCodeMessage}`));
        return;
      }

      const contentType = res.headers['content-type'] || 'image/jpeg';
      const ext = contentType.includes('png') ? 'png' :
                  contentType.includes('webp') ? 'webp' :
                  contentType.includes('gif') ? 'gif' : 'jpg';

      if (!filename) {
        const urlPath = new URL(url).pathname;
        const basename = path.basename(urlPath, path.extname(urlPath)) || 'image';
        filename = `${basename}.${ext}`;
      } else if (!path.extname(filename)) {
        filename = `${filename}.${ext}`;
      }

      const savePath = path.join(ASSETS_DIR, category, filename);
      const file = fs.createWriteStream(savePath);
      res.pipe(file);

      file.on('finish', () => {
        file.close();
        const relativePath = `/assets/images/${category}/${filename}`;
        console.log(`✅ Downloaded: ${relativePath}`);
        resolve({ category, filename, path: relativePath, size: fs.statSync(savePath).size });
      });
    }).on('error', reject);
  });
}

// Generate URL mapping for current assets
function generateUrlMap() {
  const mapping = { hero: {}, service: {}, portfolio: {} };

  CATEGORIES.forEach(cat => {
    const dir = path.join(ASSETS_DIR, cat);
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach(file => {
        mapping[cat][path.basename(file, path.extname(file))] =
          `/assets/images/${cat}/${file}`;
      });
    }
  });

  fs.writeFileSync(URLS_FILE, JSON.stringify(mapping, null, 2), 'utf-8');
  console.log('✅ URL map generated at:', URLS_FILE);
  console.log(JSON.stringify(mapping, null, 2));
}

// Verify all referenced images exist locally
function verifyAssets() {
  const mapping = JSON.parse(fs.readFileSync(URLS_FILE, 'utf-8'));
  const missing = [];

  Object.entries(mapping).forEach(([cat, files]) => {
    Object.entries(files).forEach(([name, url]) => {
      const fullPath = path.join(__dirname, url);
      if (!fs.existsSync(fullPath)) {
        missing.push(url);
      }
    });
  });

  if (missing.length === 0) {
    console.log('✅ All images verified locally.');
  } else {
    console.log('❌ Missing images:');
    missing.forEach(m => console.log('  -', m));
  }
}

// Main CLI
const args = process.argv.slice(2);
const command = args[0];

ensureDirs();

switch (command) {
  case 'download':
    if (!args[1] || !args[2]) {
      console.error('Usage: node image-manager.js download <url> <category> [filename]');
      process.exit(1);
    }
    downloadImage(args[1], args[2], args[3]).catch(console.error);
    break;
  case 'urls':
    generateUrlMap();
    break;
  case 'verify':
    verifyAssets();
    break;
  default:
    console.log(`
Moran Floral Image Manager

Commands:
  download <url> <category> [filename]  Download image to assets/images/<category>/
  urls                                  Generate image-urls.json mapping
  verify                                Verify all mapped images exist locally

Categories: ${CATEGORIES.join(', ')}
Example:
  node image-manager.js download "https://images.unsplash.com/photo-xxx" hero "hero-main"
    `);
}
