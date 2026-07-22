// functions/index.js
//
// Só exports — cada Cloud Function mora no seu próprio arquivo/pasta.
// initializeApp() roda uma vez aqui, antes de tudo.

const { initializeApp } = require('firebase-admin/app');
initializeApp();

exports.sendPushOnNotification = require('./push-notifications').sendPushOnNotification;
exports.agenteAgil = require('./agente-agil/http').agenteAgil;
