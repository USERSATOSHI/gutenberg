/**
 * External dependencies
 */
import { RuleTester } from 'eslint';

/**
 * Internal dependencies
 */
import rule from '../ally-no-anchor-title';

const ruleTester = new RuleTester( {
	parserOptions: {
		ecmaVersion: 6,
		ecmaFeatures: {
			jsx: true,
		},
	},
} );

ruleTester.run( 'no-anchor-title', rule, {
	valid: [
		{
			code: `<a href="https://example.com">Link</a>`,
		},
		{
			code: `<a {...props}>Link</a>`,
		},
		{
			code: `<div title="Title here"></div>`,
		},
		{
			code: `<button title="Tooltip"></button>`,
		},
	],
	invalid: [
		{
			code: `<a href="https://example.com" title="Example site">Link</a>`,
			errors: [
				{ message: 'Do not use title attribute on <a> elements.' },
			],
		},
		{
			code: `<a title="Some title">Link</a>`,
			errors: [
				{ message: 'Do not use title attribute on <a> elements.' },
			],
		},
		{
			code: `<a href="#" title={"dynamic title"}>Click here</a>`,
			errors: [
				{ message: 'Do not use title attribute on <a> elements.' },
			],
		},
	],
} );
