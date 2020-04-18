class TelegramService {
  constructor () {
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

        if (botCmd === '/start') {
          this.slimbot.sendMessage(message.from.id, 'Starting cleansing...')
        }
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
}

module.exports = TelegramService
