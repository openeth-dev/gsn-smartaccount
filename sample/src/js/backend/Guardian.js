export class Watchdog {
  constructor ({ smsProvider, backend, contract, web3provider }) {
    Object.assign(this, {
      smsProvider,
      backend,
      contract,
      web3provider
    })

    this.lastScannedBlock = 0
  }

  async start () {
    console.log('setting periodic task')
    this.task = await setInterval(this._worker, 100 * 2)
  }

  async stop () {
    clearInterval(this.task)
  }

  async _worker () {
    console.log('called me', Date.now())
    // const transferEvent = (await this.contract.getPastEvents('', { fromBlock: deployedBlock }))[0]
  }

  async _sendSms () {
  }
}
