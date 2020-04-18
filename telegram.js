const Slimbot = require('slimbot')
const jsonfile = require('jsonfile')
const file = '/tmp/data.json'

class TelegramService {
  constructor (callback) {
    if (process.env.TELEGRAM_KEY) {
      try {
        this.slimbot = new Slimbot(process.env.TELEGRAM_KEY)
        console.log(`Telegram bot has been initialized`)
      } catch (error) {
        throw new Error(`Invalid Telegram credentials provided: ${error}`)
      }
    } else {
      throw new Error('A Telegram bot API key must be provided for the Telegram service')
    }

    try {
      this.subcribers = jsonfile.readFileSync('./subscribers.json')
      console.log(`${Object.keys(this.subscribers).length} subscribers loaded`)        
    } catch (error) {
      console.log(`No subscribers loaded`)  
      this.subscribers = {}           
    }

    if (this.slimbot) {
      this.slimbot.on('message', message => {
        let botCmd
        message.entities.forEach(entity => {
          if (entity.type === 'bot_command') botCmd = message.text.substr(entity.offset, entity.length)
        })

        const parameters = message.text.split(' ')
        parameters.shift()

        if (botCmd === '/end') {
          if (!this.subscribers[message.from.id]) {
            delete this.subscribers[message.from.id]
            saveSubscribers()              
          }
          this.slimbot.sendMessage(message.from.id, 'You have unsubscribed from the Package Cleaning bot')
        }

        if (botCmd === '/start') {
          if (!this.subscribers[message.from.id]) {
            this.subscribers[message.from.id] = message.from
            saveSubscribers()              
          }

          this.slimbot.sendMessage(message.from.id, 
            `Hi ${message.from.first_name}!  Welcome to the Package Cleaner bot!\r\nYou can start cleaning by entering /clean\r\nThis will clean a package for the default time of 15min\r\nIf you want to specify the cleaning time, use:\r\n\r\n/clean 20 (to clean for 20 minutes)`)
        } else callback(botCmd, parameters, message.from.id)
      })

      this.slimbot.startPolling((err, obj) => {
        console.log(`Telegram client now polling for messages`)
        if (err) {
          this.slimbot.stopPolling()
          console.log(`Error starting Telegram, stopping service: ${err.message}`)
        }
      })
    }
  }

  shutdown () {
    this.slimbot.stopPolling()
    console.log('Telegram bot terminated')
  }

  broadcastMessage (message) {
    Object.keys(this.subscribers).forEach( sub => {
      this.slimbot.sendMessage(this.subscribers[sub].id, message)
    })
  }
  
  saveSubscribers() {
    jsonfile.writeFile('./subscribers.json', this.subscribers, function (err) {
      if (err) console.error(err)
      console.log(`${Object.keys(this.subscribers).length} subscribers saved`)
    })  
  }

}

module.exports = TelegramService
