
//API of the main factory object.
class FactoryApi {

    getAccount() {
        error('current google logged in account email account, or null')
    }

    googleLogin() {
        error( "redirect to google auth, and redirect back. iframe is now auth'ed with google" )
    }

    getOwner() {
        error( "return owner's address (a cookey in an iframe)" )
    }

    hasWallet(account) {
        error( "check if a wallet exists for this account (its 'create2' address deployed)" )
    }

    loadWallet(account) {
        error( "return a SampleWallet object for this account" )
    }
    createWallet(owner, account) {
        error( 'trigger create-account flow. should create a "fresh" OAuth token, with owner address as nonce' )
    }

    createWallet2(owner, account, token) {
        error("once token is signed, create a wallet for user.")
    }

    recoverWallet(owner, account) {
        error("trigger recover flow")
    }
}


