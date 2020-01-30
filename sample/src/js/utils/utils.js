function buf2hex (buf) {
  return '0x' + buf.toString('hex')
}

function hex2buf (str) {
  return Buffer.from(str.replace(/^0x/, ''), 'hex')
}

// params are {key:val, key:val} validate none of them is 'null' or 'undefined'
// usage: just after method call, use nonNull({param1,param2})
function nonNull (params) {
  if (arguments.length > 1 || typeof params !== 'object') { throw new Error('usage: nonNull({param1,param2,..})') }
  Object.entries(params).forEach(([name, val]) => {
    if (typeof val === 'undefined' || val === 'null') {
      throw new Error('Unexpected ' + name + '=' + val)
    }
    if (val.then) {
      throw new Error('Unexpected Promise ' + name + '. forgot await ?')
    }
  })
}

module.exports = { buf2hex, hex2buf, nonNull }
