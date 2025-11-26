const pdf = require('pdf-parse');
console.log('Type of pdf:', typeof pdf);
console.log('Is pdf a function?', typeof pdf === 'function');
console.log('Keys of pdf export:', Object.keys(pdf));
if (typeof pdf !== 'function') {
    console.log('Maybe default export?', typeof pdf.default);
}
