export function buf2hex (buf) {
  return '0x' + buf.toString('hex')
}

export function hex2buf (str) {
  return Buffer.from(str.replace(/^0x/, ''), 'hex')
}
