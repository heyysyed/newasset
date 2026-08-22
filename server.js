const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = process.env.PORT || 3000
const DIST = path.join(__dirname, 'dist')

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf',
}

const server = http.createServer((req, res) => {
  let filePath = path.join(DIST, req.url === '/' ? 'index.html' : req.url)

  // If file doesn't exist, serve index.html (SPA routing)
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, 'index.html')
  }

  const ext = path.extname(filePath)
  const contentType = MIME[ext] || 'application/octet-stream'

  // Cache static assets for 1 year, html for no-cache
  const cacheControl = ext === '.html' ? 'no-cache' : 'public, max-age=31536000'

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404)
      res.end('Not found')
      return
    }
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': cacheControl })
    res.end(data)
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  AssetPro is running!\n`)
  console.log(`  Local:   http://localhost:${PORT}`)
  console.log(`  Network: http://${getLocalIP()}:${PORT}\n`)
})

function getLocalIP() {
  const nets = require('os').networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return 'localhost'
}
