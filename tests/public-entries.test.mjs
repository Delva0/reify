import assert from 'node:assert/strict';
import {defineReifyConfig} from '../config.mjs';
import {mirrorPackageConfig,runReify} from '../cli.mjs';
import * as oldSourceHighlight from 'reify/build/source-highlight.mjs';
import * as sourceHighlight from 'reify/build/source-highlight.js';

assert.equal(typeof defineReifyConfig,'function');
assert.equal(typeof mirrorPackageConfig,'function');
assert.equal(typeof runReify,'function');
assert.strictEqual(oldSourceHighlight,sourceHighlight,'existing .mjs build imports resolve to the same compiled module');
console.log('Public config, CLI and legacy build entrypoints remain compatible');
