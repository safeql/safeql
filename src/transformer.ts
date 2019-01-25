import * as ts from 'typescript'

export interface TransformerOptions {}

export function transformer(program: ts.Program, opts?: TransformerOptions) {
	function visitor(ctx: ts.TransformationContext, sf: ts.SourceFile) {
		const typeChecker = program.getTypeChecker()

		const visitor: ts.Visitor = (node: ts.Node) => {
			if (isRttiCall(sf, node)) {
				const [type] = node.typeArguments
				const [argument] = node.arguments
				const fn = ts.createIdentifier('__rtti__generate')
				const typeName = type.getText()
				const typeSource = getDescriptor(type, typeChecker)
				return ts.createCall(fn, undefined, [
					argument || ts.createStringLiteral(typeName),
					typeSource,
				])
			}
			return ts.visitEachChild(node, visitor, ctx)
		}

		return visitor
	}

	return (ctx: ts.TransformationContext) => {
		return (sf: ts.SourceFile) => ts.visitNode(sf, visitor(ctx, sf))
	}
}

function isRttiCall(
	sf: ts.SourceFile,
	node: ts.Node,
): node is ts.CallExpression & {typeArguments: ts.NodeArray<ts.TypeNode>} {
	return (
		ts.isCallExpression(node) &&
		node.typeArguments !== undefined &&
		node.expression.getText(sf) === 'generateRtti'
	)
}
