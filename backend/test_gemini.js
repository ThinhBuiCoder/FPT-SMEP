require('dotenv').config();
const { generateJson } = require('./src/services/geminiService');
generateJson('Return {"ok": true}', {ok: false}).then(console.log);
