/* global global */
// this is the class loaded by the account.html frame.
import Account from '../impl/Account'
import AccountApi from '../api/Account.api'
// https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
let account
const verbose = true

// const enabledSites = {}
function initMessageHandler ({ window }) {
  console.log('initMessageHandler')
  if (!window) {
    throw new Error('missing {window}')
  }
  if (!window.localStorage) {
    throw new Error('missing {window.localStorage}')
  }

  account = new Account(window.localStorage)

  const onMessage = function onMessage ({ source, data }) {
    const { method, id, args: params } = data
    if (data === 'account-iframe-ping') {
      if (verbose) { console.log('got ping. resend "initialized" ') }

      // repeat "initialized"
      window.parent.postMessage('account-iframe-initialized', '*')
      return
    }
    if (typeof data.method !== 'string') {
      return
    }
    handleMessage({ source, method, id, params })
  }

  if (window.addEventListener) {
    // For standards-compliant web browsers
    window.addEventListener('message', onMessage, false)
  } else {
    window.attachEvent('onmessage', onMessage)
  }

  setImmediate(() => {
    console.log('AccountFrame initialized')
    // window.parent.postMessage('account-iframe-initialized', '*')
  })
}

async function handleMessage ({ source, method, id, params }) {
  // only accept methods defined in the API
  if (method === 'constructor' || !AccountApi.prototype[method]) {
    console.warn('invalid account message call: ', method)
    return
  }

  try {
    if (verbose) { console.log('iframe: called', id, method, params) }
    // enable is the only method allowed before prompting the use to enable
    if (method !== 'enableApp' && method !== 'isEnabled') {
      account._verifyApproved(method, source.location.href)
    }

    // console.log("src=",source.location.href)
    const methodToCall = account[method]

    const response = await methodToCall.apply(account, params)

    if (verbose) { console.log('iframe: resp', id, response) }

    source.postMessage({ id, response }, '*')
  } catch (e) {
    console.log('ex', e)
    source.postMessage({ id, error: e.toString() }, '*')
  }
}

global.initMessageHandler = initMessageHandler
