#!/usr/bin/env node

const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const log4js = require('log4js');
const figlet = require("figlet");
const fs = require('fs');
const path = require('path');
const configData = require('./config/default.json');
const extComponents = {};
extComponents.run = require('./run');

log4js.configure({
  appenders: {
    System: {
      type: 'stdout'
      }
  },
  categories: {
    default: {
      appenders: ['System'],
      level: 'trace'
    }
  }
})
const logger = log4js.getLogger('System');

const argv = yargs(hideBin(process.argv))
  .command({
    command: 'inference',
    aliases: ['run'],
    desc: 'Inference Akinator',
    builder: (yargs) => {
      yargs
      .options({
        'step-limit': {
          alias: ['s'],
          desc: 'Inference step limit',
          default: configData.aki.inferenceStepLimitDefault,
          type: 'number'
        },
        'progress-limit': {
          alias: ['l'],
          desc: 'Inference progress limit',
          default: configData.aki.inferenceProgressLimitDefault,
          type: 'number'
        },
        'region': {
          desc: 'API response language/region',
          default: 'jp',
          deprecated: false,
          choices: ['en','en_objects','en_animals','ar','cn','de','de_animals','es','es_animals','fr','fr_objects','fr_animals','id','il','it','it_animals','jp','jp_animals','kr','nl','pl','pt','ru','tr'],
          type: 'string'
        },
        'menu-ui-style': {
          desc: 'Selector menu UI style',
          default: 'singleLine',
          deprecated: false,
          choices: ['singleLine', 'singleColumn'],
          type: 'string'
        },
        'log-write': {
          desc: 'Write all API response data to file',
          default: true,
          deprecated: false,
          type: 'boolean'
        },
        'log-output-dir': {
          desc: 'log-write root directory',
          default: path.resolve(path.join('.', 'output')),
          deprecated: false,
          normalize: true,
          type: 'string'
        },
        'log-level': {
          desc: 'Set log level',
          default: 'trace',
          deprecated: false,
          choices: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
          type: 'string'
        },
      })
    },
    handler: (argv) => {
      extComponents.run.run(logger, argv);
    }
  })
  .command({
    command: 'todo',
    desc: 'To-do memo',
    builder: (yargs) => {
      yargs
      .options({
      })
    },
    handler: (argv) => {
      console.log(`To-Do:`);
      console.log([
        'Output API response to file (JSON/YAML/CBOR)'
      ]);
    }
  })
  .usage('$0 <command> [argument] [option]')
  .epilogue(configData.base.applicationCopyrightShort)
  .demandCommand(1)
  .help()
  .version(configData.base.applicationVersionNumber)
  .strict()
  .recommendCommands()
  .parse()
  .argv;
