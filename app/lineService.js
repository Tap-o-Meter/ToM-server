// Lógica de líneas compartida entre transportes (Socket.IO y MQTT).
// Antes vivía dentro del handler "setUp" de socketHandlers; se extrae para
// que ambos canales construyan exactamente el mismo "device info" que espera
// el firmware.
var Line = require("./models/Line");
var Keg = require("./models/keg");
var Beer = require("./models/beer");
const fs = require("fs");
const path = require("path");

const folder =
  process.env.DATA_FOLDER || "/home/tom/Documents/Beer_control/data";

// Busca la línea y guarda su referencia de transporte (socketId real para
// Socket.IO, "mqtt" para MQTT). Si no existe la crea con el siguiente
// noLinea. Resuelve { line, created }.
function getOrCreateLine(id, transportRef) {
  return Line.findOneAndUpdate(
    { _id: id },
    { $set: { socketId: transportRef } },
    { new: true }
  )
    .exec()
    .then(line => {
      if (line) return { line, created: false };
      return Line.findOne({})
        .sort({ noLinea: -1 })
        .exec()
        .then(last => {
          const newLine = new Line({
            _id: id,
            socketId: transportRef,
            noLinea: last ? last.noLinea + 1 : 1
          });
          return newLine.save().then(saved => ({ line: saved, created: true }));
        });
    });
}

function readEmergencyCard() {
  return new Promise(resolve => {
    fs.readFile(path.join(folder, ".emergencyCard.json"), "utf8", (err, doc) => {
      if (err) return resolve(null);
      try {
        resolve(JSON.parse(doc).cardId);
      } catch (e) {
        console.error("lineService: .emergencyCard.json ilegible:", e.message);
        resolve(null);
      }
    });
  });
}

// Arma el payload de "device info" (línea + cerveza + tarjeta de emergencia).
// Resuelve null si la línea no tiene barril/cerveza asignados, en cuyo caso
// el transporte debe mandar "disconnectedLine".
function buildDeviceInfo(line) {
  if (!line.idKeg) return Promise.resolve(null);
  return Keg.findOne({ _id: line.idKeg })
    .exec()
    .then(keg => {
      if (!keg) return null;
      return Beer.findOne({ _id: keg.beerId })
        .exec()
        .then(beer => {
          if (!beer) return null;
          return readEmergencyCard().then(emergencyCard =>
            Object.assign({}, line._doc, {
              name: beer.name,
              style: beer.style,
              abv: keg.abv,
              ibu: keg.ibu,
              available: keg.available,
              capacity: keg.capacity,
              emergencyCard
            })
          );
        });
    });
}

module.exports = { getOrCreateLine, buildDeviceInfo };
