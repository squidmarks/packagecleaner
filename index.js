require('dotenv').config()
require('./cleanup').Cleanup(appCleanup)
const gpio = require('onoff').Gpio
const TelegramService = require('./telegram')

const defaultCleaningTime = 20  //Default ozone treatment time (in minutes)
const minCleaningTime = 5       //Mininum allowable cleaning time
const maxCleaningTime = 60      //Maximum allowable cleaning time
const humdityBurstTime = 1      //Time of humdidity burst after ozone treatment  (in minutes)
const OFF = 1
const ON = 0
var busyCleaning = false
var ozoneTimeout, startHumidifierTimeout, stopHumidifierTimeout

const telegram = new TelegramService(processCommand)

const ozoneGenerator = new gpio(6, 'out')
const humidifier = new gpio(13, 'out')
const redLight = new gpio(19, 'out')
const greenLight = new gpio(26, 'out')
const lidSwitch = new gpio(23, 'in', 'both', {debounceTimeout: 10})

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

  telegram.broadcastMessage(`Starting ${minutes || defaultCleaningTime}min cleaning cycle...`)
  
  ozoneGenerator.write(ON)
  redLight.write(ON)
  greenLight.write(OFF)
  
  ozoneTimeout = setTimeout(() => {
    busyCleaning = false
    ozoneGenerator.write(OFF)
    redLight.write(OFF)
    humidifier.write(OFF)
    greenLight.write(ON)  
    console.log('Cleaning cycle completed')
    telegram.broadcastMessage(`${minutes || defaultCleaningTime} cleaning cycle completed!`)
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

    if (command.toLowerCase() === '/test') {
      switch (parameters[0]) {
        case 1, 'ozone':
          deviceToTest = ozoneGenerator 
          break;
          case 1, 'humidifier':
            deviceToTest = humidifier 
            break;
          case 1, 'red':
            deviceToTest = redLight 
            break;
          case 1, 'green':
            deviceToTest = greenLight 
            break;
                  
        default:
          broadcastMessage('Invalid test parameter')
          return
          break;
      }

      broadcastMessage(`Testing ${parameters[0]}`)
      deviceToTest.write(ON)
      setTimeout(() => {
        deviceToTest.write(OFF)
      }, 1000) 
    }

  if (['/stop', '/abort'].includes(command.toLowerCase())) abortCleaningCycle()
}
