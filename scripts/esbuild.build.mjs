
import esbuild from 'esbuild'
import path from 'path'
import fs from 'fs'

function getDirectories(path) {
  return fs.readdirSync(path).filter(item => fs.statSync(path + '/' + item).isDirectory())
}

function build(path, outDir) {
  esbuild.build({
    entryPoints: [path],
    bundle: true,
    platform: 'node',
    outdir: `dist/${outDir}`,
    sourcemap: true,
    target: 'node20',
  })
}


function buildLambdas(sourceDir) {
  // if dist exists, get rid of it
  if (fs.existsSync('./ dist')) {
    fs.rmdirSync('./dist')
  }

  const directories = getDirectories(sourceDir)

  directories.forEach(dir => {
    const lambdaPath = path.join('src', dir, 'index.ts')
    console.log('lambda path', lambdaPath)
    console.log(dir)

    if (fs.existsSync(lambdaPath)) {
      //call build
      console.log('building ' + lambdaPath)
      build(lambdaPath, dir)
    } else {
      console.log('Not a lambda directory. Skipping bundling')
    }
  })
}

buildLambdas('./src')