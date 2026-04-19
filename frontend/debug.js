const fs = require('fs')
const code = fs.readFileSync('src/App.jsx', 'utf-8')
const newCode = code.replace('<Environment preset="city" />', '<Environment preset="city" />\n        <gridHelper args={[10, 10]} />\n        <axesHelper args={[5]} />')
fs.writeFileSync('src/App.jsx', newCode)
