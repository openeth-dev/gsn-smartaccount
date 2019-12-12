export default class DelayedOperation {
  constructor ({ txHash, delayedOpId, dueTime, state }) {
    this.txHash = txHash
    this.delayedOpId = delayedOpId
    this.dueTime = dueTime
    this.state = state
  }
}