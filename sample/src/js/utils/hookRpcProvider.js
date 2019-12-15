// hook the given provider:
//  hooks is { name:func, name:func.. }
// any call to send() or sendAsync() in the provider, where 'method' appears in 'hooks',
// will call the given hook instead.
// func signature: function(params,cb,origFunc)
//    params - param block from request.
//    cb - callback to call (err,resp)
export function hookRpcProvider (provider, hooks) {
  return new Proxy(provider, {
    get (target, p) {
      const origfunc = target[p]
      if (typeof origfunc !== 'function' || (p !== 'send' && p !== 'sendAsync')) {
        return origfunc
      }
      return function (param, cb) {
        const func = hooks[param.method]
        if (func) {
          const wrapperCB = (err, res) => {
            const resp = {
              jsonrpc: param.jsonrpc,
              id: param.id,
              result: res,
              error: err
            }
            if (err) cb(resp)
            else cb(null, resp)
          }
          func(param.params, wrapperCB)
        } else {
          origfunc.apply(target, arguments)
        }
      }
    }
  })
}
