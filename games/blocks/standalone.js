import { mountBlocks } from './game.js';
mountBlocks(document.querySelector('#main'));
document.querySelector('.arcade-back').href = '../../#/library';
if ('serviceWorker' in navigator) navigator.serviceWorker.register('../../sw.js').catch(() => {});
