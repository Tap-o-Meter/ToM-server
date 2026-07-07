// Puente MQTT ↔ lógica del server. Es el canal nuevo de las líneas (firmware
// MQTT) y convive con Socket.IO (firmware viejo y dashboard): ambos llegan a
// los mismos servicios (sales, lineService, workerLookup), así que el
// comportamiento es idéntico por cualquiera de los dos transportes.
//
// Topics:
//   Línea → server : tom/lines/{id}/{setup|sale|getWorker|getClient|redeemBeer|status}
//   Server → línea : tom/lines/{id}/cmd/{info|validated_user|validated_client|
//                                        remoteSell|claimBeer|disconnectedLine}
//   Broadcast      : tom/broadcast/addEmergencyCard (retained)
//
// Robustez que regala el broker:
//   - "info" se publica RETAINED: una línea que arranca recibe su configuración
//     al suscribirse, aunque el server estuviera caído en ese momento.
//   - "status" usa Last Will: si una línea muere, el broker publica "offline"
//     solo, sin que el server tenga que detectarlo.
//
// Si el paquete mqtt no está instalado o el broker no responde, el puente se
// deshabilita solo y todo sigue operando por Socket.IO.

let mqtt = null;
try {
  mqtt = require("mqtt");
} catch (e) {
  console.warn(
    "mqttBridge: paquete 'mqtt' no instalado; canal MQTT deshabilitado"
  );
}

const { registerSale, redeemBenefitBeer } = require("./sales");
const { getOrCreateLine, buildDeviceInfo } = require("./lineService");
const { validateWorker, validateClient } = require("./workerLookup");
var Line = require("./models/Line");

const PREFIX = "tom/lines/";
const BROADCAST = "tom/broadcast/";

// Evento (nombre Socket.IO) → segmento del topic cmd/ que escucha el firmware
const EVENT_TOPIC = {
  "device info": "info",
  "validated user": "validated_user",
  "validated client": "validated_client",
  remoteSell: "remoteSell",
  claimBeer: "claimBeer",
  disconnectedLine: "disconnectedLine"
};

let client = null;
let ioRef = null;
let lineListRef = null;
let servingListRef = null;
let selfpourRef = null;
const onlineLines = new Set();

function init(deps) {
  ioRef = deps.io;
  lineListRef = deps.lineList;
  servingListRef = deps.servingList;
  selfpourRef = deps.selfpour_socket;
  if (!mqtt) return;

  const url = process.env.MQTT_URL || "mqtt://localhost:1883";
  client = mqtt.connect(url, {
    clientId: "tom-server",
    clean: true,
    reconnectPeriod: 2000
  });

  client.on("connect", () => {
    console.log("mqttBridge: conectado a", url);
    client.subscribe(PREFIX + "+/+", { qos: 1 }, err => {
      if (err) console.error("mqttBridge: error al suscribirse:", err.message);
    });
  });

  client.on("error", err => console.error("mqttBridge:", err.message));
  client.on("offline", () => console.warn("mqttBridge: broker fuera de línea"));

  client.on("message", (topic, payload) => {
    try {
      handleMessage(topic, payload.toString());
    } catch (err) {
      console.error("mqttBridge: error procesando", topic, err);
    }
  });
}

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("mqttBridge: JSON inválido:", raw);
    return null;
  }
}

function handleMessage(topic, raw) {
  if (!topic.startsWith(PREFIX)) return;
  const parts = topic.slice(PREFIX.length).split("/");
  if (parts.length !== 2) return; // los cmd/{...} (3 niveles) no entran aquí
  const lineId = parts[0];
  const action = parts[1];
  const reply = makeReply(lineId);

  switch (action) {
    case "status":
      handleStatus(lineId, raw);
      break;

    case "setup":
      handleSetup(lineId);
      break;

    case "sale": {
      const msg = parseJson(raw);
      if (!msg || !msg.kegId) return;
      if ((msg.workerId || "").length === 0) {
        if (selfpourRef) selfpourRef.emit("finished_pour", msg);
        return;
      }
      registerSale(msg)
        .then(({ keg, sale }) => {
          removeFromServing(msg.lineId || lineId);
          ioRef.emit("sale-commited", { data: keg, doc: sale });
        })
        .catch(err => console.error("mqttBridge sale:", err.message));
      break;
    }

    case "getWorker": {
      const msg = parseJson(raw);
      if (msg && msg.cardId) validateWorker(msg.cardId, reply);
      break;
    }

    case "getClient": {
      const msg = parseJson(raw);
      if (msg && msg.cardId) validateClient(msg.cardId, reply);
      break;
    }

    case "redeemBeer": {
      const msg = parseJson(raw);
      if (!msg) return;
      redeemBenefitBeer(msg).catch(err =>
        console.error("mqttBridge redeemBeer:", err.message)
      );
      break;
    }

    default:
  }
}

// Mismo efecto que removeFromServing de socketHandlers, sobre la misma lista
function removeFromServing(lineId) {
  const index = servingListRef.findIndex(s => s.lineId === lineId);
  if (index !== -1) {
    servingListRef.splice(index, 1);
    ioRef.emit("removedFromServing", { lineId });
  }
}

function handleStatus(lineId, raw) {
  if (raw === "online") {
    onlineLines.add(lineId);
    addLineToList(lineId);
  } else {
    onlineLines.delete(lineId);
    removeLineFromList(lineId);
  }
}

// Mantiene lineList y los eventos lineConnected/lineDisconnected que ya
// consume el dashboard, igual que el camino Socket.IO
function addLineToList(id) {
  const index = lineListRef.findIndex(line => line.id === id);
  index === -1
    ? lineListRef.push({ id, socket: "mqtt" })
    : (lineListRef[index].socket = "mqtt");
  ioRef.emit("lineConnected", { id, socket: "mqtt" });
}

function removeLineFromList(id) {
  const index = lineListRef.findIndex(
    line => line.id === id && line.socket === "mqtt"
  );
  if (index !== -1) {
    lineListRef.splice(index, 1);
    ioRef.emit("lineDisconnected", { socket: "mqtt", id });
  }
}

function handleSetup(lineId) {
  getOrCreateLine(lineId, "mqtt")
    .then(({ line }) => {
      onlineLines.add(lineId);
      addLineToList(lineId);
      return buildDeviceInfo(line).then(info => {
        if (info) publishToLine(lineId, "device info", info, { retain: true });
        else {
          clearRetainedInfo(lineId);
          publishToLine(lineId, "disconnectedLine", "{}");
        }
      });
    })
    .catch(err => console.error("mqttBridge setup:", err.message));
}

function makeReply(lineId) {
  return (event, payload) => publishToLine(lineId, event, payload);
}

// ============ API para routes.js / server.js ============

function isOnline(lineId) {
  return client !== null && onlineLines.has(lineId);
}

function publishToLine(lineId, event, payload, opts) {
  if (!client) return false;
  const segment = EVENT_TOPIC[event];
  if (!segment) return false;
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  client.publish(PREFIX + lineId + "/cmd/" + segment, body, {
    qos: 1,
    retain: !!(opts && opts.retain)
  });
  return true;
}

// Publicar retained vacío borra el mensaje retenido del broker
function clearRetainedInfo(lineId) {
  if (client) client.publish(PREFIX + lineId + "/cmd/info", "", { retain: true });
}

// Refresca el "device info" retenido de una línea (p. ej. tras /connect-line).
// La línea lo recibe al instante si está en línea, o al arrancar si no.
function publishDeviceInfo(lineId) {
  if (!client) return Promise.resolve(false);
  return Line.findOne({ _id: lineId })
    .exec()
    .then(line => {
      if (!line) return false;
      return buildDeviceInfo(line).then(info => {
        if (info) publishToLine(lineId, "device info", info, { retain: true });
        else {
          clearRetainedInfo(lineId);
          publishToLine(lineId, "disconnectedLine", "{}");
        }
        return true;
      });
    })
    .catch(err => {
      console.error("mqttBridge publishDeviceInfo:", err.message);
      return false;
    });
}

// Línea desconectada de su barril desde el admin
function publishDisconnectedLine(lineId) {
  clearRetainedInfo(lineId);
  return publishToLine(lineId, "disconnectedLine", "{}");
}

// Eventos de dominio para plugins (p. ej. ToM Rewards): tom/events/{type}.
// QoS 1 + suscriptores con sesión persistente = el broker les guarda los
// eventos mientras están caídos.
function publishEvent(type, payload) {
  if (!client) return false;
  client.publish("tom/events/" + type, JSON.stringify(payload), { qos: 1 });
  return true;
}

// Tarjeta de emergencia: retained para que las líneas apagadas la reciban
// en cuanto arranquen
function publishEmergencyCard(cardId) {
  if (!client) return false;
  client.publish(
    BROADCAST + "addEmergencyCard",
    JSON.stringify({ data: cardId }),
    { qos: 1, retain: true }
  );
  return true;
}

module.exports = {
  init,
  isOnline,
  publishToLine,
  publishEvent,
  publishDeviceInfo,
  publishDisconnectedLine,
  publishEmergencyCard
};
