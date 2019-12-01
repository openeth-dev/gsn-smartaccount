//API of the main factory object.
class BEapi {

    constructor() {
        //validate child contract implemented all core functions
        require('./XfaceValidate')(BEapi, this)
    }

    validatePhone({jwt, phone}) {
        error("validate jwt, return SMS url to pass to createVault")
    }

    createAccount({jwt, smsUrl}) {
        error("validate fresh jwt, validate phone (from smsUrl). return approvalData")
    }

    addDeviceNow({jwt, newaddr}) {
        error('validate jwt, return "click to add" SMS')
    }

    handleNotifications() {
        error('monitor pending changes. can subscribe for events, but need also to handle due events.')
    }

}


module.exports = {BEapi}