class Utils {
  static async getEvents (contract, eventName, options, constructor) {
    const events = await contract.getPastEvents(eventName, options)
    return events.map(e => {
      return new constructor(e)
    })
  }
}

module.exports = Utils
