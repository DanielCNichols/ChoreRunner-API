import esbuild from 'esbuild'
import fs from 'fs'
import path from 'path'

function getDirectories(path) {
  return fs.readdirSync(path).filter(item => fs.statSync(path + '/' + item).isDirectory())
}

function getLambdaDirs(sourceDir) {
  const directories = getDirectories(sourceDir)

  const lambdaDirs = []

  directories.forEach(dir => {
    const lambdaPath = path.join('src', dir, 'index.ts')

    if (fs.existsSync(lambdaPath)) {
      //call build
      console.log('Lambda dir found: ' + dir)
      lambdaDirs.push(lambdaPath)

    } else {
      console.log('Not a lambda directory. Skipping bundling')
    }
  })

  return lambdaDirs
}

const entryPoints = getLambdaDirs('./src')

console.log(entryPoints)

let ctx = await esbuild.context({
  entryPoints: entryPoints,
  bundle: true,
  platform: 'node',
  outdir: 'dist',
  sourcemap: true,
  target: 'node20',
})

await ctx.watch()
