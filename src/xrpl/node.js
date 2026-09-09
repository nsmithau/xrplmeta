import EventEmitter from 'events'
import createSocket from '@xrplkit/socket'
import log from '@mwni/log'


const RECONNECT_BACKOFF_BASE_MS = 5000
const RECONNECT_BACKOFF_RATE_LIMIT_MS = 60000
const RECONNECT_BACKOFF_MAX_MS = 300000

function isRateLimited(reason){
	if(!reason || typeof reason !== 'string')
		return false
	const s = reason.toLowerCase()
	return s.includes('limit') || s.includes('rate') || s.includes('throttl')
}

export default class Node extends EventEmitter{
	constructor(config){
		super()

		this.config = config
		this.name = config.url
			.replace(/^wss?:\/\//, '')
			.replace(/:[0-9]+/, '')

		this.tasks = []
		this.availableLedgers = []
		this.reconnectAttempt = 0
		this.reconnectTimer = null

		this.connect()
	}

	connect(){
		if(this.reconnectTimer){
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}

		if(this.socket){
			try{ this.socket.close() }catch(_){}
			this.socket = null
		}

		this.socket = createSocket({
			url: this.config.url,
			autoReconnect: false
		})

		this.socket.on('transaction', tx => {
			this.emit('event', {hash: tx.transaction.hash, tx})
		})

		this.socket.on('ledgerClosed', ledger => {
			this.emit('event', {hash: ledger.ledger_hash, ledger})
			this.hasReportedClosedLedger = true

			if(ledger.validated_ledgers){
				this.availableLedgers = ledger.validated_ledgers
					.split(',')
					.map(range => range
						.split('-')
						.map(i => parseInt(i))
					)
			}
		})

		this.socket.on('open', async () => {
			this.reconnectAttempt = 0
			this.hasReportedClosedLedger = false
			this.emit('connected')

			try{
				await this.socket.request({
					command: 'subscribe',
					streams: ['ledger', 'transactions']
				})
			}catch(error){
				log.warn(`failed to subscribe to node "${this.name}":`)
				log.warn(error)
			}
		})

		this.socket.on('close', event => {
			this.error = event.reason
				? event.reason
				: `code ${event.code}`

			this.emit('disconnected')

			const rateLimited = isRateLimited(this.error)
			const delay = rateLimited
				? Math.min(
					RECONNECT_BACKOFF_RATE_LIMIT_MS * Math.pow(2, this.reconnectAttempt),
					RECONNECT_BACKOFF_MAX_MS
				)
				: Math.min(
					RECONNECT_BACKOFF_BASE_MS * Math.pow(2, this.reconnectAttempt),
					RECONNECT_BACKOFF_MAX_MS
				)

			this.reconnectAttempt++

			if(rateLimited){
				log.warn(
					`rate limited by ${this.name}, backing off ${delay / 1000}s before reconnect (attempt ${this.reconnectAttempt})`
				)
			}

			this.reconnectTimer = setTimeout(() => {
				this.reconnectTimer = null
				log.info(`reconnecting to ${this.name} ...`)
				this.connect()
			}, delay)
		})

		this.socket.on('error', error => {
			this.error = error.message
				? error.message
				: `unknown connection failure`

			this.emit('error')
		})
	}

	get status(){
		return this.socket.status()
	}

	bid(payload){
		if(this.busy || !this.status.connected || !this.hasReportedClosedLedger)
			return 0

		if(payload.command){
			if(payload.ticket){
				if(this.tasks.some(task => task.ticket === payload.ticket))
					return Infinity
				else
					return 0
			}

			if(payload.ledger_index && this.availableLedgers.length > 0){
				let hasLedger = payload.ledger_index === 'validated' || this.availableLedgers.some(
					([start, end]) => payload.ledger_index >= start && payload.ledger_index <= end
				)

				if(hasLedger)
					return 2
				else
					return 0
			}

			return 1
		}else if(payload.type === 'reserveTicket'){
			if(payload.node){
				if(payload.node !== this.name)
					return 0
			}

			return 1
		}
	}

	async do(payload){
		this.busy = true

		try{
			if(payload.command){
				return await this.socket.request(payload)
			}else if(payload.type === 'reserveTicket'){
				let ticket = Math.random()
					.toString(16)
					.toUpperCase()
					.slice(2, 10)
	
				this.tasks.push({
					type: payload.task,
					ticket,
					node: this.name
				})
	
				return {ticket}
			}
		}catch(error){
			throw error
		}finally{
			this.busy = false
		}
	}

	disconnect(){
		if(this.reconnectTimer){
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
		if(this.socket){
			this.socket.close()
			this.socket = null
		}
	}
}