class Utils {
    static async getEvents(contract, eventName, options, constructor) {
        let events = await contract.getPastEvents(eventName, options);
        return events.map(e => {
            return new constructor(e);
        })
    }
}

module.exports = Utils;