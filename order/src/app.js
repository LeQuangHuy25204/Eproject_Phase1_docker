const express = require("express");
const mongoose = require("mongoose");
const Order = require("./models/order");
const amqp = require("amqplib");
const config = require("./config");
require("dotenv").config();

class App {
  constructor() {
    this.app = express();
    this.connectDB();
    this.setupOrderConsumer();
  }

  async connectDB() {
    await mongoose.connect(config.mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected");
  }

  async disconnectDB() {
    await mongoose.disconnect();
    console.log("MongoDB disconnected");
  }

  async setupOrderConsumer() {
    console.log("Connecting to RabbitMQ...");
    
    const connectWithRetry = async (retryCount = 0) => {
      try {
        console.log(`Attempting to connect to RabbitMQ (Attempt ${retryCount + 1})`);
        
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
        console.log("Connected to RabbitMQ successfully!");
        
        const channel = await connection.createChannel();
        await channel.assertQueue("orders");
  
        channel.consume("orders", async (data) => {
          // Consume messages from the order queue on buy
          console.log("Consuming ORDER service");
          const { products, username, orderId } = JSON.parse(data.content);
  
          const newOrder = new Order({
            products,
            user: username,
            totalPrice: products.reduce((acc, product) => acc + product.price, 0),
          });
  
          // Save order to DB
          await newOrder.save();
  
          // Send ACK to ORDER service
          channel.ack(data);
          console.log("Order saved to DB and ACK sent to ORDER queue");
  
          // Send fulfilled order to PRODUCTS service
          // Include orderId in the message
          const { user, products: savedProducts, totalPrice } = newOrder.toJSON();
          channel.sendToQueue(
            "products",
            Buffer.from(JSON.stringify({ orderId, user, products: savedProducts, totalPrice }))
          );
        });
      } catch (err) {
        console.error(`Failed to connect to RabbitMQ (Attempt ${retryCount + 1}):`, err.message);
        
        // Retry logic
        if (retryCount < 5) {
          console.log(`Retrying in ${(retryCount + 1) * 2} seconds...`);
          setTimeout(() => connectWithRetry(retryCount + 1), (retryCount + 1) * 2000);
        } else {
          console.error("Max retry attempts reached. Please check RabbitMQ service.");
        }
      }
    };
    
    // Start connection with delay
    setTimeout(() => connectWithRetry(), 5000);
  }



  start() {
    this.server = this.app.listen(config.port, () =>
      console.log(`Server started on port ${config.port}`)
    );
  }

  async stop() {
    await mongoose.disconnect();
    this.server.close();
    console.log("Server stopped");
  }
}

module.exports = App;
