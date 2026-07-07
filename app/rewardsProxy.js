// Proxy hacia el plugin ToM Rewards. El front habla con UNA sola URL (la del
// core) y este reenvía /rewards/* al plugin; así el desktop manager no sabe
// dónde corre el plugin ni necesita CORS extra.
//
// También expone /capabilities para que el front oculte las secciones VIP
// cuando el plugin no está instalado/levantado.
//
// Se monta ANTES de routes.js (que registra el 404 final). Incluye aliases
// legacy de las rutas de clientes que antes vivían en el core, para que un
// desktop manager viejo siga funcionando.
const { rewardsFetch, isAvailable } = require("./rewardsClient");

const CAPABILITIES_CACHE_MS = 15000;

module.exports = function (app) {
  let cached = null;
  let cachedAt = 0;

  app.get("/capabilities", async function (req, res) {
    if (cached === null || Date.now() - cachedAt > CAPABILITIES_CACHE_MS) {
      cached = { rewards: await isAvailable() };
      cachedAt = Date.now();
    }
    res.json({ confirmation: "success", data: cached });
  });

  async function forward(req, res, targetPath) {
    try {
      const response = await rewardsFetch(targetPath, {
        method: req.method,
        body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
      });
      const json = await response.json();
      res.status(response.status).json(json);
    } catch (err) {
      console.error("rewardsProxy:", req.method, targetPath, err.message);
      res
        .status(503)
        .json({ confirmation: "fail", message: "Rewards no disponible" });
    }
  }

  app.all("/rewards/*", function (req, res) {
    forward(req, res, req.originalUrl.replace(/^\/rewards/, ""));
  });

  // Aliases legacy: las rutas de clientes que el core exponía antes del split
  ["/addClient", "/editClient", "/checkClient", "/addBenefitsToClient"].forEach(
    (path) => {
      app.post(path, (req, res) => forward(req, res, path));
    }
  );
  app.get("/getClients", (req, res) => forward(req, res, "/getClients"));
};
