function sig (method) {
  const str = method.toString().replace(/\s+/g, ' ')
  const regex = str.match(/^((?:async)?\s*\w+\s*\(.*?\))/)
  return regex[1]
}
/* eslint-disable no-proto */
export default function validate (baseClass, inst) {
  if (!baseClass.prototype) {
    throw new Error(`${baseClass}: not a class (no "prototype")`)
  }
  if (!inst.__proto__) {
    throw new Error(`${inst}: not an object instance (no "__proto_")`)
  }

  const impl = {}
  const errors = []
  Object.getOwnPropertyNames(baseClass.prototype).forEach(name => {
    if (name[0] === '_') return // ignore methods starting with "_"
    impl[name] = true
    if (inst.abstract) return // a member named "abstract" skip the "missing implementation" check
    if (baseClass.prototype[name] === inst[name]) {
      // only report if baseclass method is not "really implemented"
      if (!baseClass.prototype[name].toString().match(/error\(/)) {
        return
      }
      errors.push('Baseclass method not implemented: ' + name)
    }
    if (name !== 'constructor') {
      const baseSig = sig(baseClass.prototype[name])
      const instSig = sig(inst[name])
      if (baseSig !== instSig) {
        errors.push(
          'Wrong method signature: ' + instSig + '\n' +
          '             should be: ' + baseSig)
      }
    }
  })
  Object.getOwnPropertyNames(inst.__proto__).forEach(name => {
    if (name[0] === '_') return // ignore methods starting with "_"

    if (!impl[name] && name !== 'abstract') {
      errors.push('Implemented method not in baseclass: ' + name)
    }
  })
  if (errors && errors.length) {
    throw new Error(
      'Interface error for class ' + inst.constructor.name + ': \n' +
    errors.join('\n'))
  }
}
