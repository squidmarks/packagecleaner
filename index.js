require('dotenv').config()
require('./cleanup').Cleanup(appCleanup)
const gpio = require('onoff').Gpio
const TelegramService = require('./telegram')
const DHTsensor = require("node-dht-sensor").promises
const moment = require('moment')

const defaultCleaningTime = 20  //Default ozone treatment time (in minutes)
const minCleaningTime = 5       //Mininum allowable cleaning time
const maxCleaningTime = 60      //Maximum allowable cleaning time
const humdityBurstTime = 5      //Time of humdidity burst after ozone treatment  (in minutes)
const OFF = 1
const ON = 0
var busyCleaning = false
var ozoneTimeout, startHumidifierTimeout, stopHumidifierTimeout
const switchStates = {}
const telegram = new TelegramService(processCommand)

const ozoneGenerator = new gpio(6, 'out')
const humidifier = new gpio(13, 'out')
const redLight = new gpio(19, 'out')
const greenLight = new gpio(26, 'out')
const lidSwitch = new gpio(24, 'in', 'both', {debounceTimeout: 50})
const greenSwitch = new gpio(9, 'in', 'both', {debounceTimeout: 50})
const redSwitch = new gpio(11, 'in', 'both', {debounceTimeout: 50})

switchStates.red = redSwitch.readSync()
switchStates.green = greenSwitch.readSync()
switchStates.lidSwitch = lidSwitch.readSync()
console.log(switchStates)

DHTsensor.setMaxRetries(4)
DHTsensor.initialize(22, 4)

function appCleanup() {
  telegram.shutdown()
  redLight.unexport()
  ozoneGenerator.unexport()
  humidifier.unexport()
  lidSwitch.unexport()  
};

ozoneGenerator.write(OFF)
redLight.write(OFF)
greenLight.write(OFF)
humidifier.write(OFF)

lidSwitch.watch((err, value) => {
  if (err) {
    throw err;
  }
  if (!switchStates.lidSwitch && value) {
    console.log('Lid was closed', value)
  }

  if (switchStates.lidSwitch && !value) {
    console.log('Lid was opened', value)
  }

  switchStates.lidSwitch = value
})

redSwitch.watch((err, value) => {
  if (err) {
    throw err;
  }

  if (!switchStates.redSwitch && value) {
    console.log('Red switch was pressed', value)
  }

  if (switchStates.redSwitch && !value) {
    console.log('Red switch was released', value)
  }

  switchStates.red = value
})

greenSwitch.watch((err, value) => {
  if (err) {
    throw err;
  }
  if (!switchStates.greenSwitch && value) {
    console.log('Green switch was pressed', value)
  }

  if (switchStates.greenSwitch && !value) {
    console.log('Green switch was released', value)
  }

  switchStates.green = value
})

function readSensor () {
  return DHTsensor.readSync(22, 4)
}

function startCleaningCycle(minutes) {
  if (busyCleaning) {
    console.log('Start cleaning request while busy')
    telegram.broadcastMessage(`A cleaning cycle is already in progress`)
    return
  }
  console.log('Starting cleaning cycle')
  busyCleaning = true

  telegram.broadcastMessage(`Starting ${minutes || defaultCleaningTime}min cleaning cycle\r\nYour packages will be clean at ${moment().add(minutes || defaultCleaningTime, 'minute').utcOffset(process.env.UTCOFFSET).format('LT')}`)
  
  ozoneGenerator.write(ON)
  redLight.write(ON)
  greenLight.write(OFF)
  
  ozoneTimeout = setTimeout(() => {
    busyCleaning = false
    ozoneGenerator.write(OFF)
    redLight.write(OFF)
    humidifier.write(OFF)
    greenLight.write(ON)  

    const reading = readSensor()
    console.log(`Cleaning cycle completed, final humidity: ${reading.humidity.toFixed(1)}%`)
    telegram.broadcastMessage(`${minutes || defaultCleaningTime}min cleaning cycle completed!`)
  }, (minutes || defaultCleaningTime) * 60 * 1000)

  startHumidifierTimeout = setTimeout(() => {

    humidifier.write(ON)
    console.log('Humidity burst started')

  }, (((minutes || defaultCleaningTime) - humdityBurstTime) * 60 * 1000))

}

function abortCleaningCycle() {
  if (!busyCleaning) {
    console.log('Abort cleaning request received with no cycle running')
    telegram.broadcastMessage(`A cleaning cycle has not started`)
    return
  }

  ozoneGenerator.write(OFF)
  humidifier.write(OFF)
  redLight.write(OFF)
  greenLight.write(OFF)  
  
  busyCleaning = false
  
  clearTimeout(ozoneTimeout)
  clearTimeout(startHumidifierTimeout)
  clearTimeout(stopHumidifierTimeout)
  
  console.log('Cleaning cycle aborted')
  telegram.broadcastMessage(`Cleaning cycle aborted`)
}

function processCommand (command, parameters) {
  if (command.toLowerCase() === '/clean') {
    try {
      const cleaningPeriod = Number(parameters[0])
      if ((cleaningPeriod > maxCleaningTime) || (cleaningPeriod < minCleaningTime)) throw Error(`Cleaning time must be ${minCleaningTime}-${maxCleaningTime}min`)
      startCleaningCycle(cleaningPeriod)
        
    } catch (error) {
      console.log(error.message)
      telegram.broadcastMessage(`Cleaning cycle not started: ${error.message}`)
    }
  }
  if (['/stop', '/abort'].includes(command.toLowerCase())) abortCleaningCycle()

  if (command.toLowerCase() === '/time') {

  }

  if (command.toLowerCase() === '/sensor') {
    try {
      const reading = readSensor()
      telegram.broadcastMessage(`temp: ${reading.temperature.toFixed(1)}°C, humidity: ${reading.humidity.toFixed(1)}%`)
    } catch (error) {
      telegram.broadcastMessage(`Error reading sensor: ${error.message || error}`)      
    }
  }

  if (command.toLowerCase() === '/test') {
    switch (parameters[0]) {
      case 'ozone':
        deviceToTest = ozoneGenerator 
        break;
        case 'humidifier':
          deviceToTest = humidifier 
          break;
        case 'red':
          deviceToTest = redLight 
          break;
        case 'green':
          deviceToTest = greenLight 
          break;
                
      default:
        telegram.broadcastMessage('Invalid test parameter')
        return
    }

    telegram.broadcastMessage(`${parameters[0]} should be on`)
    deviceToTest.write(ON)
    setTimeout(() => {
      telegram.broadcastMessage(`${parameters[0]} should be off`)
      deviceToTest.write(OFF)
    }, Number(parameters[1]) || 2000) 
  }

}
