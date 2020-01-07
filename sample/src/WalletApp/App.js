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
import { increaseTime } from './GanacheIncreaseTime'
import { toBN } from 'web3-utils'

let debug = getParam('debug')

function getParam (name) {
  const params = window.location.href.replace(/^.*#/, '')
  return params.indexOf(name) >= 0
}

// mock initialization:
const useMock = window.location.href.indexOf('#mock') > 0
const verbose = window.location.href.indexOf('#verbose') > 0

var mgr, sms, wallet, sdk
const Button = ({ title, action }) => <input type="submit" onClick={action} value={title}/>

// not directly belongs to the UI - but extract device name from userAgent..
function getDeviceName () {
  const userAgent = global.navigator && (navigator.userAgent || 'unknown')
  const deviceMatch = userAgent.match(/\((.*?)\)/)
  if (!deviceMatch) { return userAgent }

  console.log('== useragent:', userAgent)
  const names = deviceMatch[1].split(/\s*;\s*/)
  // TODO: Android is 2nd best: should return specific device type - if known.
  const ret = names.find(name => /Window|Mac|iP|Android|Pixel|SM-|Nexus/.test(name))
  return ret || deviceMatch
}

function GoogleLogin ({ refresh, initMgr }) {
  async function login () {
    try {
      await initMgr()
      const logininfo = await mgr.googleLogin()
      if (!logininfo || !logininfo.email) {
        return
      }
      const { jwt, email } = logininfo
      refresh({ jwt, email })
    } catch (e) {
      refresh({ err: e.message || e.error })
    }
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
    // local israeli phones...
    phoneNumber = phoneNumber.replace(/^0/, '+97254')
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

function TokenWidget ({ symbol, balance, decimals, doTransfer }) {
  const div = '1' + '0'.repeat(decimals || 0)
  return <pre>{symbol}: {balance / div} <Button title={'send ' + symbol} action={() => doTransfer({ symbol })}/></pre>
}

const PendingTransactions = ({ walletPending, doCancelPending }) =>
  <div>
    <b>Pending</b>
    {walletPending.map(p =>
      <div key={p.delayedOpId}>
        {p.operation} {p.tokenSymbol} {p.value / 1e18} {p.destination}
        <Button title="Cancel" action={() => doCancelPending(p.delayedOpId)}/>
      </div>)
    }
  </div>

function ActiveWallet ({ ownerAddr, walletInfo, walletBalances, walletPending, doTransfer, doCancelPending, doOldDeviceApproveOperator, reload }) {
  const info = JSON.stringify(walletInfo, null, 2)
  const pending = JSON.stringify(walletPending, null, 2)

  return <>
    <Button title="Add operator with code" action={doOldDeviceApproveOperator}/><br/>
    <b>Balances</b><br/>
    {
      walletBalances.map(token => <TokenWidget key={token.symbol} {...token} doTransfer={doTransfer}/>)
    }

    {
      walletPending.length ? <PendingTransactions walletPending={walletPending} doCancelPending={doCancelPending}/>
        : <b>No Pending Transactions</b>
    }

    {
      !walletInfo.operators.includes(ownerAddr) &&
      <div style={{ color: 'orange' }}>Warning: You are not an owner<br/>
        (probably did &quot;Signout&quot; to forget the privkey, and then re-logged in. But don&apos;t worry: you can do
        recover)
      </div>

    }
    <xmp>
      Pending: {pending}
    </xmp>
    <xmp>
      Wallet Info:
      {info}
    </xmp>
  </>
}

function RecoverOrNewDevice ({ email, doNewDeviceAddOperator }) {
  return <div>
    Hello <b>{email}</b>,
    You have wallet on-chain, but this device is not its operator.<br/>
    You can either<br/>
    <ul>
      <li><Button title="add new operator" action={doNewDeviceAddOperator}/> (requires approval on your old
        device) or,
      </li>
      <li><Button title="Recover your vault"/> (You dont need your old device,
        but it takes time
      </li>
    </ul>
  </div>
}

function DebugState ({ state }) {
  return debug && <>state={state}</>
}

function WalletComponent (options) {
  const { walletAddr, email, ownerAddr, walletInfo, loading, pendingAddOperatorNow } = options

  if (loading) {
    return <h2>Loading, please wait.</h2>
  }

  if (pendingAddOperatorNow) {
    return <>
      Sent an SMS to owner device. Once approved, this device will also become operator.
    </>
  }

  if (!email || !ownerAddr) {
    return <><DebugState state="noemail"/><GoogleLogin {...options}/></>
  }
  if (!walletAddr) {
    return <><DebugState state="nowalletAddr"/><CreateWallet {...options} /></>
  }
  if (!walletInfo ||
    !walletInfo.operators.includes(ownerAddr)) {
    return <><DebugState state="nowalletInfo"/><RecoverOrNewDevice {...options} /></>
  }

  return <ActiveWallet {...options} />
}

class App extends React.Component {
  constructor (props) {
    super(props)
    // manager is initialized (async'ly) from first call to readMgrState

    this.state = { debug, loading: true }
  }

  componentDidMount () {
    this.asyncHandler(this.initMgr())
  }

  // - call promise, update UI (either with good state, or error)
  asyncHandler (promise) {
    return promise.then(() => this.readMgrState().then(x => { this.setState(x) }))
      .catch(err => this.reloadState({ err: err.message || err.error }))
  }

  async readMgrState () {
    console.log('readMgrState')
    const mgrState = {
      loading: undefined,
      walletInfo: undefined,
      walletBalances: undefined,
      walletPending: undefined
    }
    if (sdk && await sdk.isEnabled({ appUrl: window.location.href })) {
      // read fields form wallet only once: they can't change (unless we logout)
      Object.assign(mgrState, {
        needApprove: undefined,
        ownerAddr: this.state.ownerAddress || await mgr.getOwner(),
        email: this.state.email || await mgr.getEmail(),
        walletAddr: this.state.walletAddr || await mgr.getWalletAddress()
      })
      console.log('readMgrState: has some state')
    } else {
      mgrState.needApprove = true
      console.log('not enabled', window.location.href)
    }

    if (mgrState.walletAddr) {
      if (!wallet) { wallet = await mgr.loadWallet() }
      mgrState.walletInfo = await wallet.getWalletInfo()
      mgrState.walletBalances = await wallet.listTokens()
      mgrState.walletPending = await wallet.listPendingTransactions()
      mgrState.walletPending.forEach((x, index) => { x.index = (index + 1).toString() })
      const web3 = new Web3(global.web3provider)
      mgrState.currentTime = new Date((await web3.eth.getBlock('latest')).timestamp * 1000).toString()
    }

    return mgrState
  }

  async initMgr () {
    if (mgr) {
      return // already initialized
    }
    if (useMock) {
      return this._initMockSdk()
    } else {
      return this._initRealSdk()
    }
  }

  async _initMockSdk () {
    // mock SDK...
    sdk = new SmartAccountSDK()
    sdk.account = new AccountProxy()

    mgr = new SimpleManagerMock({ accountApi: sdk.account })
    sms = mgr.smsApi
    sms.on('mocksms', (data) => {
      setTimeout(() => {
        alert('Received SMS to ' + data.phone + ':\n' + data.message)
      }, 1000)
    })
  }

  async _initRealSdk () {
    const serverURL = window.location.protocol + '//' + window.location.host.replace(/(:\d+)?$/, ':8888')

    // debug node runs on server's host. real node might use infura.
    const ethNodeUrl = window.location.protocol + '//' + window.location.host.replace(/(:\d+)?$/, ':8545')

    console.log('connecting to:', { serverURL, ethNodeUrl })
    const web3provider = new Web3.providers.HttpProvider(ethNodeUrl)
    global.web3provider = web3provider

    const backend = new ClientBackend({ serverURL })
    const { sponsor, factory } = (await backend.getAddresses())

    const relayOptions = {
      verbose,
      sponsor
    }
    sdk = await SmartAccountSDK.init({
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

    async function asyncDump (title, promise) {
      try {
        const res = await promise
        console.log(title, res)
        return res
      } catch (e) {
        console.log(title, e)
      }
    }

    if (await asyncDump('sdk.isEnabled', sdk.isEnabled({ appUrl: window.location.href }))) {
      const info = await sdk.account.googleAuthenticate()
      if (info) {
        this.state.email = info.email
        this.state.ownerAddress = info.address
        this.state.jwt = info.jwt
      }
    }
  }

  async doNewDeviceAddOperator () {
    if (window.confirm('Request to add this device as new operator?' + '\n' + getDeviceName())) {
      await mgr.signInAsNewOperator({ jwt: this.state.jwt, title: getDeviceName() })
      this.reloadState({ pendingAddOperatorNow: true })
    }
  }

  async doOldDeviceApproveOperator () {
    const smsCode = prompt('Enter code received by SMS')
    if (!smsCode) {
      return
    }

    const { newOperatorAddress, title } = await wallet.validateAddOperatorNow({ jwt: this.state.jwt, smsCode })
    if (!window.confirm('Add as new operator:\nDevice:' + title + '\naddr:' + newOperatorAddress)) {
      return
    }
    await wallet.addOperatorNow(newOperatorAddress)
  }

  async doCancelPending (delayedOpId) {
    if (!delayedOpId) {
      const id = prompt('Enter pending index to cancel')
      if (!id) return
      const p = JSON.parse(JSON.stringify(this.state.walletPending))
      console.log('looking for id', id, 'in', p)
      const pending = p.find(x => x.index === id)
      if (!pending) {
        alert('No pending item with index=' + id)
        return
      }
      delayedOpId = pending.delayedOpId
    } else {
      if (!window.confirm('Are you sure you want to cancel this operation?')) { return }
    }

    await wallet.cancelPending(delayedOpId)
    this.reloadState()
  }

  async doTransfer ({ symbol }) {
    let err
    try {
      const destination = prompt('Transfer ' + symbol + ' destination:')
      if (!destination) return
      const val = prompt('Transfer ' + symbol + ' amount:')
      if (!(val > 0)) return
      const tokinfo = this.state.walletBalances.find(b => b.symbol === symbol)
      const factor = '1' + '0'.repeat(tokinfo.decimals || 0)
      const amount = toBN(val * factor)

      // if (amount > this.state.walletBalances) {
      //   alert('you don\'t have that much.')
      //   return
      // }

      await wallet.transfer({ destination, amount, token: symbol })
    } catch (e) {
      err = e.message
    } finally {
      this.reloadState({ err: err })
    }
  }

  debugIncreaseTime () {
    const hours = 24
    if (!window.confirm('Perform increaseTime of ' + hours + ' hours')) { return }
    const web3 = new Web3(global.web3provider)
    console.log('increaseTime')
    increaseTime(3600 * hours, web3).then((ret) => {
      console.log('increaseTime ret=', ret)
      this.reloadState()
    })
  }

  debugReloadState () {
    console.log('DEBUG: reload state')
    this.reloadState()
  }

  reloadState (extra = {}) {
    const self = this
    this.readMgrState().then(mgrState => {
      debug = getParam('debug')
      const newState = { ...mgrState, ...extra, debug }
      console.log('newState', newState)
      self.setState(newState)
    })
  }

  async signout () {
    // TODO: currently, we initmgr means its online, though not strictly required for singout..
    await this.initMgr()
    await mgr.signOut()

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
    await this.initMgr()
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
    let url = window.location.href
    debug = getParam('debug')
    if (!debug) { url = url + '#debug' } else { url = url.replace(/#debug/, '') }
    window.location.replace(url)
    this.reloadState()
  }

  async enableApp () {
    try {
      await this.initMgr()
      await sdk.enableApp({ appTitle: 'SampleWallet', appUrl: window.location.href })
      this.reloadState()
    } catch (e) {
      this.reloadState({ err: e.message || e.error })
    }
  }

  async debugFundWallet () {
    const val = prompt('DEBUG: fund wallet with ETH')
    if (!val) return
    const walletAddr = this.state.walletInfo.address
    const web3 = new Web3(global.web3provider)
    const accounts = await web3.eth.getAccounts()
    await web3.eth.sendTransaction({ from: accounts[0], to: walletAddr, value: web3.utils.toBN(val * 1e18) })
    this.reloadState() // to see if wallet reads balance..
  }

  render () {
    return (
      <div style={{ margin: '10px' }}>
        <h1>SampleWallet app</h1>
        <div style={{ fontSize: '10px' }}>
          <input type="checkbox" checked={this.state.debug} onChange={() => this.toggleDebug()}/>
          Debug state = {debug}
          {
            this.state.debug &&
            <xmp>{JSON.stringify(this.state, null, 4)}</xmp>
          }
        </div>
        <div>
          {
            !!(useMock && !(mgr && mgr.wallet)) &&
            <Button title="DEBUG: activate wallet" action={this.debugActiveWallet.bind(this)}/>
          }
          <Button title="DEBUG: fund wallet with ETH" action={() => this.debugFundWallet()}/>
          <Button title="DEBUG: reloadState" action={() => this.debugReloadState()}/>
          <Button title="DEBUG: increaseTime" action={() => this.debugIncreaseTime()}/>
        </div>
        <Button title="signout" action={this.signout.bind(this)}/><p/>
        {
          this.state.needApprove &&
          <div><Button title="Must first connect app to iframe wallet" action={() => this.enableApp()}/></div>
        }
        {
          this.state.err &&
          <div style={{ color: 'red' }} onClick={() => this.setState({ err: undefined })}>
            <h2>Error: {this.state.err} </h2>
          </div>
        }
        <WalletComponent
          initMgr={() => this.initMgr()}
          doTransfer={params => this.doTransfer(params)}
          doCancelPending={params => this.doCancelPending(params)}
          doNewDeviceAddOperator={() => this.doNewDeviceAddOperator()}
          doOldDeviceApproveOperator={() => this.asyncHandler(this.doOldDeviceApproveOperator())}
          refresh={(extra) => this.reloadState(extra)} {...this.state} />

      </div>
    )
  }
}

export default App
