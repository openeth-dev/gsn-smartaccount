/*
import React from 'react'
import { Gauth } from '../js/impl/Gauth'

export class DebugGauth extends React.Component {
  constructor (props) {
    super(props)
    this.gauth = new Gauth()
    this.gauth.init()
    this.doInfo = this.doInfo.bind(this)
    this.doSignIn = this.doSignIn.bind(this)
    this.doSignOut = this.doSignOut.bind(this)
  }

  async doInfo () {
    try {
      window.alert('info:' + JSON.stringify(await this.gauth.info()))
    } catch (e) {
      console.log('ex', e)
      window.alert(e.message)
    }
  }

  async doSignIn () {
    try {
      window.alert('signin:' + JSON.stringify(await this.gauth.signIn()))
    } catch (e) {
      console.log('ex', e)
      window.alert(e.message)
    }
  }

  async doSignOut () {
    try {
      window.alert('signout:' + JSON.stringify(await this.gauth.signOut()))
    } catch (e) {
      console.log('ex', e)
      window.alert(e.message)
    }
  }

  render () {
    return <div>
      <Button title="info" action={this.doInfo}/>
      <Button title="signin" action={this.doSignIn}/>
      <Button title="signout" action={this.doSignOut}/>
    </div>
  }
}
*/
