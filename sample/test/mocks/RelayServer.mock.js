import Web3Utils from 'web3-utils'
import Web3 from 'web3'

export default class RelayServerMock {
  constructor ({ mockHubContract, relayServerAddress, web3provider }) {
    this.web3 = new Web3(web3provider)
    this.mockHubContract = mockHubContract
    this.relayServerAddress = relayServerAddress
  }

  send (url, jsd, callback) {
    if (url.includes('http://mock.relay.event/getaddr')) {
      callback(null, {
        Ready: true,
        MinGasPrice: 0,
        RelayServerAddress: this.relayServerAddress,
        relayUrl: 'http://mock.relay.event',
        transactionFee: 0
      })
    } else if (url.includes('http://mock.relay.event/relay')) {
      const sig = Web3Utils.bytesToHex(jsd.signature)
      const appr = Web3Utils.bytesToHex(jsd.approvalData)
      const encodeABI = this.mockHubContract.contract.methods.relayCall(
        jsd.from, jsd.to, jsd.encodedFunction,
        jsd.relayFee, jsd.gasPrice, jsd.gasLimit, jsd.RecipientNonce, sig, appr).encodeABI()
      this.mockHubContract.relayCall(
        jsd.from, jsd.to, jsd.encodedFunction,
        jsd.relayFee, jsd.gasPrice, jsd.gasLimit, jsd.RecipientNonce, sig, appr, {
          from: this.relayServerAddress,
          gasPrice: jsd.gasPrice,
          gas: jsd.gasLimit
        })
        .then(res => {
          if (!res.logs[0].args.success) {
            console.error('Relayed Transaction Failed', res.logs[0].args.message)
          }
          this.web3.eth.getTransactionCount(this.relayServerAddress)
            .then(nonce => {
              const relayedTx = {
                nonce: nonce - 1,
                v: res.receipt.v,
                r: res.receipt.r,
                s: res.receipt.s,
                gasPrice: jsd.gasPrice,
                gas: jsd.gasLimit,
                to: res.receipt.to,
                value: 0,
                input: encodeABI
              }
              callback(null, relayedTx)
            })
        })
    } else {
      throw Error(`Unknown mock relay operation: ${url}`)
    }
  }
}
