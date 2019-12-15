import DelayedOperation from './DelayedOperation'

// TODO: fail to construct this object if the ERC20 transaction has a
export default class DelayedTransfer extends DelayedOperation {
  constructor ({ txHash, delayedOpId, dueTime, state, operation, tokenSymbol, value, destination }) {
    super({ txHash, delayedOpId, dueTime, state })
    this.operation = operation
    this.tokenSymbol = tokenSymbol
    this.value = value
    this.destination = destination
  }
}
