//static object in client app.
// core API to access iframe (google account, address, sign)
class WalletFactoryApi {

    getAccount() {
        error('return current google logged in account email account, or null')
    }

    getOwner() {
        error("return owner's address (a cookie in an iframe)")
    }

    async googleLogin() {
        error("open google auth popup. save to localStorage email,address. return {jwt, email, address}. throw if canceled/failed")
    }

    async googleAuthenticate() {
        error( "return fresh JWT token, with no UI (almost identical to googleLogin())")
    }

    async getVaultAddress(account) {
        error( "return the CREATE2 wallet address (valid even before created)")
    }

    async hasWallet(account) {
        error("check if a wallet exists for this account (its 'create2' address deployed)")
    }

    async loadWallet(account) {
        error("return a SampleWallet object for this account")
    }

    async createAccount({jwt, smsUrl}) {
        error("create a new account (not contract) for user on BE. return approvalData")
    }

    createVault({owner, approvalData}) {
        error('create contract via GSN')
    }

    recoverWallet({owner, account}) {
        error("trigger recover flow")
    }

    signTransaction({address, tx}) {
        error("access iframe and sign tx on behalf of user. address must be the getOwner account")
    }
}

function error(msg) {
    throw new Error(msg)
}