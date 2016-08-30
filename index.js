var rollup = require('rollup')
var chokidar = require('chokidar')
var chalk = require('chalk')
var fs = require('fs')

var path = require('path')

var cache
var watchers = {}

var configPath = path.resolve(process.argv[2] || 'rollup.config.js')

// first read in the config file
rollup.rollup({ entry: configPath }).then(function (bundle) {
  var result = bundle.generate({ format: 'cjs' })
  var src = result.code
  var Module = module.constructor
  var m = new Module()
  m._compile(src, 'rollup.config.js.tmp')
  options = m.exports
  console.log('__rollup config loaded__')
  console.log(options)

  init(options)
}, function (err) {
  console.error(err)
  console.error('no rollup config file found [' + configPath + ']')
})

function init (options) {
  console.log('init called')
  console.log(options)

  var globalWatcher = null

  function log (text) {
    console.log(chalk.gray(text))
  }

  // source: https://github.com/facebookincubator/create-react-app/b/m/s/start.js#L69-L73
  function clearConsole () {
    // This seems to work best on Windows and other systems.
    // The intention is to clear the output so you can focus on most recent build.
    process.stdout.write('\x1bc')
  }

  function sliceOfFile (file, pos) {
    var lineNumber = pos.line - 1
    var column = pos.column
    var contents = fs.readFileSync(file, 'utf8')
    var lines = contents.split('\n')

    var line, index, i
    // find last non-empty line
    for (i = 0; i < lines.length; i++) {
      index = lineNumber - i
      line = lines[index]
      if (line.trim()) {
        // non-empty line found
        lineNumber = index
        break
      }

      // console.log('line was empty')
      // column data is corrupted, is probably last charater of previous line
      column = -1
    }

    // grab last 5 lines
    var results = []
    for (i = 0; i < 5; i++) {
      index = lineNumber + i - 4
      if (index >= 0) {
        var l = lines[index]
        // parse distracting escapes
        l = l.split('\'').join('"')
        results.push(l)
      }
    }

    // lastly push in small arrow indicator
    var lastLine = results[results.length - 1]
    var indicator = []
    for (i = 0; i < lastLine.length; i++) indicator.push('_')
    if (column < 0) {
      indicator.push('^')
    } else {
      indicator[column] = '^'
    }
    results.push(indicator.join(''))
    results.push('')

    return results
  }

  var buildTimeout = null
  var _timeout = null
  function triggerRebuild () {
    clearTimeout(_timeout)
    _timeout = setTimeout(function () {
      console.log(chalk.gray('triggering...'))
    }, 20)
    clearTimeout(buildTimeout)
    buildTimeout = setTimeout(function () {
      build()
    }, 50)
  }
  var trigger = triggerRebuild

  function honeydripError (err) {
    // console.log('honeydripping')
    var honey = Object.assign({}, err)
    var type = err.stack.substring(0, err.stack.indexOf(':'))
    var info = err.stack.substring(0, err.stack.indexOf('/'))
    var file = honey.file
    info += '[' + file.substring(file.lastIndexOf('/') + 1) + ']'
    honey.type = type
    honey.info = info

    var e = {
      type: info.substring(0, info.indexOf(':')),
      msg: info.substring(info.indexOf(':') + 1, info.indexOf('[')),
      file: file,
      stub: file.substring(file.lastIndexOf('/') + 1),
      path: file.substring(0, file.lastIndexOf('/') + 1)
    }
    honey.info = e

    honey.slice = sliceOfFile(honey.file, honey.loc)
    return [honey.code, honey.loc, honey.info, honey.slice]
  }

  function build () {
    clearConsole()
    console.log(chalk.gray('bundling... [' + chalk.blue((new Date().toLocaleString())) + ']'))

    var opts = Object.assign({}, options)

    // use cache if available
    if (cache && opts) {
      opts.cache = cache
    }

    var buildStart = Date.now()

    rollup.rollup(opts).then(function (bundle) {
      cache = bundle

      // close globalWatcher if it was on
      if (globalWatcher) {
        globalWatcher.close()
        globalWatcher = null
      }

      for (var i = 0; i < bundle.modules.length; i++) {
        var module = bundle.modules[i]
        var id = module.id
        // log('[' + module.id + '] for loop, index: ' + i)

        // skip plugin helper modules
        if (/\0/.test(id)) {
          console.log(chalk.yellow('skipping helper module'))
          return
        }

        if (!watchers[id]) {
          // function trigger (evt, path) {
          //   console.log(evt, path)
          //   triggerRebuild()
          // }

          var watcher = chokidar.watch(id)
          watcher.on('change', trigger)
          watchers[id] = watcher
          // log('watcher added')
        }
      }

      return bundle.write(opts)
    }).then(function () {
      var delta = Date.now() - buildStart
      console.log('bundling took: ' + chalk.cyan(delta) + ' milliseconds')
      console.log(chalk.green('Success.'))
    }, function (err) {
      var honey = honeydripError(err)
      var error = []
      error.push('')
      error.push(chalk.gray('``` ') + chalk.red(honey[0]))
      honey[3].forEach(function (line) { error.push(line) })
      // console.log('```')
      // console.log(honey[2])
      var e = honey[2]
      error.push(chalk.magenta(e.type) + ':' + e.msg + '[' + chalk.magenta(e.stub) + ']')
      error.push(chalk.gray('url: ' + e.path) + chalk.magenta(e.stub))

      console.error(error.join('\n'))

      // temporary watcher to listen for all changes to rebuild to
      if (!globalWatcher) {
        log('trying to set up globalWatcher')
        // function trigger (evt, path) {
        //   // console.log(evt, path)
        //   triggerRebuild()
        // }
        globalWatcher = chokidar.watch('**/*.js')
        globalWatcher.on('add', trigger).on('change', trigger)
        log('global watcher setup')
      }
    })

    // console.log('after')
  }

  build()
}
