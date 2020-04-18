const Slimbot = require('slimbot')
const dotenv = require('dotenv')
const gpio = require('onoff').Gpio
const cleanup = require('./cleanup').Cleanup(myCleanup)

function myCleanup() {
  console.log('App specific cleanup code...');
};

const botName = 'packagecleanerbot'

slimbot = new Slimbot(process.env.TELEGRAM_KEY)

slimbot.on('message', () => {

})

const switch_1 = new gpio(6, 'out')
const switch_2 = new gpio(13, 'out')
const switch_3 = new gpio(19, 'out')
const switch_4 = new gpio(26, 'out')

setInterval(() => {
  const state = switch_1.readSync() === 0 ? 1:0
  switch_1.writeSync(state)
  switch_2.writeSync(state)
  switch_3.writeSync(state)
  switch_4.writeSync(state)
},200)

