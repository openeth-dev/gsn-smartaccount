//static object in client app.
// core API to access iframe (google email, address, sign)
class WalletFactoryApi {

    //wrapper calls for the background IFRAME:

    getEmail() {
        error('iframe: return current google logged in email (google account), or null')
    }

    getOwner() {
        error("iframe: return owner's address (a cookie in an iframe)")
    }

    async googleLogin() {
        error("iframe: open google auth popup. save to localStorage email,address. return {jwt, email, address}. throw if canceled/failed")
    }

    async googleAuthenticate() {
        error( "iframe: return fresh JWT token, with no UI (almost identical to googleLogin())")
    }

    async getWalletAddress(email) {
        error( "return the CREATE2 wallet address (valid even before created)")
    }

    async hasWallet(email) {
        error("check if a wallet exists for this email (its 'create2' address deployed)")
    }

    async loadWallet(email) {
        error("return a SampleWallet object for this email (after it was created)")
    }

    async createAccount({jwt, smsVerificationCode}) {
        error("create user account (mapping of email/userinfo/phone on BE, not contract). return approvalData")
    }

    createWallet({owner, email, approvalData}) {
        error('create contract via GSN')
    }

    recoverWallet({owner, email}) {
        error("trigger recover flow")
    }
}

function error(msg) {
    throw new Error(msg)
}