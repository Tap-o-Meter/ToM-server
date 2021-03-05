var mongoose = require("mongoose");

var stockSchema = mongoose.Schema({
  _id: String,
  image: { type: String, default: "" },
  name: String,
  brand: String,
  volume: { type: Number, min: 0 },
  unity: String,
  min_product: Number,
  lead_time: Number
});

var StockModel = mongoose.model("Stock", stockSchema);

module.exports = StockModel;
