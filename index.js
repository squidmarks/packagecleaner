require('dotenv').config()
require('./cleanup').Cleanup(appCleanup)
const gpio = require('onoff').Gpio
const TelegramService = require('./telegram')

const defaultCleaningTime = 20
const OFF = 1
const ON = 0

const telegram = new TelegramService(processCommand)

const ozoneGenerator = new gpio(6, 'out')
const redLight = new gpio(13, 'out')
const greenLight = new gpio(19, 'out')
const switch_4 = new gpio(26, 'out')
const lidSwitch = new Gpio(4, 'in', 'rising', {debounceTimeout: 10})

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
  console.log('Starting cleaning cycle')
  telegram.sendMessage(`Starting ${minutes || defaultCleaningTime} cleaning cycle...`, fromId)
  ozoneGenerator.writeSync(ON)
  redLight.writeSync(ON)
  greenLight.writeSync(OFF)
  setTimeout(() => {
    ozoneGenerator.writeSync(OFF)
    redLight.writeSync(OFF)
    greenLight.writeSync(ON)  
    console.log('Cleaning cycle completed')
    telegram.sendMessage(`${minutes || defaultCleaningTime} cleaning cycle completed!`, fromId)
  }, (minutes || defaultCleaningTime) * 1000)
}

function abortCleaningCycle(fromId) {
  ozoneGenerator.writeSync(OFF)
  redLight.writeSync(OFF)
  greenLight.writeSync(OFF)  
  console.log('Cleaning cycle aborted')
  telegram.sendMessage(`Cleaning cycle aborted`, fromId)
}

function processCommand (command, parameters, fromId) {
  if (command.toLowerCase() === '/clean') startCleaningCycle(parameters[0], fromId)
  if (command.toLowerCase() === '/stop') abortCleaningCycle(fromId)
}
