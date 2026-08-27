import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', 'build', 'public', '.vite', 'scratch']
const EXCLUDE_FILES = ['package-lock.json', '.DS_Store', 'bundle_code.mjs', 'context_bundle.txt']
const INCLUDE_EXTS = ['.js', '.jsx', '.json', '.sql', '.css', '.html']

function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir)
  
  for (const file of files) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    
    if (stat.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(file)) {
        walkDir(filePath, fileList)
      }
    } else {
      if (!EXCLUDE_FILES.includes(file) && INCLUDE_EXTS.includes(path.extname(file))) {
        fileList.push(filePath)
      }
    }
  }
  return fileList
}

function createBundle() {
  const rootDir = __dirname
  const outputFile = path.join(rootDir, 'context_bundle.txt')
  
  console.log('Scanning directories...')
  const files = walkDir(rootDir)
  
  let output = '# AssetPro Codebase Context Bundle\n\n'
  
  for (const file of files) {
    const relativePath = path.relative(rootDir, file)
    console.log(`Adding ${relativePath}`)
    const content = fs.readFileSync(file, 'utf8')
    
    output += `\n\n================================================================================\n`
    output += `FILE: ${relativePath}\n`
    output += `================================================================================\n\n`
    output += content
  }
  
  fs.writeFileSync(outputFile, output)
  console.log(`\nSuccessfully bundled ${files.length} files into ${outputFile}`)
}

createBundle()
