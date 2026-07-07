// Validación de tarjetas (workers y clientes), compartida entre Socket.IO y
// MQTT. Incluye el fallback al servicio selfpour para workers que no están en
// la base local: la respuesta asíncrona se enruta de vuelta al transporte que
// originó la consulta mediante un closure reply(event, payload).
var Worker = require("./models/worker");
const { checkClient } = require("./rewardsClient");

const TIMEOUT_MS = 500;

let requestCounter = 0;
const pendingRequests = {};
let selfpourSocket = null;

function generateUniqueId() {
  requestCounter += 1;
  return `req_${requestCounter}_${Date.now()}`;
}

// Registrado UNA sola vez (antes se agregaba un listener por cada dispositivo
// conectado: fuga de memoria + emisiones duplicadas).
function attachSelfpour(socket) {
  selfpourSocket = socket;
  socket.on("validated user", msg => {
    const pending = pendingRequests[msg.requestId];
    if (!pending) return;
    clearTimeout(pending.timeout);
    delete pendingRequests[msg.requestId];

    if (msg.confirmation === "success") {
      console.log("User validated: ", msg.data);
      pending.reply("validated user", {
        confirmation: "success",
        data: msg.data,
        requestId: msg.requestId
      });
    } else {
      console.log("User not validated");
      pending.reply("validated user", {
        confirmation: "fail",
        requestId: msg.requestId
      });
    }
  });
}

function validateWorker(cardId, reply) {
  return Worker.findOne({ cardId })
    .exec()
    .then(worker => {
      if (worker)
        return reply("validated user", { confirmation: "success", data: worker });

      if (!selfpourSocket || !selfpourSocket.connected)
        return reply("validated user", { confirmation: "fail" });

      const requestId = generateUniqueId();
      const timeout = setTimeout(() => {
        reply("validated user", { confirmation: "fail", requestId });
        delete pendingRequests[requestId];
      }, TIMEOUT_MS);
      pendingRequests[requestId] = { timeout, reply };
      selfpourSocket.emit("getWorker", { msg: { cardId, requestId } });
    })
    .catch(err => {
      console.error("validateWorker:", err);
      reply("validated user", { confirmation: "fail", error: err.message });
    });
}

// Los clientes VIP son del plugin de rewards: si el plugin no está, la
// validación falla y la línea lo trata como tarjeta desconocida
function validateClient(cardId, reply) {
  return checkClient(cardId)
    .then(client => {
      if (client)
        reply("validated client", { confirmation: "success", data: client });
      else reply("validated client", { confirmation: "fail" });
    })
    .catch(err => {
      console.error("validateClient:", err);
      reply("validated client", { confirmation: "fail" });
    });
}

module.exports = { attachSelfpour, validateWorker, validateClient };
