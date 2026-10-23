// node --test test/expand-animations.test.mjs
// Exercises expandAnimations: animation: shorthand -> animation-* longhands for core.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const postcss = require('postcss');
const parser = require('@hookun/parse-animation-shorthand');
const plugin = require('../src/expandAnimations.js');
const nativescript = require('../src/index.js');

async function run(css, expand = plugin) {
	const res = await postcss([expand()]).process(css, { from: undefined });
	return res.css;
}

// parser 0.1.4 and earlier returned the value without { start, end }
function loadWithUnwrappedParser() {
	const id = require.resolve('../src/expandAnimations.js');
	const cached = require.cache[id];
	const { parseSingle } = parser;
	delete require.cache[id];
	parser.parseSingle = (value) => {
		const parsed = parseSingle(value);
		return parsed && typeof parsed.end === 'number' ? parsed.value : parsed;
	};
	try {
		return require(id);
	} finally {
		parser.parseSingle = parseSingle;
		require.cache[id] = cached;
	}
}

const EXPANDED =
	'.a{animation-name: spin;animation-iteration-count: infinite;animation-timing-function: ease-in-out;' +
	'animation-delay: 2000ms;animation-duration: 1000ms}';

test('expands the shorthand into longhands with explicit ms times', async () => {
	assert.equal(await run('.a{animation: spin 1s 2s ease-in-out infinite}'), EXPANDED);
	assert.equal(
		await run('.a{animation: spin 250ms 100ms}'),
		'.a{animation-name: spin;animation-delay: 100ms;animation-duration: 250ms}',
	);
});

test('keeps fractional and sub-second times exact', async () => {
	assert.equal(
		await run('.a{animation: spin 333.3ms 0.5s}'),
		'.a{animation-name: spin;animation-delay: 500ms;animation-duration: 333.3ms}',
	);
	assert.equal(
		await run('.a{animation: spin 1.5s}'),
		'.a{animation-name: spin;animation-duration: 1500ms}',
	);
});

test('expands keywords, timing functions and none', async () => {
	assert.equal(
		await run('.a{animation: spin 1s cubic-bezier(0.4, 0, 0.6, 1) 3 alternate forwards}'),
		'.a{animation-name: spin;animation-fill-mode: forwards;animation-direction: alternate;' +
			'animation-iteration-count: 3;animation-timing-function: cubic-bezier(.4,0,.6,1);' +
			'animation-duration: 1000ms}',
	);
	assert.equal(
		await run('.a{animation: spin 1s steps(4, end)}'),
		'.a{animation-name: spin;animation-timing-function: steps(4,end);animation-duration: 1000ms}',
	);
	assert.equal(await run('.a{animation: none}'), '.a{animation-name: none}');
});

test('keeps !important on every longhand', async () => {
	assert.equal(
		await run('.a{animation: spin 1s !important}'),
		'.a{animation-name: spin !important;animation-duration: 1000ms !important}',
	);
});

test('leaves comma-separated lists to core', async () => {
	assert.equal(await run('.a{animation: a 1s, b 2s}'), '.a{animation: a 1s, b 2s}');
	assert.equal(
		await run('.a{animation: spin 1s linear infinite, fade 2s}'),
		'.a{animation: spin 1s linear infinite, fade 2s}',
	);
});

test('keeps values the parser cannot fully read as written', async () => {
	// Tailwind v4 animate-* utilities emit a var() shorthand; kept, not dropped
	assert.equal(
		await run('.animate-spin{animation: var(--animate-spin)}'),
		'.animate-spin{animation: var(--animate-spin)}',
	);
});

test('keeps the shorthand when the parser rejects it', async () => {
	assert.equal(await run('.a{animation: 1s}'), '.a{animation: 1s}');
	assert.equal(await run('.a{animation: spin 1s 2s 3s}'), '.a{animation: spin 1s 2s 3s}');
});

test('leaves longhands and other declarations untouched', async () => {
	assert.equal(
		await run('.a{animation-name: spin;animation-duration: 1s;color: red}'),
		'.a{animation-name: spin;animation-duration: 1s;color: red}',
	);
});

test('accepts the unwrapped result of parser 0.1.4 and earlier', async () => {
	const legacy = loadWithUnwrappedParser();
	assert.notEqual(legacy, plugin);
	assert.equal(await run('.a{animation: spin 1s 2s ease-in-out infinite}', legacy), EXPANDED);
	assert.equal(
		await run('.a{animation: spin 333.3ms}', legacy),
		'.a{animation-name: spin;animation-duration: 333.3ms}',
	);
});

test('keeps the expanded longhands through the full plugin chain', async () => {
	const res = await nativescript.process('.a{animation: spin 1s 2s ease-in-out infinite}', {
		from: undefined,
	});
	assert.equal(res.css, EXPANDED);
});
