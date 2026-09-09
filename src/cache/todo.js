import { getAccountId, getTokenId } from '../db/helpers/common.js'

export function markCacheDirtyForAccountProps({ ctx, account }){
	if(ctx.backwards || ctx.snapshot)
		return

	let subject = getAccountId({ ctx, account })

	if(!subject)
		return

	ctx.db.cache.todos.createOne({
		data: {
			task: 'account.props',
			subject
		}
	})
}

export function markCacheDirtyForTokenProps({ ctx, token }){
	if(ctx.backwards || ctx.snapshot)
		return

	let subject = getTokenId({ ctx, token })

	if(!subject)
		return

	ctx.db.cache.todos.createOne({
		data: {
			task: 'token.props',
			subject
		}
	})
}

export function markCacheDirtyForTokenMetrics({ ctx, token, metrics }){
	if(ctx.backwards || ctx.snapshot)
		return

	let subject = getTokenId({ ctx, token })

	if(!subject)
		return

	for(let metric of Object.keys(metrics)){
		ctx.db.cache.todos.createOne({
			data: {
				task: `token.metrics.${metric}`,
				subject 
			}
		})
	}
}

export function markCacheDirtyForTokenExchanges({ ctx, token }){
	if(ctx.backwards || ctx.snapshot)
		return

	if(token.currency === 'XRP')
		return

	let subject = getTokenId({ ctx, token })

	if(!subject)
		return

	ctx.db.cache.todos.createOne({
		data: {
			task: 'token.exchanges',
			subject
		}
	})
}

export function markCacheDirtyForTokenIcons({ ctx, token }){
	if(ctx.snapshot)
		return

	let subject = getTokenId({ ctx, token })

	if(!subject)
		return

	ctx.db.cache.todos.createOne({
		data: {
			task: 'token.icons',
			subject
		}
	})
}

export function markCacheDirtyForAccountIcons({ ctx, account }){
	if(ctx.snapshot)
		return

	let subject = getAccountId({ ctx, account })

	if(!subject)
		return

	ctx.db.cache.todos.createOne({
		data: {
			task: 'account.icons',
			subject
		}
	})
}

const SNAPSHOT_TOKEN_TASKS = [
	'token.props',
	'token.exchanges',
	'token.metrics.trustlines',
	'token.metrics.holders',
	'token.metrics.supply',
	'token.metrics.marketcap',
	'token.icons'
]
const SNAPSHOT_ACCOUNT_TASKS = ['account.props', 'account.icons']

export function enqueueSnapshotCacheTodos({ ctx }){
	const tokens = ctx.db.core.tokens.readMany().slice(1)
	const accountIds = new Set()
	for(const token of tokens){
		if(token.issuer?.id)
			accountIds.add(token.issuer.id)
	}
	ctx.db.cache.tx(() => {
		for(const token of tokens){
			const subject = token.id
			for(const task of SNAPSHOT_TOKEN_TASKS){
				ctx.db.cache.todos.createOne({ data: { task, subject } })
			}
		}
		for(const subject of accountIds){
			for(const task of SNAPSHOT_ACCOUNT_TASKS){
				ctx.db.cache.todos.createOne({ data: { task, subject } })
			}
		}
	})
}