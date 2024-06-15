const amqp = require("amqplib");

let channel, connection;

async function connectRabbitMQ() {
  try {
    connection = await amqp.connect(
      process.env.RABBITMQ_URI || "amqp://localhost"
    );
    channel = await connection.createChannel();
    await channel.assertQueue("rewards_requests");
    await channel.assertQueue("rewards_responses");

    console.log("Connected to RabbitMQ and listening for events.");
  } catch (error) {
    console.error("Failed to connect to RabbitMQ", error);
  }
}

async function publishEvent(queue, event) {
  if (!channel) {
    await connectRabbitMQ();
  }
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(event)));
}

function generateUuid() {
  return (
    Math.random().toString() +
    Math.random().toString() +
    Math.random().toString()
  );
}

module.exports = {
  connectRabbitMQ,
  publishEvent,
  generateUuid
};
