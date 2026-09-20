// For older badlogic Pi releases that provide @sinclair/typebox instead.
// Load this OR index.ts, not both. Host version compatibility needs local testing.
import { Type } from '@sinclair/typebox';
import registerPi from '../../src/pi.mjs';
export default function (pi) { registerPi(pi, Type); }
