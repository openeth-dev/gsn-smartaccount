import DelayedOperation from './DelayedOperation'

/**
 * Note: ERC20 transfers and Bypass Policy config changes are not contract calls
 */
export default class DelayedContractCall extends DelayedOperation {
  constructor ({ txHash, delayedOpId, dueTime, state, value, destination, data }) {
    super({ txHash, delayedOpId, dueTime, state })
    this.value = value
    this.destination = destination
    this.data = data
  }
}
