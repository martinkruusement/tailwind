// node --test test/animations.test.mjs
// Exercises expandAnimations against CSS shaped like Tailwind v4 output.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const postcss = require('postcss');
const plugin = require('../src/expandAnimations.js');

async function run(css) {
	const res = await postcss([plugin()]).process(css, { from: undefined });
	return res.css;
}

function assertPulse(css) {
	assert.match(css, /animation-name:pulse/);
	assert.match(css, /animation-duration:2s/);
	assert.match(css, /animation-timing-function:cubic-bezier\(\.4,0,\.6,1\)/);
	assert.match(css, /animation-iteration-count:infinite/);
	assert.doesNotMatch(css, /animation:/);
}

test('expands a literal animation shorthand', async () => {
	const css = await run('.x{animation:pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite}');
	assertPulse(css);
});

test('expands animation: var(--animate-*) from the theme (Tailwind v4 animate-* utilities)', async () => {
	const css = await run(
		':root{--animate-pulse:pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite}' +
			'.animate-pulse{animation:var(--animate-pulse)}',
	);
	assertPulse(css);
});

test('resolves variables declared after the rule that uses them', async () => {
	const css = await run('.animate-spin{animation:var(--animate-spin)}:root{--animate-spin:spin 1s linear infinite}');
	assert.match(css, /animation-name:spin/);
	assert.match(css, /animation-timing-function:linear/);
});

test('follows variables that refer to other variables', async () => {
	const css = await run(':root{--d:1s;--animate-spin:spin var(--d) linear infinite}.x{animation:var(--animate-spin)}');
	assert.match(css, /animation-duration:1s/);
});

test('uses the var() fallback when the variable is not declared', async () => {
	const css = await run('.x{animation:var(--missing, ping 1s linear infinite)}');
	assert.match(css, /animation-name:ping/);
});

test('keeps the declaration as-is when a variable cannot be resolved', async () => {
	assert.equal(await run('.x{animation:var(--missing)}'), '.x{animation:var(--missing)}');
});
