var mongoose = require("mongoose");

var saleSchema = mongoose.Schema({
  _id: String,
  workerId: String,
  kegId: String,
  concept: String,
  qty: String,
  // ml servidos por encima del qty nominal (top-up del firmware); qty se
  // conserva nominal porque las vistas cuentan tamaños por match exacto
  extraMl: { type: Number, default: 0 },
  clientId: String,
  date: { type: Date }
});

var SaleModel = mongoose.model("Sale", saleSchema);

module.exports = SaleModel;
