const mqtt = require("mqtt");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static index.html at /
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// MQTT setup
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

const topics = [
  "hospital/bed01/weights",
  "hospital/bed02/weights",
  "hospital/bed03/weights",
  "hospital/bed14/weights",
  "hospital/+/weights",
];

client.on("connect", () => {
  console.log("✅ Connected to MQTT broker");
  topics.forEach((topic) => client.subscribe(topic));
});

client.on("error", (err) => {
  console.error("❌ MQTT connection error:", err.message);
});

client.on("message", (topic, message) => {
  const payloadStr = message.toString();
  let payload;
  try {
    payload = JSON.parse(payloadStr);
  } catch {
    payload = null;
  }

  // Emit to dashboard
  io.emit("mqtt_message", { topic, message: payloadStr });

  // Run alert checks
  if (payload && payload.weights) {
    checkAlerts(payload, topic);
  }
});

// ---- Patient simulation ----
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

function getRandomWeights() {
  return {
    head_left: +(15 + Math.random() * 10).toFixed(1),
    head_right: +(15 + Math.random() * 10).toFixed(1),
    foot_left: +(15 + Math.random() * 10).toFixed(1),
    foot_right: +(15 + Math.random() * 10).toFixed(1),
  };
}

setInterval(() => {
  patients.forEach((patient, i) => {
    const topic = topics[i];
    const payload = {
      bedId: patient.bedId,
      patient,
      weights: getRandomWeights(),
      timestamp: new Date().toISOString(),
    };
    client.publish(topic, JSON.stringify(payload), { qos: 1 });
  });
}, 10000);

// ---- Alert Logic ----
function checkAlerts(payload, topic) {
  const { patient, weights, timestamp } = payload;
  const total =
    weights.head_left +
    weights.head_right +
    weights.foot_left +
    weights.foot_right;

  // Thresholds
  const minBedWeight = 20; // kg → likely empty bed
  const maxSuddenChange = 15; // kg drop/gain → sudden movement
  const imbalanceThreshold = 0.7; // >70% weight on one side

  // Check 1: Patient left bed
  if (total < minBedWeight) {
    emitAlert("Patient left bed", patient, topic, timestamp);
    return;
  }

  // Check 2: Imbalance
  const maxQuadrant = Math.max(
    weights.head_left,
    weights.head_right,
    weights.foot_left,
    weights.foot_right
  );
  if (maxQuadrant / total > imbalanceThreshold) {
    emitAlert("Dangerous weight imbalance", patient, topic, timestamp);
    return;
  }

  // (Optional: track previous weight for sudden change detection)
  if (!patient.lastWeight) {
    patient.lastWeight = total;
  } else {
    const diff = Math.abs(total - patient.lastWeight);
    if (diff > maxSuddenChange) {
      emitAlert("Sudden bed weight change", patient, topic, timestamp);
    }
    patient.lastWeight = total;
  }
}

function emitAlert(reason, patient, topic, timestamp) {
  const alert = {
    reason,
    patient,
    topic,
    ts: timestamp || new Date().toISOString(),
  };
  io.emit("nurse_alert", alert);
  console.log("🚨 Alert:", reason, "for", patient.name);
}

// ---- Start server ----
server.listen(3000, () => {
  console.log("🚀 Server running at http://localhost:3000");
});
