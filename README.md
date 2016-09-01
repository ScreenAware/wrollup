# wrollup - Simple watcher for rollup

## Simple to use
```bash
npm install -g wrollup
wrollup path/to/rollup.config.js # looks for ./rollup.config.js by default
```

# About
A simple watcher for building rollup bundles inspired by the https://github.com/stylus/stylus watcher

# Why
The plugin 'rollup-watch' is pretty OK, but has a few issues like not being able to recover, hanging forever when not connected to the internet -- all in all a bit of a pain to deal with. wrollup is intended to make the watching and bundle process as smooth as possible.

# How
Using a similar init process we use rollup internally to parse the rollup.config.js file and star the watcher with a set of streamlined logging procedure (similar to stylus-lang) and pretty error parsing.

# Installation
```bash
npm install -g wrollup # globally
```
or
```bash
npm install wrollup # locally (for use within your npm scripts)
```

# Requirements
A rollup config file (looks for rollup.config.js by default). A basic one can be for example:
```js
import buble from 'rollup-plugin-buble'
import nodeResolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'

export default {
  entry: 'src/index.js',
  dest: 'dist/bundle.js',
  format: 'iife',
  plugins: [
    buble(),
    nodeResolve(),
    commonjs({
      include: 'node_modules/**'
    })
  ]
}
```