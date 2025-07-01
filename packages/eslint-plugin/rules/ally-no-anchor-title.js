module.exports = {
	meta: {
		type: 'problem',
		messages: {
			noAnchorTitle: 'Do not use title attribute on <a> elements.',
		},
	},
	create( context ) {
		return {
			JSXOpeningElement( node ) {
				const tagName = node.name && node.name.name;
				if ( tagName !== 'a' ) {
					return;
				}

				node.attributes.forEach( ( attr ) => {
					if (
						attr.type === 'JSXAttribute' &&
						attr.name &&
						attr.name.name === 'title'
					) {
						context.report( {
							node: attr,
							messageId: 'noAnchorTitle',
						} );
					}
				} );
			},
		};
	},
};
