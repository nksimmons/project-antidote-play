import { mountGame } from './game.js';
mountGame(document.querySelector('#main'));
document.querySelector('.back-link').href = '../../#/library';
if ('serviceWorker' in navigator) navigator.serviceWorker.register('../../sw.js').catch(() => {});
