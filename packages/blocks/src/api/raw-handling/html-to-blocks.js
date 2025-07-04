/**
 * WordPress dependencies
 */
import { Platform } from '@wordpress/element';
import { store as editorStore } from '@wordpress/editor';

/**
 * Internal dependencies
 */
import { createBlock, findTransform } from '../factory';
import parse from '../parser';
import { getBlockAttributes } from '../parser/get-block-attributes';
import { getRawTransforms } from './get-raw-transforms';
import { select, dispatch } from '@wordpress/data';

function extractFootnotes( html ) {
	const footnotes = [];

	// Select all footnote spans inside <li>
	const spanNodes = html.querySelectorAll( 'ol.wp-block-footnotes span' );

	spanNodes.forEach( ( span ) => {
		const id = span.getAttribute( 'id' );
		const content = span.textContent.trim();
		if ( id || content ) {
			footnotes.push( { id, content } );
		}
	} );

	return footnotes;
}

/**
 * Converts HTML directly to blocks. Looks for a matching transform for each
 * top-level tag. The HTML should be filtered to not have any text between
 * top-level tags and formatted in a way that blocks can handle the HTML.
 *
 * @param {string}   html    HTML to convert.
 * @param {Function} handler The handler calling htmlToBlocks: either rawHandler
 *                           or pasteHandler.
 *
 * @return {Array} An array of blocks.
 */
export function htmlToBlocks( html, handler ) {
	const doc = document.implementation.createHTMLDocument( '' );

	doc.body.innerHTML = html;

	return Array.from( doc.body.children ).flatMap( ( node ) => {
		const rawTransform = findTransform(
			getRawTransforms(),
			( { isMatch } ) => isMatch( node )
		);

		if ( ! rawTransform ) {
			// Until the HTML block is supported in the native version, we'll parse it
			// instead of creating the block to generate it as an unsupported block.
			if ( Platform.isNative ) {
				return parse(
					`<!-- wp:html -->${ node.outerHTML }<!-- /wp:html -->`
				);
			}
			return createBlock(
				// Should not be hardcoded.
				'core/html',
				getBlockAttributes( 'core/html', node.outerHTML )
			);
		}

		const { transform, blockName } = rawTransform;

		if ( transform ) {
			const block = transform( node, handler );
			if ( node.hasAttribute( 'class' ) ) {
				block.attributes.className = node.getAttribute( 'class' );
			}

			if ( blockName === 'core/footnotes' ) {
				block.attributes.className =
					'block-editor-block-list__block wp-block wp-block-footnotes';
				node.className =
					'block-editor-block-list__block wp-block wp-block-footnotes';

				const currentMeta =
					select( editorStore ).getEditedPostAttribute( 'meta' );

				const footnotes = extractFootnotes( node );

				const newMeta = {
					...currentMeta,
					footnotes: JSON.stringify( footnotes ),
				};

				// shift the dispatch call for next tick to allow footnotes generation from `sup` tag.
				setTimeout(
					() => dispatch( editorStore ).editPost( { meta: newMeta } ),
					0
				);
			}

			return block;
		}

		return createBlock(
			blockName,
			getBlockAttributes( blockName, node.outerHTML )
		);
	} );
}
