var mongoose = require("mongoose");

var workerSchema = mongoose.Schema({
  _id: String,
  foto: String,
  horarios: Array,
  nombre: String,
  ocupacion: String,
  workerAt: String,
  step: String,
  turno: Array
});

var WorkerModel = mongoose.model("Worker", workerSchema);

module.exports = WorkerModel;
