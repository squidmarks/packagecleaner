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
const stateUpdateInterval = 500
var lidOpenedTime = Date.now()
var ozoneTimeout, startHumidifierTimeout, stopHumidifierTimeout, stateInterval
const switchStates = {}
const telegram = new TelegramService(processCommand)

const ozoneGenerator = new gpio(6, 'out')
const humidifier = new gpio(13, 'out')
const redLight = new gpio(19, 'out')
const greenLight = new gpio(26, 'out')
const lidSwitch = new gpio(24, 'in', 'both', {debounceTimeout: 20})
const greenSwitch = new gpio(9, 'in', 'both', {debounceTimeout: 20})
const redSwitch = new gpio(10, 'in', 'both', {debounceTimeout: 20})

switchStates.red = redSwitch.readSync()
switchStates.green = greenSwitch.readSync()
switchStates.lidSwitch = lidSwitch.readSync()

const cleaningStates = {
  unknown: {
    redLight: 'on',
    greenLight: 'off',
    ozone: 'off',
    humidifier:'off'
  },
  cleaned: {
    redLight: 'off',
    greenLight: 'on',
    ozone: 'off',
    humidifier:'off'
  },
  ozoneTreatment: {
    redLight: 'off',
    greenLight: 'flash',
    ozone: 'on',
    humidifier:'off'
  },
  humidityPulse: {
    redLight: 'flash',
    greenLight: 'flash',
    ozone: 'on',
    humidifier:'on'
  },
  cyclePaused: {
    redLight: 'on',
    greenLight: 'on',
    ozone: 'off',
    humidifier:'off'
  },
}

var cleaningState = cleaningStates.unknown

DHTsensor.setMaxRetries(4)
DHTsensor.initialize(22, 4)

function appCleanup() {
  clearInterval(stateInterval)
  telegram.shutdown()
  redLight.unexport()
  ozoneGenerator.unexport()
  humidifier.unexport()
  lidSwitch.unexport() 
};

function setState(device, state) {
  if (state == 'flash') {
    device.write(device.readSync() ? ON:OFF)
  } else device.write(state === 'on' ? ON:OFF)
}

function initialize() {
  stateInterval = setInterval( () => {
    if (!lidSwitch.readSync()) {
      if (((Date.now() - lidOpenedTime) > 20000) && 
        ((cleaningState != cleaningStates.ozoneTreatment) &&  (cleaningState != cleaningStates.humidityPulse))) abortCleaningCycle()
      setState(ozoneGenerator, OFF)
      setState(humidifier, OFF)
    } else {
      setState(ozoneGenerator, cleaningState.ozone)
      setState(humidifier, cleaningState.humidifier)
      setState(redLight, cleaningState.redLight)
      setState(greenLight, cleaningState.greenLight)  
    }
  }, stateUpdateInterval)
}

lidSwitch.watch((err, value) => {
  if (err) {
    throw err;
  }
  if (!switchStates.lidSwitch && value) {
    console.log('Lid was closed', value)
    if (cleaningState == cleaningStates.unknown) startCleaningCycle()
    if (cleaningState == cleaningStates.cleaned) cleaningState == cleaningStates.unknown
  }

  if (switchStates.lidSwitch && !value) {
    console.log('Lid was opened', value)
    lidOpenedTime = Date.now()
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
    abortCleaningCycle()
  }

  switchStates.redSwitch = value
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
    startCleaningCycle()
  }

  switchStates.greenSwitch = value
})

function readSensor () {
  return DHTsensor.readSync(22, 4)
}

function startCleaningCycle(minutes) {
  if ((cleaningState == cleaningStates.ozoneTreatment) || (cleaningState == cleaningStates.humidityPulse)) {
    console.log('Start cleaning request while busy')
    telegram.broadcastMessage(`A cleaning cycle is already in progress`)
    return
  }
  console.log('Starting cleaning cycle')

  telegram.broadcastMessage(`Starting ${minutes || defaultCleaningTime}min cleaning cycle\r\nYour packages will be clean at ${moment().add(minutes || defaultCleaningTime, 'minute').utcOffset(process.env.UTCOFFSET).format('LT')}`)
  
  cleaningState = cleaningStates.ozoneTreatment
  
  ozoneTimeout = setTimeout(() => {
    cleaningState = cleaningStates.cleaned

    const reading = readSensor()
    console.log(`Cleaning cycle completed, final humidity: ${reading.humidity.toFixed(1)}%`)
    telegram.broadcastMessage(`${minutes || defaultCleaningTime}min cleaning cycle completed!`)
  }, (minutes || defaultCleaningTime) * 60 * 1000)

  startHumidifierTimeout = setTimeout(() => {

    cleaningState = cleaningStates.humidityPulse
    console.log('Humidity burst started')

  }, (((minutes || defaultCleaningTime) - humdityBurstTime) * 60 * 1000))

}

function abortCleaningCycle() {
  if ((cleaningState != cleaningStates.ozoneTreatment) && (cleaningState != cleaningStates.humidityPulse)) {
    console.log('Abort cleaning request received with no cycle running')
    telegram.broadcastMessage(`A cleaning cycle has not started`)
    return
  }

  cleaningState = cleaningStates.unknown
  
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

initialize()
