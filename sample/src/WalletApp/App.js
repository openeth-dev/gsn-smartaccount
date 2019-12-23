/* global prompt alert */
/* eslint  "react/prop-types":"off"   */

import React from 'react'
import './App.css'

import SimpleManagerMock from '../js/mocks/SimpleManager.mock'
import AccountProxy from '../js/impl/Account.proxy'
import Web3 from 'web3'
import ClientBackend from '../js/backend/ClientBackend'
import SmartAccountSDK from '../js/impl/SmartAccountSDK'
import SimpleManager from '../js/impl/SimpleManager'

var mgr, sms, wallet
const Button = ({ title, action }) => <input type="submit" onClick={action} value={title}/>

function GoogleLogin ({ refresh }) {
  async function login () {
    const logininfo = await mgr.googleLogin()
    if (!logininfo) { return }
    const { jwt } = logininfo
    refresh({ jwt })
  }

  return <div>
    Youre not logged in
    <Button title="click to login" action={login}/>
  </div>
}

function CreateWallet ({ refresh, jwt, email }) {
  let phoneNumber
  const startCreate = () => {
    phoneNumber = prompt('enter phone number to validate (put 1)')
    if (!phoneNumber) {
      return
    }
    if (phoneNumber === '1') {
      phoneNumber = '+972541234567'
    }
    console.log('validate:', jwt, phoneNumber)
    mgr.validatePhone({ jwt, phoneNumber })
  }
  const createWallet = async () => {
    const smsVerificationCode = prompt('enter SMS verification code')
    if (!smsVerificationCode) {
      return
    }

    try {
      await mgr.createWallet({ jwt, phoneNumber, smsVerificationCode })
      await mgr.setInitialConfiguration()

      refresh({ err: undefined })
    } catch (e) {
      refresh({ err: e.message })
    }
  }
  return <div>
    Hello <b>{email}</b>, you dont have a wallet yet.<br/>
    Click <Button title="here to verify phone" action={startCreate}/><br/>
    Click here to enter SMS verification code <Button title="verify" action={createWallet}/>
  </div>
}

function TokenWidget ({ token, balance, decimals, doTransfer }) {
  const div = '1e' + (decimals || 1)
  return <pre>{token}: {balance / div} <Button title={'send ' + token} action={() => doTransfer({ token })}/></pre>
}

function ActiveWallet ({ walletInfo, walletBalances, walletPending, doTransfer, doCancelPending }) {
  const info = JSON.stringify(walletInfo, null, 2)
  const pending = JSON.stringify(walletPending, null, 2)

  return <>
    Balances<br/>
    {
      walletBalances.map(token => <TokenWidget key={token.token} {...token} doTransfer={doTransfer}/>)
    }

    <Button title="Cancel Pending" action={doCancelPending}/>

    <xmp>
      Pending: {pending}
    </xmp>
    <xmp>
      Wallet Info: {info}
    </xmp>
  </>
}

function RecoverOrNewDevice ({ email, walletAddr }) {
  return <div>
    Hello <b>{email}</b>,
    You have wallet on-chain, but this device is not its operator.<br/>
    You can either<br/>
    <ul>
      <li><Button title="add new operator"/> (requires approval on your old
        device) or,
      </li>
      <li><Button title="Recover your vault"/> (You dont need your old device,
        but it takes time
      </li>
    </ul>
  </div>
}

function WalletComponent (options) {
  const { walletAddr, email, walletInfo } = options

  if (!email) {
    return <>noemail<GoogleLogin {...options}/></>
  }
  if (!walletAddr) {
    return <>nowalletAddr<CreateWallet {...options} /></>
  }
  if (!walletInfo) {
    return <>nowalletInfo<RecoverOrNewDevice {...options} /></>
  }

  return <ActiveWallet {...options} />
  // return <RecoverOrNewDevice />
}

class App extends React.Component {
  constructor (props) {
    super(props)
    // manager is initialized (async'ly) from first call to readMgrState

    this.state = {}
    this.initMgr().then(() =>
      this.readMgrState().then(x => { this.state = x }))
  }

  async readMgrState () {
    const mgrState = {
      ownerAddr: await mgr.getOwner(),
      walletAddr: await mgr.getWalletAddress(),
      email: await mgr.getEmail(),
      walletInfo: undefined,
      walletBalances: undefined,
      walletPending: undefined
    }

    // TODO: this is hack: we want to check if it already loaded, not load it.
    if (mgrState.walletAddr) {
      if (!wallet) { wallet = await mgr.loadWallet() }
      mgrState.walletInfo = await wallet.getWalletInfo()
      mgrState.walletBalances = await wallet.listTokens()
      mgrState.walletPending = await wallet.listPendingConfigChanges()
      mgrState.walletPending.forEach((x, index) => { x.index = index + 1 })
    }

    return mgrState
  }

  async initMgr () {
    // mock initialization:
    const useMock = window.location.href.indexOf('mock') > 0

    const verbose = true
    if (useMock) {
      mgr = new SimpleManagerMock({ accountApi: new AccountProxy() })
      sms = mgr.smsApi
      sms.on('mocksms', (data) => {
        setTimeout(() => {
          alert('Received SMS to ' + data.phone + ':\n' + data.message)
        }, 1000)
      })
      return
    }

    // real init below:

    const serverURL = window.location.protocol + '//' + window.location.host.replace(/(:\d+)?$/, ':8887')

    // debug node runs on server's host. real node might use infura.
    const ethNodeUrl = window.location.protocol + '//' + window.location.host.replace(/(:\d+)?$/, ':8545')

    console.log({ serverURL, ethNodeUrl })
    const web3provider = new Web3.providers.HttpProvider(ethNodeUrl)

    const backend = new ClientBackend({ serverURL })

    const { sponsor, factory } = (await backend.getAddresses())

    const relayOptions = {
      verbose,
      sponsor
    }
    const sdk = await SmartAccountSDK.init({
      network: web3provider,
      relayOptions
    })

    const factoryConfig = {
      provider: sdk.provider,
      factoryAddress: factory
    }

    mgr = new SimpleManager({
      accountApi: sdk.account,
      backend,
      factoryConfig
    })
  }

  async doCancelPending () {
    const id = prompt('Enter pending index to cancel')
    if (!id) return
    const p = JSON.parse(JSON.stringify(this.state.walletPending))
    console.log('looking for id', id, 'in', p)
    const pending = p.find(x => x.index === id)
    if (!pending) {
      alert('No pending item with index=' + id)
      return
    }

    wallet.cancelPending(pending.delayedOpId)
  }

  async doTransfer ({ token }) {
    const destination = prompt('Transfer ' + token + ' destination:')
    if (!destination) return
    const amount = prompt('Transfer ' + token + ' amount:')
    if (!(amount > 0)) return
    if (amount > this.state.walletBalances) {
      alert('you don\'t have that much.')
      return
    }

    await wallet.transfer({ destination, amount, token })
  }

  reloadState (extra) {
    const self = this
    this.readMgrState().then(mgrState => {
      const newState = { ...mgrState, ...extra }
      console.log('newState', newState)
      self.setState(newState)
    })
  }

  async login () {
    const { jwt, email } = await mgr.googleLogin()
    this.reloadState({ jwt, email })
  }

  signout () {
    mgr.signOut()

    // clear entire react state:
    const keys = Object.keys(this.state)
    const obj = this.state
    for (const k in keys) {
      obj[keys[k]] = undefined
    }
    console.log('signout state=', this.state)
    this.reloadState()
  }

  async debugActiveWallet () {
    const { jwt } = await mgr.googleLogin()
    // await mgr.validatePhone({jwt, phone:123})
    if (!await mgr.hasWallet()) {
      await mgr.createWallet({ jwt, phoneNumber: '123', smsVerificationCode: 'v123' })
      await mgr.setInitialConfiguration()
    } else {
      await mgr.loadWallet()
    }
    this.reloadState()
  }

  toggleDebug () {
    this.setState({ debug: !this.state.debug })
  }

  render () {
    return (
      <div style={{ margin: '10px' }}>
        <h1>SampleWallet app</h1>
        <div style={{ fontSize: '10px' }}>
          <input type="checkbox" value={this.state.debug} onClick={() => this.toggleDebug()}/>
          Debug state
          {
            this.state.debug && <xmp>{JSON.stringify(this.state, null, 4)}</xmp>
          }
        </div>
        {
          !!(mgr && mgr.wallet) ||
          <div><Button title="debug: activate wallet" action={this.debugActiveWallet.bind(this)}/><p/></div>
        }
        <Button title="signout" action={this.signout.bind(this)}/><p/>
        <WalletComponent
          doTransfer={params => this.doTransfer(params)}
          doCancelPending={params => this.doCancelPending(params)}
          refresh={(extra) => this.reloadState(extra)} {...this.state} />
        {
          this.state && this.state.err && <div style={{ color: 'red' }}>
            <h2>Error: {this.state.err} </h2>
          </div>
        }

      </div>
    )
  }
}

export default App
