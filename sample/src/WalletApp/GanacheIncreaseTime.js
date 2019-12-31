export function increaseTime (time, web3) {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [time],
      id: Date.now()
    }, (err) => {
      if (err) return reject(err)
      evmMine(web3).then(r => resolve(r)).catch(e => reject(e))
    })
  })
}

export function evmMine (web3) {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_mine',
      params: [],
      id: Date.now()
    }, (e, r) => {
      if (e) reject(e)
      else resolve(r)
    })
  })
}
