var mongoose = require("mongoose");

var citaSchema = mongoose.Schema({
  _id: String,
  hora: String,
  fecha: String,
  idUser: String,
  idPlace: String,
  idWorker: String
});

var CitaModel = mongoose.model("Cita", citaSchema);

module.exports = CitaModel;
