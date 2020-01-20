var mongoose = require("mongoose");

var workerSchema = mongoose.Schema({
  _id: String,
  nombre: String,
  apellidos: String,
  cardId: String
});

var WorkerModel = mongoose.model("Worker", workerSchema);

module.exports = WorkerModel;
