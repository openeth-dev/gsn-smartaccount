/* global localStorage */
import { hookRpcProvider } from '../utils/hookRpcProvider'
import { SponsorProvider } from 'gsn-sponsor'
import AccountProxy from './Account.proxy'
import Web3 from 'web3'

/**
 * SmartAccountSDK - client API to bring up the account API and provider.
 * getProvider() - return a web3 provider that uses the IFRAME
 * implements normal send,sendAcync
 */
export default class SmartAccountSDK {
  netUrl (network, infuraId = 'c3422181d0594697a38defe7706a1e5b') {
    if (network.toString().match(/mainnet|ropsten|rinkeby|kovan|goerli/)) {
      network = network + '.infura.io/api/v3/' + infuraId
    }
    return network
  }

  /**
   * Create a SmartAccountSDK object
   * @param network - network name mainnet/ropsten/etc or URL or provider
   * @param account - AccountApi to use (defaults to AccountProxy)
   * @param relayOptions - relay options (at minimum: sponsor address)
   * @param storage - account storage (defaults to localStorage)
   */
  static async init ({ network, relayOptions, storage, account }) {
    if (!account) {
      if (!storage) {
        storage = localStorage
      }
      account = new AccountProxy({ storage })
    }
    if (!network) {
      throw new Error('missing \'network\' (network-name/url/provider)')
    }
    const acc = new SmartAccountSDK()
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
    acc.account = account

    const signerProvider = hookRpcProvider(acc.origProvider, {
      eth_sign: async function (account, hash) {
        // TODO: I am afraid this will fail on capitalization, I want to add .toLowerCase; not sure if this is safe
        if (account !== await acc.account.getOwner()) {
          throw new Error('wrong signer: not valid account')
        }
        return acc.account.signMessageHash(hash)
      },
      eth_accounts: async function () {
        // TODO: should we return OWNER account, or SAFE account ?
        // currently, operations are "managed" ops, and thus require operator account.
        // once we become a "ProxyProvider", we want to use the getWallet account instead.
        return [await acc.account.getOwner()]
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
   * enable SmartAccountSDK for this app.
   * attempt to enable the Account object.
   * - if this app is already enabled, it will return immediately.
   * - otherwise, it will prompt the user to allow this app (title and URL) to use
   *   the SmartAccountSDK.
   * - exception is thrown if the user doesn't accept.
   * - account API is active only after enabling.
   * @param appTitle
   s   */
  async enableApp ({ appTitle, appUrl }) {
    return this.account.enableApp({ appTitle, appUrl })
  }

  async isEnabled ({ appUrl }) {
    return this.account.isEnabled({ appUrl })
  }
}
