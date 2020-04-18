const Slimbot = require('slimbot')

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

    if (this.slimbot) {
      this.slimbot.on('message', message => {
        let botCmd
        message.entities.forEach(entity => {
          if (entity.type === 'bot_command') botCmd = message.text.substr(entity.offset, entity.length)
        })

        const parameters = message.text.split(' ')
        parameters.shift()
        if (botCmd === '/start') {
          this.slimbot.sendMessage(message.from.id, 
            `Hi ${message.from.first_name}!  Welcome to the Package Cleaner bot!\r\nYou can start cleaning by entering /clean\r\nThis will clean a package for the default time of 15min\r\nIf you want to specify the cleaning time, use:\r\n\r\n/clean 20 (to clean for 20 minutes)`)
        } else callback(botCmd, parameters)
      })

      this.slimbot.startPolling((err, obj) => {
        this.logger.info(`${connection.name} telegram client now polling for messages`)
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

  sendMessage (message) {
    this.slimbot.sendMessage(message.from.id, message)
  }
}

module.exports = TelegramService
