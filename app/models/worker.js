var mongoose = require("mongoose");

var workerSchema = mongoose.Schema({
  _id: String,
  foto: { type: String, default: null },
  nombre: String,
  apellidos: String,
  cardId: String,
  horario: { type: Array }
});

var WorkerModel = mongoose.model("Worker", workerSchema);

module.exports = WorkerModel;
