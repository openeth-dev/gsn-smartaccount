import { spawn } from 'child_process'

let ls

export async function startBackendServer ({ port = 8888, factoryAddress, sponsorAddress }) {
  return new Promise((resolve, reject) => {
    const folder = __dirname
    ls = spawn('node', [
      '-r', 'esm', folder + '/../../../sample/src/js/backend/runServer.js',
      port, factoryAddress, sponsorAddress, '--dev'])
    let serverAddress
    ls.stdout.on('data', (data) => {
      process.stdout.write(`stdout: ${data}`)
      const m = data.toString().match(/address=(.*)/)
      if (m) { serverAddress = m[1] }
      if (data.includes('listening')) {
        resolve(serverAddress)
      }
    })
    ls.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`)
    })
    ls.on('close', (code) => {
      console.log(`child process exited with code ${code}`)
      reject(Error('process quit'))
    })
  })
}

export async function stopBackendServer () {
  if (ls) {
    ls.kill(9)
  }
}
