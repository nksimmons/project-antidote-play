import { setupPWA } from '../../pwa.js';
import { mountBlocks } from './game.js';
mountBlocks(document.querySelector('#main'));
document.querySelector('.arcade-back').href = '../../#/library';
setupPWA();
