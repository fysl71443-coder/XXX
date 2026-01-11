const fs = require('fs');
const path = require('path');

// Read the actual font file
const fontPath = path.join(__dirname, '../../../../public/fonts/Amiri-Regular.ttf');
const font = fs.readFileSync(fontPath);
const base64 = font.toString('base64');

// Create the pdfFonts.js file with real Base64 data
const outputPath = path.join(__dirname, '../pdfFonts.js');
const content = `/**
 * Base64 encoded font data for PDF generation
 * This file contains the actual Amiri font embedded as Base64
 * Generated from: public/fonts/Amiri-Regular.ttf
 * 
 * ✅ No fetch() dependency
 * ✅ Works on Render, Linux, Windows
 * ✅ Guaranteed Arabic support
 * ✅ Production ready
 */

export const amiriBase64 = "${base64}";

// Optional: Add Cairo font if available
export const cairoBase64 = amiriBase64; // Use Amiri as fallback for now
`;

fs.writeFileSync(outputPath, content);
console.log('✅ DONE - Real Base64 font data generated from Amiri-Regular.ttf');
console.log(`📊 Font size: ${(base64.length / 1024).toFixed(1)}KB`);
console.log(`📁 Saved to: ${outputPath}`);