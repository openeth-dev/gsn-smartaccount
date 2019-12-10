/* global prompt alert */
/* eslint  "react/prop-types":"off"   */

import React from 'react'
import './App.css'

import SimpleManagerMock from '../js/mocks/SimpleManager.mock'
import AccountProxy from '../js/impl/Account.proxy'

var mgr, sms
const Button = ({ title, action }) => <input type="submit" onClick={action}
  value={title}/>

function GoogleLogin ({ refresh }) {
  async function login () {
    const { jwt } = await mgr.googleLogin()
    refresh({ jwt })
  }

  return <div>
    Youre not logged in
    <Button title="click to login" action={login}/>
  </div>
}

function CreateWallet ({ refresh, jwt, email }) {
  let phone
  const startCreate = () => {
    phone = prompt('enter phone number to validate')
    if (!phone) {
      return
    }
    console.log('validate:', jwt, phone)
    mgr.validatePhone({ jwt, phone })
  }
  const createWallet = async () => {
    const smsVerificationCode = prompt('enter SMS verification code')
    if (!smsVerificationCode) {
      return
    }

    try {
      await mgr.createWallet({ jwt, phone, smsVerificationCode })
      refresh()
    } catch (e) {
      refresh(e)
    }
  }
  return <div>
    Hello <b>{email}</b>, you dont have a wallet yet.<br/>
    Click <Button title="here to verify phone" action={startCreate}/><br/>
    Click here to enter SMS verification code <Button title="verify"
      action={createWallet}/>
  </div>
}

function ActiveWallet ({ walletInfo }) {
  const info = JSON.stringify(walletInfo, null, 2)
  return <pre>
    Wallet Info:
    {info}
  </pre>
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
    return <GoogleLogin {...options}/>
  }
  if (!walletAddr) {
    return <CreateWallet {...options} />
  }
  if (!walletInfo) {
    return <RecoverOrNewDevice {...options} />
  }

  return <ActiveWallet {...options} />
  // return <RecoverOrNewDevice />
}

class App extends React.Component {
  constructor (props) {
    super(props)
    mgr = new SimpleManagerMock({ accountApi: new AccountProxy() })
    sms = mgr.smsApi
    sms.on('mocksms', (data) => {
      setTimeout(() => {
        alert('Received SMS to ' + data.phone + ':\n' + data.message)
      }, 1000)
    })

    this.state = {}
    this.readMgrState().then(x => { this.state = x })
  }

  async readMgrState () {
    // if (!global.launchedOnce) {
    //   global.launchedOnce = false
    //   await new Promise(resolve => {
    //     setTimeout(resolve, 200)
    //   })
    // }
    const mgrState = {
      ownerAddr: await mgr.getOwner(),
      walletAddr: await mgr.getWalletAddress(),
      email: await mgr.getEmail(),
      walletInfo: undefined
    }
    // TODO: this is hack: we want to check if it already loaded, not load it.
    if (mgr.wallet) {
      const wallet = await mgr.loadWallet()
      mgrState.walletInfo = wallet.getWalletInfo()
    }
    return mgrState
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
      await mgr.createWallet({ jwt, phone: '123', smsVerificationCode: 'v123' })
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
          <input type="checkbox" value={this.state.debug} onClick={() => this.toggleDebug()} />
          Debug state
          {
            this.state.debug && <xmp>{JSON.stringify(this.state, null, 4)}</xmp>
          }
        </div>
        {
          !!mgr.wallet ||
          <div><Button title="debug: activate wallet"
            action={this.debugActiveWallet.bind(this)}/><p/></div>
        }
        <Button title="signout" action={this.signout.bind(this)}/><p/>
        <WalletComponent
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
