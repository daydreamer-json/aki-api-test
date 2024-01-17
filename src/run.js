const log4js = require('log4js');
const configData = require('./config/default.json');
const mathModule = require('./component/math');
const fileManage = require('./component/fileManage');
const moment = require('moment');
const color = require('ansi-colors');
const clui = require('clui');
const cliProgress = require('cli-progress');
const termKit = require('terminal-kit').terminal;
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const cbor = require('cbor-x');
const axios = require('axios');

const { Aki } = require('aki-api');


const progressBar = new cliProgress.SingleBar({
  format: '' + color.green('{bar}') + ' {percentage}% | {value} / {total} | {duration_formatted} | eta {eta_formatted} | {filename}',
  barsize: 65,
  fps: 10,
  barCompleteChar: '\u2588',
  barIncompleteChar: ' ',
  hideCursor: false,
  clearOnComplete: true
});

const uiBackButtonText = 'Back';
const uiExitButtonText = 'Exit';

module.exports.run = async function run (logger, argv) {
  logger.level = argv.logLevel;
  console.log(`Logger started (level: ${logger.level})`);
  if (logger.level != 'TRACE') console.log(`Logs with levels less than '${logger.level}' are truncated`);
  const aki = new Aki({
    'region': argv.region,
    'childMode': false,
    'proxyOptions': undefined
  });
  logger.debug(`Initializing Akinator API ...`);
  let spinner = new clui.Spinner (`Initializing Akinator API ...`, configData.base.spinnerSeq);
  spinner.start();
  await aki.start();
  spinner.stop();
  logger.info(`Started instance`);
  const akiResponseLogObj = {
    'result': null,
    'progress': new Array()
  };
  while (true) {
    if (aki.currentStep > argv.stepLimit || aki.progress > argv.progressLimit) break;
    // console.log(aki);
    console.log(`Step: ${aki.currentStep} (Limit: ${argv.stepLimit}), Progress: ${aki.progress} % (Limit: ${argv.progressLimit} %)`);
    let uiSelectorList;
    if (aki.currentStep === 0) {
      let temporalVar001 = JSON.parse(JSON.stringify(aki)).answers;
      temporalVar001.push(uiExitButtonText);
      uiSelectorList = temporalVar001;
    } else {
      let temporalVar001 = JSON.parse(JSON.stringify(aki)).answers;
      temporalVar001.push(uiBackButtonText);
      temporalVar001.push(uiExitButtonText);
      uiSelectorList = temporalVar001;
    }
    process.stdout.write(`Question: ${color.yellow(aki.question)}`);
    let userSelectAnswer = await showSelectUIMenuAwait(uiSelectorList, aki, argv);
    let tempVar002 = JSON.parse(JSON.stringify(aki));
    tempVar002.userSelectAnswer = userSelectAnswer;
    akiResponseLogObj.progress.push(tempVar002);
    if (userSelectAnswer === 'back') {
      logger.info(`Sending 'Back' request ...`);
      // logger.debug(`Back to: aki.currentStep = ${aki.currentStep - 1}`);
      let spinner = new clui.Spinner (`Sending 'Back' request ...`, configData.base.spinnerSeq);
      spinner.start();
      await aki.back();
      spinner.stop();
      logger.debug(`Response data received`);
    } else if (userSelectAnswer === 'exit') {
      break;
    } else if (userSelectAnswer <= 10) {
      logger.info(`Sending request ...`);
      logger.debug(`Selected answer: ${userSelectAnswer}, ${aki.answers[userSelectAnswer]}`);
      let spinner = new clui.Spinner (`Sending request ...`, configData.base.spinnerSeq);
      spinner.start();
      await aki.step(userSelectAnswer);
      spinner.stop();
      logger.debug(`Response data received`);
    }
  }
  logger.info(`Finalizing ...`);
  spinner = new clui.Spinner (`Finalizing ...`, configData.base.spinnerSeq);
  spinner.start();
  await aki.win();
  spinner.stop();
  logger.info(`Inference has been ended`);
  akiResponseLogObj.result = JSON.parse(JSON.stringify(aki));
  // console.log(`Akinator instance output:`);
  // console.log(aki);
  console.log(`Inference result:`);
  console.log(`Step: ${aki.currentStep} (Limit: ${argv.stepLimit})`);
  console.log(`Progress: ${aki.progress} % (Limit: ${argv.progressLimit} %)`);
  console.log(`Answer Count: ${aki.guessCount}`);
  console.log(`Answers:`);
  JSON.parse(JSON.stringify(aki)).answers.map((obj) => {
    console.log(`  ${color.green(obj.name)} - ${color.cyan(obj.description)}`);
    console.log(`    Probability: ${obj.proba * 100} %, Rank: ${obj.ranking}, NSFW: ${obj.nsfw}`);
  });
  await akiResponseLogWriter(akiResponseLogObj, logger, argv);
  exitProcess(logger);
}

function showSelectUIMenuAwait (uiSelectorList, aki, argv) {
  // terminal-kitがCallbackによる非同期処理しかなかったんで
  // 本来の表記方法であるPromiseによる処理で包んであげる
  return new Promise((resolve) => {
    // singleLineMenu or singleColumnMenu
    switch (argv.menuUiStyle) {
      case 'singleLine':
        termKit.singleLineMenu(uiSelectorList, {'selectedStyle': termKit.black.bgWhite}, (error, response) => {
          console.log('');
          if (error) throw error;
          // もしcurrentStepが1以上で
          // userSelectAnswerが一番最後であればBackと判定してfalseを返す
          // でなければそのままIndex(number)を渡す
          if (aki.currentStep !== 0 && response.selectedIndex === uiSelectorList.length - 2) {
            resolve('back');
          } else if (response.selectedIndex === uiSelectorList.length - 1) {
            resolve('exit');
          } else {
            resolve(response.selectedIndex);
          }
        });
        break;
      case 'singleColumn':
        termKit.singleColumnMenu(uiSelectorList, (error, response) => {
          if (error) throw error;
          // もしcurrentStepが1以上で
          // userSelectAnswerが一番最後であればBackと判定してfalseを返す
          // でなければそのままIndex(number)を渡す
          if (aki.currentStep !== 0 && response.selectedIndex === uiSelectorList.length - 2) {
            resolve('back');
          } else if (response.selectedIndex === uiSelectorList.length - 1) {
            resolve('exit');
          } else {
            resolve(response.selectedIndex);
          }
        });
        break;
    }
  });
}

function exitProcess (logger) {
  logger.info(`Process terminated`);
  process.exit();
}

async function akiResponseLogWriter (akiResponseLogObj, logger, argv) {
  if (argv.logWrite === true) {
    logger.info(`Writing response log file ...`);
    logger.trace(`Creating folder structure ...`);
    await fileManage.createFolder(argv.logOutputDir);
    const nowDTVal = moment();
    const fname = `res_${nowDTVal.format('YYYYMMDDTHHmmssZZ')}_${nowDTVal.valueOf()}`;
    logger.trace(`Writing to ${path.relative(path.resolve(process.cwd()), path.join(argv.logOutputDir, `${fname}.json`))} ...`);
    await fs.promises.writeFile(path.join(argv.logOutputDir, `${fname}.json`), JSON.stringify(akiResponseLogObj, '', '  '), {flag: 'w', encoding: 'utf8'});
    logger.trace(`Writing to ${path.relative(path.resolve(process.cwd()), path.join(argv.logOutputDir, `${fname}.min.json`))} ...`);
    await fs.promises.writeFile(path.join(argv.logOutputDir, `${fname}.min.json`), JSON.stringify(akiResponseLogObj), {flag: 'w', encoding: 'utf8'});
    logger.trace(`Writing to ${path.relative(path.resolve(process.cwd()), path.join(argv.logOutputDir, `${fname}.yaml`))} ...`);
    await fs.promises.writeFile(path.join(argv.logOutputDir, `${fname}.yaml`), YAML.stringify(JSON.parse(JSON.stringify(akiResponseLogObj))), {flag: 'w', encoding: 'utf8'});
    logger.trace(`Writing to ${path.relative(path.resolve(process.cwd()), path.join(argv.logOutputDir, `${fname}.cbor`))} ...`);
    await fs.promises.writeFile(path.join(argv.logOutputDir, `${fname}.cbor`), cbor.encode(akiResponseLogObj), {flag: 'w'});
    logger.debug(`Wrote all response log file`);
  } else {
    logger.debug(`Log writing was skipped`);
  }
}