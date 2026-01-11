import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { cairoBase64 } from './pdfFonts';

async function loadFont(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load font: ${response.statusText}`);
    const buffer = await response.arrayBuffer();
    return btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
  } catch (error) {
    console.warn(`Failed to load font from ${url}:`, error);
    throw error;
  }
}

export async function initPdfFonts() {
  const builtVfs = (pdfFonts && pdfFonts.pdfMake && pdfFonts.pdfMake.vfs) ? pdfFonts.pdfMake.vfs : {};
  pdfMake.vfs = { ...(pdfMake.vfs || {}), ...builtVfs };

  // Ensure Cairo font exists for default usage
  let cairoBase = '';
  let cairoFile = 'Cairo-Regular.ttf';
  try {
    cairoBase = await loadFont('/fonts/Cairo-Regular.ttf');
    cairoFile = 'Cairo-Regular.ttf';
  } catch {
    try {
      cairoBase = await loadFont('/fonts/Cairo-Regular.woff2');
      cairoFile = 'Cairo-Regular.woff2';
    } catch {
      cairoBase = createMinimalArabicFont();
      cairoFile = 'fallback-arabic.ttf';
    }
  }

  // Optionally add Amiri if available
  let amiriBase = '';
  try {
    amiriBase = await loadFont('/fonts/Amiri-Regular.ttf');
    pdfMake.vfs['Amiri-Regular.ttf'] = amiriBase;
  } catch (error) {
    console.warn('Failed to load Amiri-Regular.ttf font:', error);
    // Use Cairo as fallback for Amiri
    amiriBase = cairoBase;
  }

  // Register Cairo in VFS
  pdfMake.vfs[cairoFile] = cairoBase;

  const fonts = { ...pdfMake.fonts };
  fonts.Cairo = {
    normal: cairoFile,
    bold: cairoFile,
    italics: cairoFile,
    bolditalics: cairoFile,
  };
  if (amiriBase && amiriBase !== cairoBase) {
    fonts.Amiri = {
      normal: 'Amiri-Regular.ttf',
      bold: 'Amiri-Regular.ttf',
      italics: 'Amiri-Regular.ttf',
      bolditalics: 'Amiri-Regular.ttf',
    };
  }
  pdfMake.fonts = fonts;
}

function createMinimalArabicFont() {
  return cairoBase64;
}