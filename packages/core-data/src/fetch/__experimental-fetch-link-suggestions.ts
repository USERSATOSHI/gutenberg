/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { addQueryArgs } from '@wordpress/url';
import { decodeEntities } from '@wordpress/html-entities';
import { __ } from '@wordpress/i18n';

export type SearchOptions = {
	/**
	 * Displays initial search suggestions, when true.
	 */
	isInitialSuggestions?: boolean;
	/**
	 * Search options for initial suggestions.
	 */
	initialSuggestionsSearchOptions?: Omit<
		SearchOptions,
		'isInitialSuggestions' | 'initialSuggestionsSearchOptions'
	>;
	/**
	 * Filters by search type.
	 */
	type?: 'attachment' | 'post' | 'term' | 'post-format';
	/**
	 * Slug of the post-type or taxonomy.
	 */
	subtype?: string;
	/**
	 * Which page of results to return.
	 */
	page?: number;
	/**
	 * Search results per page.
	 */
	perPage?: number;
};

export type EditorSettings = {
	/**
	 * Disables post formats, when true.
	 */
	disablePostFormats?: boolean;
};

type SearchAPIResult = {
	id: number;
	title: string;
	url: string;
	type: string;
	subtype: string;
};

type MediaAPIResult = {
	id: number;
	title: { rendered: string };
	source_url: string;
	type: string;
};

export type SearchResult = {
	/**
	 * Post or term id.
	 */
	id: number;
	/**
	 * Link url.
	 */
	url: string;
	/**
	 * Title of the link.
	 */
	title: string;
	/**
	 * The taxonomy or post type slug or type URL.
	 */
	type: string;
	/**
	 * Link kind of post-type or taxonomy
	 */
	kind?: string;
};

type PostAPIResult = {
	id: number;
	link: string;
	title: { rendered: string };
	type: string;
};

/**
 * Fetches link suggestions from the WordPress API.
 *
 * WordPress does not support searching multiple tables at once, e.g. posts and terms, so we
 * perform multiple queries at the same time and then merge the results together.
 *
 * @param search
 * @param searchOptions
 * @param editorSettings
 *
 * @example
 * ```js
 * import { __experimentalFetchLinkSuggestions as fetchLinkSuggestions } from '@wordpress/core-data';
 *
 * //...
 *
 * export function initialize( id, settings ) {
 *
 * settings.__experimentalFetchLinkSuggestions = (
 *     search,
 *     searchOptions
 * ) => fetchLinkSuggestions( search, searchOptions, settings );
 * ```
 */
export default async function fetchLinkSuggestions(
	search: string,
	searchOptions: SearchOptions = {},
	editorSettings: EditorSettings = {}
): Promise< SearchResult[] > {
	const searchOptionsToUse =
		searchOptions.isInitialSuggestions &&
		searchOptions.initialSuggestionsSearchOptions
			? {
					...searchOptions,
					...searchOptions.initialSuggestionsSearchOptions,
			  }
			: searchOptions;

	const {
		type,
		subtype,
		page,
		perPage = searchOptions.isInitialSuggestions ? 3 : 20,
	} = searchOptionsToUse;

	const { disablePostFormats = false } = editorSettings;

	const queries: Promise< SearchResult[] >[] = [];

	if ( ! type || type === 'post' ) {
		queries.push(
			apiFetch< SearchAPIResult[] >( {
				path: addQueryArgs( '/wp/v2/search', {
					search,
					page,
					per_page: perPage,
					type: 'post',
					subtype,
				} ),
			} )
				.then( ( results ) => {
					return results.map( ( result ) => {
						return {
							id: result.id,
							url: result.url,
							title:
								decodeEntities( result.title || '' ) ||
								__( '(no title)' ),
							type: result.subtype || result.type,
							kind: 'post-type',
						};
					} );
				} )
				.catch( () => [] ) // Fail by returning no results.
		);
	}

	if ( ! type || type === 'term' ) {
		queries.push(
			apiFetch< SearchAPIResult[] >( {
				path: addQueryArgs( '/wp/v2/search', {
					search,
					page,
					per_page: perPage,
					type: 'term',
					subtype,
				} ),
			} )
				.then( ( results ) => {
					return results.map( ( result ) => {
						return {
							id: result.id,
							url: result.url,
							title:
								decodeEntities( result.title || '' ) ||
								__( '(no title)' ),
							type: result.subtype || result.type,
							kind: 'taxonomy',
						};
					} );
				} )
				.catch( () => [] ) // Fail by returning no results.
		);
	}

	if ( ! disablePostFormats && ( ! type || type === 'post-format' ) ) {
		queries.push(
			apiFetch< SearchAPIResult[] >( {
				path: addQueryArgs( '/wp/v2/search', {
					search,
					page,
					per_page: perPage,
					type: 'post-format',
					subtype,
				} ),
			} )
				.then( ( results ) => {
					return results.map( ( result ) => {
						return {
							id: result.id,
							url: result.url,
							title:
								decodeEntities( result.title || '' ) ||
								__( '(no title)' ),
							type: result.subtype || result.type,
							kind: 'taxonomy',
						};
					} );
				} )
				.catch( () => [] ) // Fail by returning no results.
		);
	}

	// Slug-based lookup for post types: the /wp/v2/search API only searches titles,
	// so pages whose slug and title differ (e.g. slug "kurse", title "Kursübersicht")
	// won't appear when the user types the slug. A parallel exact-slug query against
	// the posts/pages endpoints fills that gap. Only fires when there is a search term.
	if ( search && ( ! type || type === 'post' ) ) {
		let slugRestBases: string[];
		if ( subtype === 'post' ) {
			slugRestBases = [ 'posts' ];
		} else if ( subtype === 'page' ) {
			slugRestBases = [ 'pages' ];
		} else {
			slugRestBases = [ 'pages', 'posts' ];
		}

		for ( const restBase of slugRestBases ) {
			queries.push(
				apiFetch< PostAPIResult[] >( {
					path: addQueryArgs( `/wp/v2/${ restBase }`, {
						slug: search,
						per_page: perPage,
						_fields: 'id,link,title,type',
					} ),
				} )
					.then( ( results ) =>
						results.map( ( result ) => ( {
							id: result.id,
							url: result.link,
							title:
								decodeEntities(
									result.title?.rendered || ''
								) || __( '(no title)' ),
							type: result.type,
							kind: 'post-type',
						} ) )
					)
					.catch( () => [] ) // Fail by returning no results.
			);
		}
	}

	if ( ! type || type === 'attachment' ) {
		queries.push(
			apiFetch< MediaAPIResult[] >( {
				path: addQueryArgs( '/wp/v2/media', {
					search,
					page,
					per_page: perPage,
				} ),
			} )
				.then( ( results ) => {
					return results.map( ( result ) => {
						return {
							id: result.id,
							url: result.source_url,
							title:
								decodeEntities( result.title.rendered || '' ) ||
								__( '(no title)' ),
							type: result.type,
							kind: 'media',
						};
					} );
				} )
				.catch( () => [] ) // Fail by returning no results.
		);
	}

	const responses = await Promise.all( queries );

	let results = responses.flat();
	results = results.filter( ( result ) => !! result.id );
	// Deduplicate by id — slug queries may return results already found by the title search.
	const seen = new Set< number | string >();
	results = results.filter( ( result ) => {
		if ( seen.has( result.id ) ) {
			return false;
		}
		seen.add( result.id );
		return true;
	} );
	results = sortResults( results, search );
	results = results.slice( 0, perPage );
	return results;
}

/**
 * Sort search results by relevance to the given query.
 *
 * Sorting is necessary as we're querying multiple endpoints and merging the results. For example
 * a taxonomy title might be more relevant than a post title, but by default taxonomy results will
 * be ordered after all the (potentially irrelevant) post results.
 *
 * We sort by scoring each result, where the score is the number of tokens in the title that are
 * also in the search query, divided by the total number of tokens in the title. This gives us a
 * score between 0 and 1, where 1 is a perfect match.
 *
 * Priority order: exact title match > exact slug match > fuzzy title match > fuzzy slug match.
 *
 * Slug matching improves findability when the title and slug differ — for example, when the
 * title contains characters not allowed in slugs (such as umlauts).
 *
 * @param results
 * @param search
 */
export function sortResults( results: SearchResult[], search: string ) {
	const searchTokens = tokenize( search );

	const scores = {};
	for ( const result of results ) {
		let exactTitleScore = 0;
		let subTitleScore = 0;
		let exactSlugScore = 0;
		let subSlugScore = 0;

		// Title scoring.
		if ( result.title ) {
			const titleTokens = tokenize( result.title );
			if ( titleTokens.length > 0 ) {
				const exactMatchingTokens = titleTokens.filter(
					( titleToken ) =>
						searchTokens.some(
							( searchToken ) => titleToken === searchToken
						)
				);
				const subMatchingTokens = titleTokens.filter( ( titleToken ) =>
					searchTokens.some(
						( searchToken ) =>
							titleToken !== searchToken &&
							titleToken.includes( searchToken )
					)
				);
				exactTitleScore =
					exactMatchingTokens.length / titleTokens.length;
				subTitleScore = subMatchingTokens.length / titleTokens.length;
			}
		}

		// Slug scoring: slugs may differ from titles (e.g. umlauts are not allowed in slugs),
		// so matching against the slug improves findability.
		if ( result.url ) {
			const slug = getSlugFromUrl( result.url );
			const slugTokens = tokenize( slug );

			if ( slugTokens.length > 0 ) {
				const exactSlugMatchingTokens = slugTokens.filter(
					( slugToken ) =>
						searchTokens.some(
							( searchToken ) => slugToken === searchToken
						)
				);
				const subSlugMatchingTokens = slugTokens.filter(
					( slugToken ) =>
						searchTokens.some(
							( searchToken ) =>
								slugToken !== searchToken &&
								slugToken.includes( searchToken )
						)
				);
				exactSlugScore =
					exactSlugMatchingTokens.length / slugTokens.length;
				subSlugScore = subSlugMatchingTokens.length / slugTokens.length;
			}
		}

		// Use non-overlapping priority bands to guarantee strict ordering:
		// exact title > exact slug > fuzzy title > fuzzy slug.
		// Each ratio is in [0, 1], so multipliers of 1000 / 100 / 10 / 1
		// ensure no lower-priority combination can outrank a higher-priority match.
		scores[ result.id ] =
			exactTitleScore * 1000 +
			exactSlugScore * 100 +
			subTitleScore * 10 +
			subSlugScore;
	}

	return results.sort( ( a, b ) => scores[ b.id ] - scores[ a.id ] );
}

/**
 * Extracts the slug from a URL by returning the last non-empty path segment.
 *
 * For example, `"https://example.com/parent/an-example/"` returns `"an-example"`.
 *
 * @param url
 */
function getSlugFromUrl( url: string ): string {
	if ( ! url ) {
		return '';
	}
	// Strip protocol and host, then split the remaining path into segments.
	const path = url.replace( /^https?:\/\/[^/]+/, '' );
	const segments = path.split( '/' ).filter( Boolean );
	return segments[ segments.length - 1 ] ?? '';
}

/**
 * Turns text into an array of tokens, with whitespace and punctuation removed.
 *
 * For example, `"I'm having a ball."` becomes `[ "im", "having", "a", "ball" ]`.
 *
 * @param text
 */
export function tokenize( text: string ): string[] {
	// \p{L} matches any kind of letter from any language.
	// \p{N} matches any kind of numeric character.
	return text.toLowerCase().match( /[\p{L}\p{N}]+/gu ) || [];
}
