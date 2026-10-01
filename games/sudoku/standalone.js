import { mountSudoku } from './game.js';
mountSudoku(document.querySelector('#main'));
document.querySelector('.arcade-back').href = '../../#/library';
if ('serviceWorker' in navigator) navigator.serviceWorker.register('../../sw.js').catch(() => {});
