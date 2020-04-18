require('dotenv').config()
require('./cleanup').Cleanup(appCleanup)
const gpio = require('onoff').Gpio
const TelegramService = require('./telegram')

const defaultCleaningTime = 20
const OFF = 1
const ON = 0
var busyCleaning = false
var cleaningTimeout

const telegram = new TelegramService(processCommand)

const ozoneGenerator = new gpio(6, 'out')
const redLight = new gpio(13, 'out')
const greenLight = new gpio(19, 'out')
const switch_4 = new gpio(26, 'out')
const lidSwitch = new gpio(4, 'in', 'rising', {debounceTimeout: 10})

function appCleanup() {
  telegram.shutdown()
  redLight.unexport()
  ozoneGenerator.unexport()
  switch_4.unexport()
  lidSwitch.unexport()  
};

ozoneGenerator.writeSync(OFF)
redLight.writeSync(OFF)
greenLight.writeSync(OFF)
switch_4.writeSync(OFF)

function startCleaningCycle(minutes, fromId) {
  if (busyCleaning) {
    telegram.sendMessage(`A cleaning cycle is already in progress`, fromId)
    return
  }
  console.log('Starting cleaning cycle')
  busyCleaning = true
  telegram.sendMessage(`Starting ${minutes || defaultCleaningTime} cleaning cycle...`, fromId)
  ozoneGenerator.writeSync(ON)
  redLight.writeSync(ON)
  greenLight.writeSync(OFF)
  cleaningTimeout = setTimeout(() => {
    busyCleaning = true
    ozoneGenerator.writeSync(OFF)
    redLight.writeSync(OFF)
    greenLight.writeSync(ON)  
    console.log('Cleaning cycle completed')
    telegram.sendMessage(`${minutes || defaultCleaningTime} cleaning cycle completed!`, fromId)
  }, (minutes || defaultCleaningTime) * 1000)
}

function abortCleaningCycle(fromId) {
  if (!busyCleaning) {
    telegram.sendMessage(`A cleaning cycle has not started`, fromId)
    return
  }
  ozoneGenerator.writeSync(OFF)
  redLight.writeSync(OFF)
  greenLight.writeSync(OFF)  
  busyCleaning = false
  clearTimeout(cleaningTimeout)
  console.log('Cleaning cycle aborted')
  telegram.sendMessage(`Cleaning cycle aborted`, fromId)
}

function processCommand (command, parameters, fromId) {
  if (command.toLowerCase() === '/clean') startCleaningCycle(parameters[0], fromId)
  if (['/stop', '/abort'].includes(command.toLowerCase())) abortCleaningCycle(fromId)
}
