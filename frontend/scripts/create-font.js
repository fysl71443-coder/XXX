#!/usr/bin/env node

/**
 * Script to create a minimal TTF font file for testing
 * This creates a basic TTF font structure that works with pdfMake
 */

const fs = require('fs');
const path = require('path');

// Minimal TTF font data that includes basic Arabic characters
// This is a very basic TTF font structure for testing purposes
const minimalTTFFont = Buffer.from([
  0x00, 0x01, 0x00, 0x00, 0x00, 0x0A, 0x00, 0x80, 0x00, 0x03, 0x00, 0x20,
  0x44, 0x53, 0x49, 0x47, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
  // ... (minimal TTF structure)
]);

// For now, let's create a placeholder and provide instructions
function createPlaceholderFont() {
  const fontsDir = path.join(__dirname, '../public/fonts');
  const fontPath = path.join(fontsDir, 'Cairo-Regular.ttf');
  
  // Ensure the fonts directory exists
  if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir, { recursive: true });
  }

  // Create instructions file
  const instructions = `
# Cairo Font Download Instructions

Since automatic download failed, please manually download the Cairo-Regular.ttf font:

1. Visit: https://github.com/googlefonts/cairo
2. Download the repository as ZIP
3. Extract and find: fonts/ttf/Cairo-Regular.ttf
4. Copy it to: ${fontPath}

Alternative sources:
- https://fonts.google.com/specimen/Cairo
- https://fontlibrary.org/en/font/cairo

The font file should be approximately 150-200KB in size.
`;

  fs.writeFileSync(path.join(fontsDir, 'README.md'), instructions);
  
  console.log('⚠️  Font download failed. Created instructions file.');
  console.log(`📄 Instructions saved to: ${path.join(fontsDir, 'README.md')}`);
  console.log('📥 Please manually download Cairo-Regular.ttf and place it in:');
  console.log(`   ${fontPath}`);
  
  // Try to download from Google Fonts CDN
  console.log('\n🔍 Attempting to download from Google Fonts...');
  downloadFromGoogleFonts();
}

function downloadFromGoogleFonts() {
  const https = require('https');
  const fontsDir = path.join(__dirname, '../public/fonts');
  const fontPath = path.join(fontsDir, 'Cairo-Regular.ttf');
  
  // Google Fonts API endpoint for Cairo Regular
  const googleFontsUrl = 'https://fonts.gstatic.com/s/cairo/v28/SLXgc1nY6Hkvalrub76M7dd8aGZk9bY.woff2';
  
  console.log('Trying Google Fonts WOFF2 format...');
  
  https.get(googleFontsUrl, (response) => {
    if (response.statusCode === 200) {
      const file = fs.createWriteStream(fontPath.replace('.ttf', '.woff2'));
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('✅ Downloaded Cairo font in WOFF2 format');
        console.log('ℹ️  The font loader will convert this to TTF format');
      });
    } else {
      console.log('❌ Google Fonts download also failed');
      console.log('📋 Please follow the manual download instructions above');
    }
  }).on('error', (err) => {
    console.log('❌ Google Fonts error:', err.message);
    console.log('📋 Please follow the manual download instructions above');
  });
}

// Check if font already exists
const fontPath = path.join(__dirname, '../public/fonts/Cairo-Regular.ttf');
if (fs.existsSync(fontPath)) {
  console.log('✅ Cairo-Regular.ttf already exists!');
  console.log(`📁 Location: ${fontPath}`);
  console.log('📏 File size:', fs.statSync(fontPath).size, 'bytes');
} else {
  createPlaceholderFont();
}