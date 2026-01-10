#!/usr/bin/env node

/**
 * Script to download Cairo-Regular.ttf font file
 * This script downloads the required TTF font for Arabic PDF generation
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const fontUrl = 'https://fonts.gstatic.com/s/cairo/v28/SLXgc1nY6Hkvalrub76M7dd8aGZk9bY.woff2';
const fontPath = path.join(__dirname, '../public/fonts/Cairo-Regular.ttf');

function downloadFont() {
  console.log('Downloading Cairo-Regular.ttf font...');
  
  // Ensure the fonts directory exists
  const fontsDir = path.dirname(fontPath);
  if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir, { recursive: true });
  }

  const file = fs.createWriteStream(fontPath);
  
  https.get(fontUrl, (response) => {
    if (response.statusCode === 200) {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('✅ Cairo-Regular.ttf downloaded successfully!');
        console.log(`📁 Font saved to: ${fontPath}`);
        console.log('📏 File size:', fs.statSync(fontPath).size, 'bytes');
      });
    } else {
      console.error('❌ Failed to download font. Status code:', response.statusCode);
      fs.unlinkSync(fontPath);
      process.exit(1);
    }
  }).on('error', (err) => {
    console.error('❌ Error downloading font:', err.message);
    fs.unlinkSync(fontPath);
    process.exit(1);
  });
}

// Alternative download sources
const alternativeUrls = [
  'https://fonts.gstatic.com/s/cairo/v28/SLXgc1nY6Hkvalrub76M7dd8aGZk9bY.woff2',
  'https://cdn.jsdelivr.net/npm/@fontsource/cairo@latest/files/cairo-latin-400-normal.woff2'
];

function tryAlternativeSources() {
  console.log('Trying alternative font sources...');
  // For now, we'll create a placeholder file
  // In a real scenario, you would try the alternative URLs
  console.log('⚠️  Using fallback - please manually download Cairo-Regular.ttf');
  console.log('📥 Download from: https://github.com/googlefonts/cairo');
}

// Check if font already exists
if (fs.existsSync(fontPath)) {
  console.log('✅ Cairo-Regular.ttf already exists!');
  console.log(`📁 Location: ${fontPath}`);
  console.log('📏 File size:', fs.statSync(fontPath).size, 'bytes');
} else {
  downloadFont();
}