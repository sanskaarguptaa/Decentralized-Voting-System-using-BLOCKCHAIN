import RealProcess from '../node_modules/process/browser.js';
window.process = window.process || RealProcess;
export const process = RealProcess;
export default RealProcess;
