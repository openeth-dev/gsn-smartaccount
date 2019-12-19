// hook the given provider:
//  hooks is { name:func, name:func.. }
// any call to send() or sendAsync() in the provider, where 'method' appears in 'hooks',
// will call the given hook instead.
// func signature: function(params,cb,origFunc)
//    params - param block from request.
//    cb - callback to call (err,resp)
export function hookRpcProvider (provider, hooks) {
  return new Proxy(provider, {
    get (target, propName) {
      const origfunc = target[propName]
      if (typeof origfunc !== 'function' || (propName !== 'send' && propName !== 'sendAsync')) {
        return origfunc
      }
      return function (rpccall, cb) {
        const origCallback = cb
        const func = hooks[rpccall.method]
        if (!func) {
          return origfunc.apply(target, arguments)
        }
        const wrapperCB = (err, res) => {
          const resp = {
            jsonrpc: rpccall.jsonrpc,
            id: rpccall.id,
            result: res,
            error: err
          }
          if (err) origCallback(resp)
          else origCallback(null, resp)
        }
        func(...rpccall.params).then(res => wrapperCB(null, res)).catch(err => wrapperCB(err))
      }
    }
  })
}
