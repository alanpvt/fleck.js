import fs from 'fs'
import klaw from 'klaw'
import Koa from 'koa'
import path from 'path'
import hbs from 'koa-hbs'
import Router from 'koa-router'
import through2 from 'through2'
import config from './config'

const pages = new Koa()
const router = new Router()

pages.use(hbs.middleware({
  viewPath: config.pagesDir,
  defaultLayout: 'default',
  disableCache: config.dev
}))

if (fs.existsSync(path.join(config.cwd, 'layouts'))) {
  hbs.layoutsPath = path.join(config.cwd, 'layouts')
}

if (fs.existsSync(path.join(config.cwd, 'partials'))) {
  hbs.partialsPath = path.join(config.cwd, 'partials')
}

const excludeDirFilter = through2.obj(function (item, e, next) {
  if (!item.stats.isDirectory()) this.push(item)
  next()
})

const hbsOnlyFilter = through2.obj(function (item, e, next) {
  if (item.path.endsWith('.hbs')) this.push(item)
  next()
})

klaw(config.pagesDir)
  .pipe(excludeDirFilter)
  .pipe(hbsOnlyFilter)
  .on('data', async (i) => {
    const _path = i.path.split(config.pagesDir)[1].split('.hbs')[0].slice(1)
    const _route = _path.endsWith('index') ? path.posix.join('/', _path, '..') : path.posix.join('/', _path)

    await import(path.resolve(config.pagesDir, `${_path}.js`))
      .then((_module) => {
        router.get(_route, async (ctx, next) => { _module.default(ctx); await next() })
      })
      .catch((error) => {
        if (error.code === 'MODULE_NOT_FOUND') {}
        else {
          console.log(error)
        }
      })
    
    router.get(_route, async (ctx, next) => { await ctx.render(_path) })
  })

pages.use(router.routes()).use(router.allowedMethods())

export default pages