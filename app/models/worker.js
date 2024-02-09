var mongoose = require("mongoose");

var workerSchema = mongoose.Schema({
  _id: String,
  nombre: String,
  apellidos: String,
  cardId: String,
  credit: { type: Number, default: 0},
  staff: { type: Boolean, default: false },
  beers: {
    type: mongoose.Schema.Types.Mixed,
    default: { pint: 0, taster: 0, flight: 6 }
  },
});

var WorkerModel = mongoose.model("Worker", workerSchema);

module.exports = WorkerModel;


