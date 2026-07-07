# ToM Server (Tap o Meter)

Servidor de control de barriles/cervezas para Tap & Pour. Expone una API REST
(Express) y dos canales en tiempo real: **MQTT** (líneas con firmware nuevo)
y **Socket.IO** (líneas con firmware viejo, desk manager y clientes de
auto-servicio). Ambos canales conviven y llegan a la misma lógica
(`app/sales.js`, `app/lineService.js`, `app/workerLookup.js`).

> ⚠️ **Socket.IO está fijado en la versión `2.3.0` a propósito.** Hay
> dispositivos en producción que usan un cliente muy antiguo. **No actualices
> `socket.io`/`socket.io-client` ni cambies nombres de eventos o la forma de los
> payloads**, o romperás la compatibilidad con el hardware conectado.

## 📡 Canal MQTT (líneas)

El broker es Mosquitto (servicio `mosquitto` del compose, puerto `1883`).
El puente vive en `app/mqttBridge.js`; si el paquete `mqtt` no está instalado
o el broker no responde, se deshabilita solo y todo sigue por Socket.IO.

| Topic | Dirección | Contenido |
|-------|-----------|-----------|
| `tom/lines/{id}/setup` | línea → server | pide su `device info` |
| `tom/lines/{id}/sale` | línea → server | venta (`workerId, kegId, concept, qty`) |
| `tom/lines/{id}/getWorker` / `getClient` | línea → server | validación de tarjeta |
| `tom/lines/{id}/redeemBeer` | línea → server | canje (`clientId, kegId`) |
| `tom/lines/{id}/status` | línea → server | `online`/`offline` retained (LWT) |
| `tom/lines/{id}/cmd/info` | server → línea | `device info` **retained** |
| `tom/lines/{id}/cmd/{validated_user\|validated_client\|remoteSell\|claimBeer\|disconnectedLine}` | server → línea | respuestas y comandos |
| `tom/broadcast/addEmergencyCard` | server → líneas | tarjeta de emergencia **retained** |

Por qué es más robusto que Socket.IO para los dispositivos: el `info` retained
hace que una línea reciba su configuración al arrancar aunque el server esté
ocupado; el Last Will avisa solo cuando una línea muere; y el firmware guarda
en SPIFFS las ventas que no pudo publicar y las reenvía al reconectar.

## 🚀 Inicio

```bash
npm install
npm start
```

- **HTTP:** http://localhost:3000
- **HTTPS:** https://localhost:3443 (si hay certificados en `cert/`)

Para HTTPS y certificados ver [HTTPS-README.md](HTTPS-README.md).

## 🔧 Variables de entorno

Todas tienen un valor por defecto, así que el server arranca sin configurarlas.
En **producción** conviene definirlas (sobre todo los secretos de Cloudinary).

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `3000` | Puerto HTTP |
| `HTTPS_PORT` | `3443` | Puerto HTTPS |
| `MONGODB_URI` | `mongodb://0.0.0.0:27017/beer_control` | Conexión a MongoDB |
| `MQTT_URL` | `mqtt://localhost:1883` | Broker MQTT de las líneas |
| `DATA_FOLDER` | `/home/tom/Documents/Beer_control/data` | Carpeta con `local.json` y `.emergencyCard.json` |
| `CLOUD_SOCKET_URL` | `https://chikilla-real-time-taps.herokuapp.com/` | Socket.IO del servicio en la nube |
| `SELFPOUR_SOCKET_URL` | `http://192.168.1.79` | Socket.IO del módulo de auto-servicio |
| `CLOUDINARY_CLOUD_NAME` | _(valor actual)_ | Cloudinary — subida de imágenes |
| `CLOUDINARY_API_KEY` | _(valor actual)_ | Cloudinary |
| `CLOUDINARY_API_SECRET` | _(valor actual)_ | Cloudinary — **rotar y mover a env var** |

> 🔐 Los valores de Cloudinary siguen como fallback en `config/index.js` para no
> romper la instalación actual. Antes de considerarlo seguro: define los env vars
> en la máquina y **rota el `api_secret`** (ya quedó en el historial de git).

## 🐳 Docker (despliegue replicable)

Pensado para correr en Raspberry Pi 4 (arm64) de forma idéntica en cada sitio.

```bash
cp .env.example .env        # completar valores del sitio
docker compose up -d --build
docker compose logs -f app  # ver logs
```

Levanta dos servicios:
- **`app`** — el server (Node 20, Socket.IO 2.3.0 intacto), con `restart: unless-stopped`.
- **`mongo`** — `mongo:4.4` con volumen persistente `mongo-data`.

**Decisiones importantes:**
- **Mongo pineado a `4.4`**: `mongoose@4.2.8` no se conecta a Mongo 5+, y Mongo 5+ **no corre en Pi 4** (requiere ARMv8.2-A). No subir esa versión sin modernizar la capa de datos.
- **Socket.IO no cambia** (`2.3.0`): la imagen solo lo empaqueta.
- **Volúmenes** (datos persisten fuera del contenedor): `./data`, `./dist`, `./images`, `./uploads`, `./cert` (este último solo lectura).
- **Red:** se publican los puertos `3000`/`3443` (modo bridge). Si algún dispositivo legacy tuviera problemas para conectar por WebSocket, la alternativa es poner el servicio `app` en `network_mode: host` y apuntar `MONGODB_URI` a `127.0.0.1`.

> 🧪 **Probar primero en una Pi de repuesto** (que conecten dispositivos de prueba, validen usuario, sirvan y suban imagen) antes de migrar una instalación en producción.

La imagen se construye nativamente en la propia Pi (`arm64`). Para builds multi-arquitectura usar `docker buildx`.

## 📂 Estructura

```
server.js              # Bootstrap: Express + HTTP/HTTPS + Socket.IO + Agenda
app/routes.js          # Endpoints REST
app/socketHandlers.js  # Handlers de Socket.IO (líneas, workers, ventas)
app/models/            # Modelos de Mongoose
config/index.js        # Niveles, beneficios, opciones de concepto, credenciales
```

## 🗒️ Notas de operación

- El proceso registra `uncaughtException` / `unhandledRejection` y **se mantiene
  vivo** ante errores en callbacks async, para no desconectar a todos los
  dispositivos de golpe. Revisa los logs si aparecen estos mensajes.
- La carpeta `data/` y `cert/` están en `.gitignore`. `node_modules/` también se
  ignora a futuro (aunque hoy sigue versionado en el historial).
