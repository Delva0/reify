import assert from 'node:assert/strict';
import {mirrorPackageConfig} from '../cli.mjs';
const pkg={name:'independent-blog',dependencies:{reify:'file:../..'}},metadata={version:'0.1.0',dependencies:{astro:'7.4.2'}},lock={packages:{'':{dependencies:{reify:'file:../..'}},'../..':metadata,'node_modules/reify':{resolved:'../..',link:true}}};
const result=mirrorPackageConfig(pkg,lock);
assert.equal(result.pkg.dependencies.reify,'file:../reify');assert.equal(result.lock.packages['node_modules/reify'].resolved,'../reify');assert.deepEqual(result.lock.packages['../reify'],metadata);assert(!Object.hasOwn(result.lock.packages,'../..'));assert.equal(pkg.dependencies.reify,'file:../..');assert.equal(lock.packages['node_modules/reify'].resolved,'../..','source manifests remain untouched');
assert.deepEqual(mirrorPackageConfig(result.pkg,result.lock),result,'mirroring is idempotent');
assert.equal(mirrorPackageConfig(pkg,null).lock,null);
console.log('Native execution mirror preserves local package identity and locked versions without changing source manifests');
