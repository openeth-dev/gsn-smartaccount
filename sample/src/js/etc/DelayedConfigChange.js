import DelayedOperation from './DelayedOperation'

export default class DelayedConfigChange extends DelayedOperation {
  constructor ({ txHash, delayedOpId, dueTime, state, operations }) {
    super({ txHash, delayedOpId, dueTime, state })
    this.operations = operations
  }
}
