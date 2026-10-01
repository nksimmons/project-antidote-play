import { setupPWA } from '../../pwa.js';
import { mountGame } from './game.js';
mountGame(document.querySelector('#main'));
document.querySelector('.back-link').href = '../../#/library';
setupPWA();
