var mongoose = require("mongoose");

var lineSchema = mongoose.Schema({
  _id: String,
  socketId: String,
  idKeg: { type: String, default: "" },
  noLinea: { type: Number }
});

var LineModel = mongoose.model("Line", lineSchema);

module.exports = LineModel;
