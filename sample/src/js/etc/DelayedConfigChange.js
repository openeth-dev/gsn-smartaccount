import DelayedOperation from './DelayedOperation'

export default class DelayedConfigChange extends DelayedOperation {
  // noinspection JSCommentMatchesSignature
  /**
   * @param operations - a list with at least one {@link ConfigEntry} object
   */
  constructor ({ txHash, delayedOpId, dueTime, state, operations }) {
    super({ txHash, delayedOpId, dueTime, state })
    this.operations = operations
  }
}
