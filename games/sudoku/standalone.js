import { setupPWA } from '../../pwa.js';
import { mountSudoku } from './game.js';
mountSudoku(document.querySelector('#main'));
document.querySelector('.arcade-back').href = '../../#/library';
setupPWA();
