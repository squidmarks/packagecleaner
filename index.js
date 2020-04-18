require('dotenv').config()
require('./cleanup').Cleanup(appCleanup)
const gpio = require('onoff').Gpio
const TelegramService = require('./telegram')

const defaultCleaningTime = 20

const telegram = new TelegramService(processCommand)

function appCleanup() {
  telegram.shutdown()
};

const ozoneGenerator = new gpio(6, 'out')
const redLight = new gpio(13, 'out')
const greenLight = new gpio(19, 'out')
const switch_4 = new gpio(26, 'out')

ozoneGenerator.writeSync(0)
redLight.writeSync(0)
greenLight.writeSync(0)

function startCleaningCycle(minutes) {
  telegram.sendMessage(`Starting ${minutes || defaultCleaningTime} cleaning cycle...`)
  ozoneGenerator.writeSync(1)
  redLight.writeSync(1)
  greenLight.writeSync(0)
  setTimeout(() => {
    ozoneGenerator.writeSync(0)
    redLight.writeSync(0)
    greenLight.writeSync(1)  
    telegram.sendMessage(`${minutes || defaultCleaningTime} cleaning cycle completed!`)
  }, (minutes || defaultCleaningTime) * 60 * 1000)
}

function abortCleaningCycle() {
  ozoneGenerator.writeSync(0)
  redLight.writeSync(0)
  greenLight.writeSync(0)  
  telegram.sendMessage(`Cleaning cycle aborted`)
}

function processCommand (command, parameters) {
  if (command.toLowerCase() === 'clean') startCleaningCycle(parameters[0])
  if (command.toLowerCase() === 'stop') abortCleaningCycle()
}
