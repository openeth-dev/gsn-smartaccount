export function buf2hex (buf) {
  return '0x' + buf.toString('hex')
}

export function hex2buf (str) {
  return Buffer.from(str.replace(/^0x/, ''), 'hex')
}

// params are {key:val, key:val} validate none of them is 'null' or 'undefined'
// usage: just after method call, use nonNull({param1,param2})
export function nonNull (params) {
  if (arguments.length > 1 || typeof params !== 'object') { throw new Error('usage: nonNull({param1,param2,..})') }
  Object.entries(params).forEach(e => {
    if (typeof e[1] === 'undefined' || e[1] === 'null') {
      throw new Error('Unexpected ' + e[0] + '=' + e[1])
    }
  })
}
