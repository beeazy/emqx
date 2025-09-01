const mqtt = require("mqtt");

const express = require("express");

const http = require("http");

const { Server } = require("socket.io");

const app = express();

const server = http.createServer(app);
const io = new Server(server);

// Hardcoded for easy set up

const host = "broker.emqx.io";
const port = "1883";
const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;

const connectUrl = `mqtt://${host}:${port}`;

const client = mqtt.connect(connectUrl, {
  clientId,
  clean: true,
  connectTimeout: 4000,
  username: "emqx",
  password: "public",
  reconnectPeriod: 1000,
});

// on connect, on message, on error,

const topics = [
  "hospital/bed01/weights",
  "hospital/bed02/weights",
  "hospital/bed03/weights",
  "hospital/bed14/weights",
  "hospital/+/weights",
];

client.on("connect", () => {
  console.log("Connected to MQTT broker");

  topics.forEach((topic) => {
    client.subscribe(topic, () => {
      console.log(`Subscribed to ${topic}`);
    });
  });
});

client.on("error", (err) => {
  console.error("MQTT connection error:", err);
});

client.on("message", (topic, message) => {
  console.log("Received message:", topic, message.toString());
});

const patients = [
  {
    id: "P001",
    name: "Alice Mwangi",
    age: 72,
    bedId: "1",
    location: "Ward A - Bed 1",
  },
  {
    id: "P002",
    name: "Brian Otieno",
    age: 68,
    bedId: "2",
    location: "Ward A - Bed 2",
  },
  {
    id: "P003",
    name: "John Doe",
    age: 65,
    bedId: "3",
    location: "Ward A - Bed 3",
  },
  {
    id: "P004",
    name: "Mary Wanjiku",
    age: 74,
    bedId: "4",
    location: "Ward A - Bed 4",
  },
];

function getRandomPatient() {
  return patients[Math.floor(Math.random() * patients.length)];
}

function getRandomWeights() {
  const headLeft = (15 + Math.random() * 10).toFixed(1);
  const headRight = (15 + Math.random() * 10).toFixed(1);
  const footLeft = (15 + Math.random() * 10).toFixed(1);
  const footRight = (15 + Math.random() * 10).toFixed(1);

  return {
    head_left: parseFloat(headLeft),
    head_right: parseFloat(headRight),
    foot_left: parseFloat(footLeft),
    foot_right: parseFloat(footRight),
  };
}

setInterval(() => {
  patients.forEach((patient, i) => {
    const topic = topics[i];

    const payload = {
      bedId: patient.bedId,
      patient: {
        id: patient.id,
        name: patient.name,
        age: patient.age,
        location: patient.location,
      },
      weights: {
        head_left: getRandomWeights().head_left,
        head_right: getRandomWeights().head_right,
        foot_left: getRandomWeights().foot_left,
        foot_right: getRandomWeights().foot_right,
      },
      timestamp: new Date().toISOString(),
    };

    client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) {
        console.error("Failed to publish message:", err);
      } else {
        console.log("Published to", topic, ":", payload);
      }
    });
  });
}, 5000);

server.listen(3000, () => {
  console.log("Server is listening on port 3000");
});
