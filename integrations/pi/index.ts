// Current Pi (earendil-works/pi). The host provides TypeBox; no core patching.
import { Type } from 'typebox';
import registerPi from '../../src/pi.mjs';
export default function (pi) { registerPi(pi, Type); }
