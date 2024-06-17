
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
  const directories = getDirectories(sourceDir)

  directories.forEach(dir => {
    const lambdaPath = path.join('src', dir, 'index.ts')

    if (fs.existsSync(lambdaPath)) {
      //call build
      console.log('building ' + lambdaPath)
      build(lambdaPath, dir)
    } else {
      console.log('Not a lambda directory. Skipping bundling')
    }
  })
}

buildLambdas()