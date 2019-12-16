import { spawn } from 'child_process'

let ls

export async function startBackendServer ({ port = 8888 }) {
  return await new Promise((resolve, reject) => {
    console.log( "== dir=", __dirname)
    console.log( "== file=", __filename)
    console.log( "==runserver = ", __dirname + '/../../sample/src/js/backend/runServer.js')
    ls = spawn('node', ['-r', 'esm', __dirname + '/../../../sample/src/js/backend/runServer.js', port, '--dev'])
    let serverAddress
    ls.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`)
      const m = data.toString().match(/address=(.*)/ )
      if (m)
        serverAddress = m[1]
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
  ls.kill(9)
}