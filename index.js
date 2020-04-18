var gpio = require('onoff').Gpio

const switch_1 = new Gpio(6, 'out')
const switch_2 = new Gpio(13, 'out')
const switch_3 = new Gpio(19, 'out')
const switch_4 = new Gpio(26, 'out')

setInterval(() => {
  const state = switch_1.readSync() === 0 ? 1:0
  switch_1(state)
  switch_2(state)
  switch_3(state)
  switch_4(state)
},1000)

