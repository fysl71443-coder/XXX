const fs = require('fs');
const path = 'c:/Users/DELL/Documents/augment-projects/XXX/frontend/public/fonts/Cairo-Regular.woff2';
const data = fs.readFileSync(path);
const base64 = data.toString('base64');
console.log('const cairoBase64 = `' + base64 + '`;');