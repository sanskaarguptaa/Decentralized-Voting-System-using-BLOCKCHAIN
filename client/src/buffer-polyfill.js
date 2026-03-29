import { Buffer as RealBuffer } from '../node_modules/buffer/index.js';
window.Buffer = window.Buffer || RealBuffer;
export const Buffer = RealBuffer;
export default RealBuffer;
