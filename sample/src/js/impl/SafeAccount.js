/* global localStorage */
import { hookRpcProvider } from '../utils/hookRpcProvider'
import { SponsorProvider } from 'gsn-sponsor'
import AccountProxy from './Account.proxy'
import Web3 from 'web3'
/**
 * SafeAccount - client API to bring up the account API and provider.
 * getProvider() - return a web3 provider that uses the IFRAME
 * implements normal send,sendAcync
 */
export default class SafeAccount {
  netUrl (network, infuraId = 'c3422181d0594697a38defe7706a1e5b') {
    if (network.toString().match(/mainnet|ropsten|rinkeby|kovan|goerli/)) {
      network = network + '.infura.io/api/v3/' + infuraId
    }
    return network
  }

  /**
   * Create a SafeAccount object
   * @param network - network name mainnet/ropsten/etc or URL or provider
   * @param account - AccountApi to use (defaults to AccountProxy)
   * @param relayOptions - relay options (at minimum: sponsor address)
   * @param storage - account storage (defaults to localStorage)
   */
  static async init ({
    network,
    relayOptions,
    storage, account
  }) {
    if (!account) {
      if (!storage) {
        storage = localStorage
      }
      account = new AccountProxy({ storage })
    }
    if (!network) {
      throw new Error('missing \'network\' (network-name/url/provider)')
    }
    const acc = new SafeAccount()
    if (typeof network.send === 'function') {
      acc.origProvider = network
    } else {
      const url = acc.netUrl(network)
      if (url.startsWith('ws')) {
        acc.origProvider = new Web3.providers.WebsocketProvider(url)
      } else {
        acc.origProvider = new Web3.providers.HttpProvider(url)
      }
    }
    acc.account = account || new AccountProxy({ storage })

    const signerProvider = hookRpcProvider(acc.origProvider, {
      eth_sign: async function ([account, hash], cb) {
        if (account !== await acc.account.getOwner()) {
          cb(Error('wrong signer: not valid account'))
        }
        const sig = await acc.account.signMessageHash(hash)
        cb(null, sig)
      },
      eth_accounts: async function( cb ) {
        //TODO: should we return OWNER account, or SAFE account ?
        // currently, operations are "managed" ops, and thus require operator account.
        //once we become a "ProxyProvider", we want to use the getWallet account instead.
        return [ await acc.account.getOwner() ]
      }
    })
    acc.provider = await SponsorProvider.init(signerProvider, {
      proxyOwner: {
        address: 1 // not in use, not SponsorProvider requires non-undefined value.
      },
      ...relayOptions
    })

    return acc
  }

  /**
   * enable SafeAccount for this app.
   * attempt to enable the Account object.
   * - if this app is already enabled, it will return immediately.
   * - otherwise, it will prompt the user to allow this app (title and URL) to use
   *   the SafeAccount.
   * - exception is thrown if the user doesn't accept.
   * - account API is active only after enabling.
   * @param appTitle
   s   */
  async enable (appTitle) {
    return this.account.enable(appTitle)
  }
}
