/**
 * Internal dependencies
 */
import {
	default as fetchLinkSuggestions,
	sortResults,
	tokenize,
} from '../__experimental-fetch-link-suggestions';

jest.mock( '@wordpress/api-fetch', () =>
	jest.fn( ( { path } ) => {
		switch ( path ) {
			case '/wp/v2/search?search=&per_page=20&type=post':
			case '/wp/v2/search?search=Contact&per_page=20&type=post&subtype=page':
				return Promise.resolve( [
					{
						id: 37,
						title: 'Contact Page',
						url: 'http://wordpress.local/contact-page/',
						type: 'post',
						subtype: 'page',
					},
				] );
			case '/wp/v2/search?search=&per_page=20&type=term':
			case '/wp/v2/search?search=cat&per_page=20&type=term&subtype=category':
				return Promise.resolve( [
					{
						id: 9,
						title: 'Cats',
						url: 'http://wordpress.local/category/cats/',
						type: 'category',
					},
					{
						id: 1,
						title: 'Uncategorized',
						url: 'http://wordpress.local/category/uncategorized/',
						type: 'category',
					},
				] );
			case '/wp/v2/search?search=&per_page=20&type=post-format':
				return Promise.resolve( [
					{
						id: 'gallery',
						title: 'Gallery',
						url: 'http://wordpress.local/type/gallery/',
						type: 'post-format',
						kind: 'taxonomy',
					},
					{
						id: 'quote',
						title: 'Quote',
						url: 'http://wordpress.local/type/quote/',
						type: 'post-format',
						kind: 'taxonomy',
					},
				] );
			case '/wp/v2/search?search=&per_page=3&type=post&subtype=page':
				return Promise.resolve( [
					{
						id: 11,
						title: 'Limit Case',
						url: 'http://wordpress.local/limit-case/',
						type: 'post',
						subtype: 'page',
					},
				] );
			case '/wp/v2/search?search=&page=11&per_page=20&type=post&subtype=page':
				return Promise.resolve( [
					{
						id: 22,
						title: 'Page Case',
						url: 'http://wordpress.local/page-case/',
						type: 'post',
						subtype: 'page',
					},
				] );
			case '/wp/v2/media?search=&per_page=20':
				return Promise.resolve( [
					{
						id: 54,
						title: {
							rendered: 'Some Test Media Title',
						},
						type: 'attachment',
						source_url:
							'http://localhost:8888/wp-content/uploads/2022/03/test-pdf.pdf',
					},
				] );
			// 'contact-page' slug lookup returns the matching page.
			case '/wp/v2/pages?slug=contact-page&per_page=20&_fields=id%2Clink%2Ctitle%2Ctype':
				return Promise.resolve( [
					{
						id: 37,
						link: 'http://wordpress.local/contact-page/',
						title: { rendered: 'Contact Page' },
						type: 'page',
					},
				] );
			default:
				// Slug-based queries for search terms not explicitly mocked above
				// return empty — no slug match found.
				if ( /\/wp\/v2\/(pages|posts)\?slug=/.test( path ) ) {
					return Promise.resolve( [] );
				}
				// Any other unhandled path rejects so it is caught by the
				// production code's .catch(() => []) and returns no results.
				// If a test expects data from this path it will fail, making
				// missing mock cases easy to spot without sentinel values leaking.
				return Promise.reject(
					new Error( `Unexpected API path in mock: ${ path }` )
				);
		}
	} )
);

describe( 'fetchLinkSuggestions', () => {
	it( 'filters suggestions by post-type', () => {
		return fetchLinkSuggestions( 'Contact', {
			type: 'post',
			subtype: 'page',
		} ).then( ( suggestions ) =>
			expect( suggestions ).toEqual( [
				{
					id: 37,
					title: 'Contact Page',
					type: 'page',
					url: 'http://wordpress.local/contact-page/',
					kind: 'post-type',
				},
			] )
		);
	} );
	it( 'filters suggestions by term', () => {
		return fetchLinkSuggestions( 'cat', {
			type: 'term',
			subtype: 'category',
		} ).then( ( suggestions ) =>
			expect( suggestions ).toEqual( [
				{
					id: 9,
					title: 'Cats',
					url: 'http://wordpress.local/category/cats/',
					type: 'category',
					kind: 'taxonomy',
				},
				{
					id: 1,
					title: 'Uncategorized',
					url: 'http://wordpress.local/category/uncategorized/',
					type: 'category',
					kind: 'taxonomy',
				},
			] )
		);
	} );
	it( 'filters suggestions by post-format', () => {
		return fetchLinkSuggestions( '', {
			type: 'post-format',
		} ).then( ( suggestions ) =>
			expect( suggestions ).toEqual( [
				{
					id: 'gallery',
					title: 'Gallery',
					url: 'http://wordpress.local/type/gallery/',
					type: 'post-format',
					kind: 'taxonomy',
				},
				{
					id: 'quote',
					title: 'Quote',
					url: 'http://wordpress.local/type/quote/',
					type: 'post-format',
					kind: 'taxonomy',
				},
			] )
		);
	} );
	it( 'filters does not return post-format suggestions when formats are not supported', () => {
		return fetchLinkSuggestions(
			'',
			{
				type: 'post-format',
			},
			{ disablePostFormats: true }
		).then( ( suggestions ) => expect( suggestions ).toEqual( [] ) );
	} );

	it( 'filters suggestions by attachment', () => {
		return fetchLinkSuggestions( '', {
			type: 'attachment',
		} ).then( ( suggestions ) =>
			expect( suggestions ).toEqual( [
				{
					id: 54,
					title: 'Some Test Media Title',
					url: 'http://localhost:8888/wp-content/uploads/2022/03/test-pdf.pdf',
					type: 'attachment',
					kind: 'media',
				},
			] )
		);
	} );

	it( 'returns suggestions from post, term, post-format and media', () => {
		return fetchLinkSuggestions( '', {} ).then( ( suggestions ) =>
			expect( suggestions ).toEqual( [
				{
					id: 37,
					title: 'Contact Page',
					url: 'http://wordpress.local/contact-page/',
					type: 'page',
					kind: 'post-type',
				},
				{
					id: 9,
					title: 'Cats',
					url: 'http://wordpress.local/category/cats/',
					type: 'category',
					kind: 'taxonomy',
				},
				{
					id: 1,
					title: 'Uncategorized',
					url: 'http://wordpress.local/category/uncategorized/',
					type: 'category',
					kind: 'taxonomy',
				},
				{
					id: 'gallery',
					title: 'Gallery',
					url: 'http://wordpress.local/type/gallery/',
					type: 'post-format',
					kind: 'taxonomy',
				},
				{
					id: 'quote',
					title: 'Quote',
					url: 'http://wordpress.local/type/quote/',
					type: 'post-format',
					kind: 'taxonomy',
				},
				{
					id: 54,
					title: 'Some Test Media Title',
					url: 'http://localhost:8888/wp-content/uploads/2022/03/test-pdf.pdf',
					type: 'attachment',
					kind: 'media',
				},
			] )
		);
	} );
	describe( 'Initial search suggestions', () => {
		it( 'initial search suggestions limits results', () => {
			return fetchLinkSuggestions( '', {
				type: 'post',
				subtype: 'page',
				isInitialSuggestions: true,
			} ).then( ( suggestions ) =>
				expect( suggestions ).toEqual( [
					{
						id: 11,
						title: 'Limit Case',
						url: 'http://wordpress.local/limit-case/',
						type: 'page',
						kind: 'post-type',
					},
				] )
			);
		} );

		it( 'should allow custom search options for initial suggestions', () => {
			return fetchLinkSuggestions( '', {
				type: 'term',
				subtype: 'category',
				page: 11,
				isInitialSuggestions: true,
				initialSuggestionsSearchOptions: {
					type: 'post',
					subtype: 'page',
					perPage: 20,
					page: 11,
				},
			} ).then( ( suggestions ) =>
				expect( suggestions ).toEqual( [
					{
						id: 22,
						title: 'Page Case',
						url: 'http://wordpress.local/page-case/',
						type: 'page',
						kind: 'post-type',
					},
				] )
			);
		} );

		it( 'should default any missing initial search options to those from the main search options', () => {
			return fetchLinkSuggestions( '', {
				type: 'post',
				subtype: 'page',
				page: 11,
				perPage: 20,
				isInitialSuggestions: true,
				initialSuggestionsSearchOptions: {
					// intentionally missing.
					// expected to default to those from the main search options.
				},
			} ).then( ( suggestions ) =>
				expect( suggestions ).toEqual( [
					{
						id: 22,
						title: 'Page Case',
						url: 'http://wordpress.local/page-case/',
						type: 'page',
						kind: 'post-type',
					},
				] )
			);
		} );
	} );
	it( 'allows searching from a page', () => {
		return fetchLinkSuggestions( '', {
			type: 'post',
			subtype: 'page',
			page: 11,
		} ).then( ( suggestions ) =>
			expect( suggestions ).toEqual( [
				{
					id: 22,
					title: 'Page Case',
					url: 'http://wordpress.local/page-case/',
					type: 'page',
					kind: 'post-type',
				},
			] )
		);
	} );

	it( 'returns a page found only by slug when no title matches', () => {
		// Searching 'contact-page' finds nothing via the title-search API, but
		// the slug query /wp/v2/pages?slug=contact-page returns the page.
		return fetchLinkSuggestions( 'contact-page', {
			type: 'post',
			subtype: 'page',
		} ).then( ( suggestions ) =>
			expect( suggestions ).toEqual( [
				{
					id: 37,
					title: 'Contact Page',
					url: 'http://wordpress.local/contact-page/',
					type: 'page',
					kind: 'post-type',
				},
			] )
		);
	} );
} );

describe( 'sortResults', () => {
	it( 'returns empty array for empty results', () => {
		expect( sortResults( [], '' ) ).toEqual( [] );
	} );

	it( 'orders results', () => {
		const results = [
			{
				id: 1,
				title: 'How to get from Stockholm to Helsinki by boat',
				url: 'http://wordpress.local/stockholm-helsinki-boat/',
				type: 'page',
				kind: 'post-type',
			},
			{
				id: 2,
				title: 'A day trip from Stockholm to Swedish countryside towns',
				url: 'http://wordpress.local/day-trip-stockholm/',
				type: 'page',
				kind: 'post-type',
			},
			{
				id: 3,
				title: 'The art of packing lightly: How to travel with just a cabin bag',
				url: 'http://wordpress.local/packing-lightly/',
				type: 'page',
				kind: 'post-type',
			},
			{
				id: 4,
				title: 'Tips for travel with a young baby',
				url: 'http://wordpress.local/young-baby-tips/',
				type: 'page',
				kind: 'post-type',
			},
			{
				id: 5,
				title: '', // Test that empty titles don't cause an error.
				url: 'http://wordpress.local/420/',
				type: 'page',
				kind: 'post-type',
			},
			{
				id: 6,
				title: 'City Guides',
				url: 'http://wordpress.local/city-guides/',
				type: 'category',
				kind: 'taxonomy',
			},
			{
				id: 7,
				title: 'Travel Tips',
				url: 'http://wordpress.local/travel-tips/',
				type: 'category',
				kind: 'taxonomy',
			},
		];
		const order = sortResults( results, 'travel tips' ).map(
			( result ) => result.id
		);
		expect( order ).toEqual( [
			7, // exact match
			4, // contains: travel, tips
			3, // contains: travel
			// same order as input:
			1,
			2,
			5,
			6,
		] );
	} );

	it( 'orders results to prefer direct matches over sub matches', () => {
		const results = [
			{
				id: 1,
				title: 'News',
				url: 'http://wordpress.local/news/',
				type: 'page',
				kind: 'post-type',
			},
			{
				id: 2,
				title: 'Newspaper',
				url: 'http://wordpress.local/newspaper/',
				type: 'page',
				kind: 'post-type',
			},
			{
				id: 3,
				title: 'News Flash News',
				url: 'http://wordpress.local/news-flash-news/',
				type: 'page',
				kind: 'post-type',
			},
			{
				id: 4,
				title: 'News',
				url: 'http://wordpress.local/news-2/',
				type: 'page',
				kind: 'post-type',
			},
		];
		const order = sortResults( results, 'News' ).map(
			( result ) => result.id
		);
		expect( order ).toEqual( [ 1, 4, 3, 2 ] );
	} );

	it( 'boosts results whose slug exactly matches the search query above fuzzy title matches with umlauts', () => {
		// Simulates the reported case: a page titled "Kursübersicht" whose slug is "kurse".
		// Searching "kurse" should surface it above pages that only partially match on title.
		const results = [
			{
				id: 1,
				title: 'Kursübersicht', // title only partially contains "kurse"
				url: 'http://wordpress.local/kurse/',
				type: 'page',
				kind: 'post-type',
			},
			{
				id: 2,
				title: 'Freies Training', // neither title nor slug matches
				url: 'http://wordpress.local/kurse/freies-training/',
				type: 'page',
				kind: 'post-type',
			},
			{
				id: 3,
				title: 'Kurse für Anfänger', // title contains "kurse" as an exact token
				url: 'http://wordpress.local/kurse/anfaenger/',
				type: 'page',
				kind: 'post-type',
			},
		];
		const order = sortResults( results, 'kurse' ).map(
			( result ) => result.id
		);
		// "Kurse für Anfänger" (id 3) has an exact title token match — highest priority.
		// "Kursübersicht" (id 1) has an exact slug match — second priority.
		// "Freies Training" (id 2) has no match — lowest priority.
		expect( order ).toEqual( [ 3, 1, 2 ] );
	} );

	it( 'boosts results whose slug exactly matches the search query above fuzzy title matches', () => {
		// A page titled "Events Overview" uses the slug "events" so it can serve
		// as a clean top-level URL. Searching "events" should still find it even
		// though the title token is "overview", not "events".
		const results = [
			{
				id: 1,
				title: 'Events Overview', // slug is exact match, title is a partial match
				url: 'http://wordpress.local/events/',
				type: 'page',
				kind: 'post-type',
			},
			{
				id: 2,
				title: 'Annual Gala', // no title or slug match
				url: 'http://wordpress.local/events/annual-gala/',
				type: 'page',
				kind: 'post-type',
			},
			{
				id: 3,
				title: 'Upcoming Events', // title contains "events" as an exact token
				url: 'http://wordpress.local/events/upcoming/',
				type: 'page',
				kind: 'post-type',
			},
		];
		const order = sortResults( results, 'events' ).map(
			( result ) => result.id
		);
		// "Events Overview" (id 1) has an exact slug match and an exact title token match — highest priority.
		// "Upcoming Events" (id 3) has an exact title token match — second priority.
		// "Annual Gala" (id 2) has no match — lowest priority.
		expect( order ).toEqual( [ 1, 3, 2 ] );
	} );

	it( 'ranks exact title matches above exact slug matches', () => {
		const results = [
			{
				id: 1,
				title: 'Kursübersicht', // exact slug match only
				url: 'http://wordpress.local/kurse/',
				type: 'page',
				kind: 'post-type',
			},
			{
				id: 2,
				title: 'Kurse', // exact title AND exact slug match
				url: 'http://wordpress.local/kurse-2/',
				type: 'page',
				kind: 'post-type',
			},
		];
		const order = sortResults( results, 'kurse' ).map(
			( result ) => result.id
		);
		expect( order ).toEqual( [ 2, 1 ] );
	} );

	it( 'ranks exact title matches above exact slug matches (English example)', () => {
		// "Shop" has both an exact title match and an exact slug match.
		// "Online Shopping Guide" only matches on slug "shop".
		const results = [
			{
				id: 1,
				title: 'Online Shopping Guide', // exact slug match only
				url: 'http://wordpress.local/shop/',
				type: 'page',
				kind: 'post-type',
			},
			{
				id: 2,
				title: 'Shop', // exact title match (slug differs)
				url: 'http://wordpress.local/store/',
				type: 'page',
				kind: 'post-type',
			},
		];
		const order = sortResults( results, 'shop' ).map(
			( result ) => result.id
		);
		expect( order ).toEqual( [ 2, 1 ] );
	} );
} );

describe( 'tokenize', () => {
	it( 'returns empty array for empty string', () => {
		expect( tokenize( '' ) ).toEqual( [] );
	} );

	it( 'tokenizes a string', () => {
		expect( tokenize( 'Hello, world!' ) ).toEqual( [ 'hello', 'world' ] );
	} );

	it( 'tokenizes non latin languages', () => {
		expect( tokenize( 'こんにちは、世界！' ) ).toEqual( [
			'こんにちは',
			'世界',
		] );
	} );
} );
