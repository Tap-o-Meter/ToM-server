// Cliente HTTP hacia el plugin ToM Rewards (dueño de clientes VIP y
// beneficios). Todas las llamadas tienen timeout corto y degradan a null:
// si el plugin no está, el sistema principal sigue operando sin rewards.
const REWARDS_URL = process.env.REWARDS_URL || "http://localhost:3001";
const TIMEOUT_MS = 3000;

async function rewardsFetch(path, options = {}) {
  return fetch(REWARDS_URL + path, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(options.timeout || TIMEOUT_MS),
  });
}

// true si el plugin responde su healthcheck
async function isAvailable() {
  try {
    const res = await rewardsFetch("/health", { timeout: 1500 });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// Cliente VIP por tarjeta, o null (no existe / plugin caído)
async function checkClient(cardId) {
  try {
    const res = await rewardsFetch("/checkClient", {
      method: "POST",
      body: { cardId },
    });
    const json = await res.json();
    return json.confirmation === "success" ? json.data : null;
  } catch (e) {
    console.error("rewardsClient.checkClient:", e.message);
    return null;
  }
}

module.exports = { REWARDS_URL, rewardsFetch, isAvailable, checkClient };
