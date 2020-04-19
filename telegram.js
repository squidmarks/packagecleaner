const Slimbot = require('slimbot')
const jsonfile = require('jsonfile')
const fs = require('fs')

function saveSubscribers(subscribers) {
  jsonfile.writeFile('./subscribers.json', subscribers, function (err) {
    if (err) console.error(err)
    console.log(`${Object.keys(subscribers).length} subscribers saved`)
  })  
}

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

    let subscribers = {}
    try {
      subscribers = jsonfile.readFileSync('./subscribers.json')
      console.log(`${Object.keys(subscribers).length} subscribers loaded`)        
    } catch (error) {
      console.log(`No subscribers loaded`)  
      subscribers = {}           
    }

    this.subscribers = subscribers
    
    let helpMd
    try {
      fs.readFile('./telegram.md', 'utf8', function(err, contents) {
        helpMd = contents
    })      
    } catch (error) {
      helpMd = 'Welcome to the Package Cleaner bot'  
    }
    this.telegramHelp = helpMd

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
            saveSubscribers(this.subcribers)              
          }
          this.slimbot.sendMessage(message.from.id, 'You have unsubscribed from the Package Cleaning bot')
        }

        if (botCmd === '/start') this.slimbot.sendMessage(message.from.id, this.telegramHelp)

        if (botCmd === '/start') {
          if (!this.subscribers[message.from.id]) {
            this.subscribers[message.from.id] = message.from
            saveSubscribers(this.subcribers)              
          }

          this.slimbot.sendMessage(message.from.id, `Hi ${message.from.first_name}!${this.telegramHelp}`)
        } else callback(botCmd, parameters, message.from.id)
      })

      this.broadcastMessage('Package cleaner is online!')
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
  
}

module.exports = TelegramService
