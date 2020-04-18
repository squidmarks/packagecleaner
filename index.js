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
const lidSwitch = new gpio(17, 'in', 'both', {debounceTimeout: 10})

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

lidSwitch.watch((err, value) => {
  if (err) {
    throw err;
  }
  console.log('Lid changed state', value)
})

function startCleaningCycle(minutes) {
  if (busyCleaning) {
    console.log('Start cleaning request while busy')
    telegram.broadcastMessage(`A cleaning cycle is already in progress`)
    return
  }
  console.log('Starting cleaning cycle')
  busyCleaning = true
  telegram.broadcastMessage(`Starting ${minutes || defaultCleaningTime} cleaning cycle...`)
  ozoneGenerator.writeSync(ON)
  redLight.writeSync(ON)
  greenLight.writeSync(OFF)
  cleaningTimeout = setTimeout(() => {
    busyCleaning = false
    ozoneGenerator.writeSync(OFF)
    redLight.writeSync(OFF)
    greenLight.writeSync(ON)  
    console.log('Cleaning cycle completed')
    telegram.broadcastMessage(`${minutes || defaultCleaningTime} cleaning cycle completed!`)
  }, (minutes || defaultCleaningTime) * 1000)
}

function abortCleaningCycle() {
  if (!busyCleaning) {
    console.log('Abort cleaning request received with no cycle running')
    telegram.broadcastMessage(`A cleaning cycle has not started`)
    return
  }
  ozoneGenerator.writeSync(OFF)
  redLight.writeSync(OFF)
  greenLight.writeSync(OFF)  
  busyCleaning = false
  clearTimeout(cleaningTimeout)
  console.log('Cleaning cycle aborted')
  telegram.broadcastMessage(`Cleaning cycle aborted`)
}

function processCommand (command, parameters) {
  if (command.toLowerCase() === '/clean') startCleaningCycle(parameters[0])
  if (['/stop', '/abort'].includes(command.toLowerCase())) abortCleaningCycle()
}
