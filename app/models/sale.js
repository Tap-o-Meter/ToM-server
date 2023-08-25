var mongoose = require("mongoose");

var saleSchema = mongoose.Schema({
  _id: String,
  workerId: String,
  kegId: String,
  concept: String,
  qty: String,
  clientId: String,
  date: { type: Date }
});

var SaleModel = mongoose.model("Sale", saleSchema);

module.exports = SaleModel;
