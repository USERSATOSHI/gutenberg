/**
 * External dependencies
 */
// Disable reason: `eslint-plugin-import` doesn't support `exports` (https://github.com/import-js/eslint-plugin-import/issues/1810)
// eslint-disable-next-line import/no-unresolved
import _sprintf from '@tannin/sprintf';
import memize from 'memize';

/**
 * Internal dependencies
 */
import type { DistributeSprintfArgs, TranslatableText } from './types';

const logErrorOnce = memize( console.error ); //  eslint-disable-line no-console

export function sprintf< T extends string >(
	format: T | TranslatableText< T >,
	...args: DistributeSprintfArgs< T >
): string;
export function sprintf< T extends string >(
	format: T | TranslatableText< T >,
	args: DistributeSprintfArgs< T >
): string;

/**
 * Returns a formatted string.
 *
 * @param format The format of the string to generate.
 * @param args   Arguments to apply to the format.
 *
 * @see https://www.npmjs.com/package/@tannin/sprintf
 *
 * @return The formatted string.
 */
export function sprintf< T extends string >(
	format: T | TranslatableText< T >,
	...args: DistributeSprintfArgs< T >
): string {
	try {
		return _sprintf(
			format as T,
			...( args as DistributeSprintfArgs< T > )
		);
	} catch ( error ) {
		if ( error instanceof Error ) {
			logErrorOnce( 'sprintf error: \n\n' + error.toString() );
		}
		return '';
	}
}
