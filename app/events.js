// Bus de eventos de dominio hacia los plugins (tom/events/* en MQTT).
// Indirection mínima para que sales.js no dependa de mqttBridge (que a su
// vez depende de sales.js): server.js conecta el publicador al arrancar.
let publisher = null;

function setPublisher(fn) {
  publisher = fn;
}

// Best-effort: si no hay broker o no se ha inicializado, el evento se pierde
// sin afectar la operación principal (los plugins son opcionales)
function publish(type, payload) {
  if (!publisher) return false;
  try {
    return publisher(type, payload);
  } catch (err) {
    console.error("events.publish:", err.message);
    return false;
  }
}

module.exports = { setPublisher, publish };
