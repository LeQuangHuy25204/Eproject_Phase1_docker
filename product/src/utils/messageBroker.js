const amqp = require("amqplib");
require("dotenv").config();

class MessageBroker {
  constructor() {
    this.channel = null;
  }

  async connect() {
    console.log("Connecting to RabbitMQ...");

    setTimeout(async () => {
      try {
        console.log("Attempting to connect to RabbitMQ...");
        
        // Validate required environment variables
        if (!process.env.RABBITMQ_USER || !process.env.RABBITMQ_PASS) {
          throw new Error('RabbitMQ credentials not found in environment variables');
        }

        const connectionOptions = {
          protocol: 'amqp',
          hostname: process.env.RABBITMQ_HOST || 'rabbitmq',
          port: parseInt(process.env.RABBITMQ_PORT) || 5672,
          username: process.env.RABBITMQ_USER,
          password: process.env.RABBITMQ_PASS,
          locale: 'en_US',
          frameMax: 0,
          heartbeat: 60,
          vhost: process.env.RABBITMQ_VHOST || '/',
        };
        
        const connection = await amqp.connect(connectionOptions);
        this.channel = await connection.createChannel();
        await this.channel.assertQueue("products");
        await this.channel.assertQueue("orders");
        console.log("RabbitMQ connected");
      } catch (err) {
        console.error("Failed to connect to RabbitMQ:", err.message);
      }
    }, 20000); // delay 10 seconds to wait for RabbitMQ to start
  }

  async publishMessage(queue, message) {
    if (!this.channel) {
      console.error("No RabbitMQ channel available.");
      return;
    }

    try {
      await this.channel.sendToQueue(
        queue,
        Buffer.from(JSON.stringify(message))
      );
    } catch (err) {
      console.log(err);
    }
  }

  async consumeMessage(queue, callback) {
    if (!this.channel) {
      console.error("No RabbitMQ channel available.");
      return;
    }

    try {
      await this.channel.consume(queue, (message) => {
        const content = message.content.toString();
        const parsedContent = JSON.parse(content);
        callback(parsedContent);
        this.channel.ack(message);
      });
    } catch (err) {
      console.log(err);
    }
  }
}

module.exports = new MessageBroker();
