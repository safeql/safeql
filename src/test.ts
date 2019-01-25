import SafeQL from './index'

interface Users {
	id: {type: string; primaryKey: true; unique: false}
	email: {type: string; primaryKey: false; unique: true}
	passwordHash: {type: string; primaryKey: false; unique: false}
	active: {type: boolean; primaryKey: false; unique: false}
}

type MyDatabase = {
	Users: Users
}

const client = SafeQL<MyDatabase>('postgres://postgres:banana@localhost:5432')

async function main1() {
	const result = await client('Users')
		.select('id', 'email', 'passwordHash', 'active')
		.where({id: 'abc'})
		.exec()
}

async function main2() {
	const table = client('Users')
	const selected = table.select('id', 'email', 'passwordHash', 'active')
	const where = selected.where({email: 'a'})
	const result = await where.exec()
}
