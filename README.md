# ToM Server (Tap o Meter)

Servidor de control de barriles/cervezas para Tap & Pour. Expone una API REST
(Express) y un canal en tiempo real (Socket.IO) al que se conectan las líneas
(dispositivos de tiro), el desk manager y los clientes de auto-servicio.

> ⚠️ **Socket.IO está fijado en la versión `2.3.0` a propósito.** Hay
> dispositivos en producción que usan un cliente muy antiguo. **No actualices
> `socket.io`/`socket.io-client` ni cambies nombres de eventos o la forma de los
> payloads**, o romperás la compatibilidad con el hardware conectado.

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
| `DATA_FOLDER` | `/home/tom/Documents/Beer_control/data` | Carpeta con `local.json` y `.emergencyCard.json` |
| `CLOUD_SOCKET_URL` | `https://chikilla-real-time-taps.herokuapp.com/` | Socket.IO del servicio en la nube |
| `SELFPOUR_SOCKET_URL` | `http://192.168.1.79` | Socket.IO del módulo de auto-servicio |
| `CLOUDINARY_CLOUD_NAME` | _(valor actual)_ | Cloudinary — subida de imágenes |
| `CLOUDINARY_API_KEY` | _(valor actual)_ | Cloudinary |
| `CLOUDINARY_API_SECRET` | _(valor actual)_ | Cloudinary — **rotar y mover a env var** |

> 🔐 Los valores de Cloudinary siguen como fallback en `config/index.js` para no
> romper la instalación actual. Antes de considerarlo seguro: define los env vars
> en la máquina y **rota el `api_secret`** (ya quedó en el historial de git).

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
