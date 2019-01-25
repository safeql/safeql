/* tslint:disable */

import * as pg from 'pg'
import {Omit, StringKeys} from './utils/types'
import {unimplemented} from './utils'

type DatabaseLike<D> = {[K in keyof D]: SchemaLike<D[K]>}
export default function SafeQL<Database extends DatabaseLike<Database>>(
	uri: string,
) {
	return function buildTable<Name extends StringKeys<Database>>(
		name: Name,
	): TableWrapper<Database[Name], keyof Database[Name], false> {
		return new Table(name, uri)
		// return new TableWithOne(name, uri)
	}
}

type HiddenMethodList = 'exec' | 'one' | 'where'

type TableWrapper<
	S extends SchemaLike<S>,
	C extends keyof S,
	IP extends boolean,
	HM extends string = HiddenMethodList
> = Omit<Table<S, C, IP, HM>, HM>

class Table<
	/* The TypeScript schema of the table. Generated by schemats. */
	Schema extends SchemaLike<Schema>,
	/* The currently selected columns. Used to filter exec's return. */
	Columns extends keyof Schema,
	/* Will be true if a primary/unique key has appeared in a where condition.
	 * If true, exec will return a single item instead of an array. */
	IsPrimary extends boolean,
	/* Used to ensure that some methods are only called when the table is in a valid state. */
	HiddenMethods extends string = HiddenMethodList
> {
	private client: pg.Client
	protected unique = false

	constructor(
		/*public*/ private readonly name: string,
		private uri: string,
		private selector?: '*' | (keyof Schema)[],
		private filter?: {[col: string]: any},
	) {
		this.client = new pg.Client({connectionString: uri})
	}

	select<SelectedColumns extends StringKeys<Schema>>(
		...items: SelectedColumns[]
	): TableWrapper<
		Schema,
		SelectedColumns,
		IsPrimary,
		Exclude<HiddenMethods, 'exec' | 'where'>
	> {
		return new Table<
			Schema,
			SelectedColumns,
			IsPrimary,
			Exclude<HiddenMethods, 'exec' | 'where'>
		>(this.name, this.uri, items)
	}

	where<WhereColumn extends keyof Schema>(
		obj: Partial<Pick<ExtractType<Schema>, WhereColumn>>,
	): AtLeastOneUniqueKey<Schema, WhereColumn> extends true
		? Table<Schema, Columns, true>
		: Table<Schema, Columns, false> {
		return unimplemented()
	}

	exec<
		Picked extends Pick<Schema, Columns> = Pick<Schema, Columns>,
		Out = {[K in keyof Picked]: Picked[K]['type']}
	>(): IsPrimary extends true ? Promise<Out | null> : Promise<Out[]> {
		this.client.connect()
		if (!this.selector) {
			throw new Error('.select() not called')
		}

		let selectStr
		if (this.selector == '*') {
			selectStr = '*'
		} else {
			selectStr = this.selector.join(', ')
		}

		if (this.filter) {
			let whereStr = ''
			for (const [key, val] of Object.entries(this.filter)) {
				whereStr += `${key}='${val}' AND`
			}
			// Remove trailing AND
			whereStr = whereStr.slice(0, whereStr.length - 4)
			return this.client
				.query(
					`SELECT ${selectStr} FROM ${this.name} WHERE ${whereStr}`,
				)
				.then((result: any) => result.rows) as any
		}

		return this.client
			.query(`SELECT ${selectStr} FROM ${this.name}`)
			.then((result: any) =>
				JSON.parse(JSON.stringify(result.rows)),
			) as any
	}
}

// class TableWithOne<
// 	Schema extends SchemaLike<Schema>,
// 	Columns extends keyof Schema,
// 	IsPrimary extends boolean
// > extends Table<Schema, Columns, IsPrimary> {
// 	one(): Table<Schema, Columns, true> {
// 		this.unique = true
// 		return 1 as any
// 	}
// }

type HasTypeKey<T> = {
	[K in keyof T]: {
		type: any
	}
}
type ExtractType<T extends HasTypeKey<T>> = {[K in keyof T]: T[K]['type']}

type SchemaLike<T> = {
	[K in keyof T]: {type: any; primaryKey: boolean; unique: boolean}
}

type ExtractUniqueKeys<Schema extends SchemaLike<Schema>> = {
	[K in keyof Schema]: Schema[K]['primaryKey'] extends true
		? K
		: Schema[K]['unique'] extends true
		? K
		: never
}[keyof Schema]

type AtLeastOneUniqueKey<
	Schema extends SchemaLike<Schema>,
	ComparedKeys extends keyof Schema
> = ExtractUniqueKeys<Schema> & ComparedKeys extends never ? false : true
