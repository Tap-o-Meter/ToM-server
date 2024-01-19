var mongoose = require("mongoose");

var lineSchema = mongoose.Schema({
  _id: String,
  socketId: String,
  idKeg: { type: String, default: "" },
  noLinea: { type: Number },
  virtual: { type: Boolean, default: false }
});

var LineModel = mongoose.model("Line", lineSchema);

module.exports = LineModel;
