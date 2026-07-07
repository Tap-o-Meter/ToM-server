// Lógica compartida de registro de ventas. La usan el evento de socket
// "sale_complete" y la ruta REST /sale_completed, que antes duplicaban este
// código y ya habían divergido (la versión REST concatenaba la merma como
// string en vez de sumarla).
var mongoose = require("mongoose");
var Keg = require("./models/keg");
var Sale = require("./models/sale");
const events = require("./events");

// Actualiza el barril con $inc atómico: varias líneas pueden vender al mismo
// tiempo y el patrón find-modificar-save perdía actualizaciones entre lecturas.
// Resuelve con { keg, sale }; rechaza si el barril no existe.
// opts.skipClientCount evita sumar beersDrinked (p. ej. canjes de beneficio,
// que nunca lo han contado).
function registerSale(msg, opts) {
  opts = opts || {};
  const qty = parseFloat(msg.qty) || 0;
  // El firmware manda qty en LITROS (serve_options del KRN_32: ".473", "1"...)
  // pero los campos volumétricos del barril (available/capacity/merma) viven
  // en ML. Se convierte solo aquí; Sale.qty se conserva en litros como siempre.
  const qtyMl = qty * 1000;

  const inc = { available: -qtyMl };
  const update = { $inc: inc };
  switch (msg.concept) {
    case "TASTER":
      inc.taster = 1;
      break;
    case "PINT":
      inc.soldPints = 1;
      break;
    case "MERMA":
      inc.merma = qtyMl;
      break;
    case "GROWLER":
      update.$push = { growlers: { qty: msg.qty } };
      break;
    default:
  }

  const newSale = new Sale();
  newSale._id = new mongoose.Types.ObjectId().toString();
  newSale.date = new Date();
  Object.assign(newSale, msg);

  return Keg.findOneAndUpdate({ _id: msg.kegId }, update, { new: true })
    .exec()
    .then(keg => {
      if (!keg) throw new Error("Keg no encontrado: " + msg.kegId);
      return newSale.save().then(sale => {
        // La lealtad es dominio del plugin de rewards: se publica el evento
        // y el plugin acumula beersDrinked/niveles si corresponde
        events.publish("sale", {
          saleId: sale._id,
          clientId: msg.clientId || null,
          workerId: msg.workerId || null,
          kegId: msg.kegId,
          concept: msg.concept,
          qty: msg.qty,
          countLoyalty: !!msg.clientId && !opts.skipClientCount
        });
        return { keg, sale };
      });
    });
}

// Canje de cerveza de beneficio (evento "redeemBeer" de las líneas, por
// socket o MQTT). El firmware solo manda { clientId, kegId }: un canje
// siempre es un vaso de 16oz (0.473 L).
function redeemBenefitBeer(msg) {
  // El firmware viejo puede mandar el clientId con comillas incrustadas
  // (lo recibe como payload crudo de "claimBeer"); se limpian por si acaso.
  const clientId = String((msg && msg.clientId) || "").replace(/^"+|"+$/g, "");
  if (!clientId || !msg.kegId)
    return Promise.reject(new Error("redeemBeer: payload incompleto"));
  // El descuento del beneficio es dominio del plugin de rewards; el core
  // solo registra la venta en el inventario
  events.publish("benefit-consumed", { clientId });
  return registerSale(
    {
      clientId,
      kegId: msg.kegId,
      workerId: "N/A",
      concept: "PINT",
      qty: ".473"
    },
    { skipClientCount: true }
  );
}

module.exports = { registerSale, redeemBenefitBeer };
