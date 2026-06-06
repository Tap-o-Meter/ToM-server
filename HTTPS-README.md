# Configuración HTTPS

Este servidor ahora soporta HTTPS con certificados SSL autofirmados.

## 🚀 Inicio Rápido

Los certificados ya han sido generados. Solo inicia el servidor:

```bash
npm start
```

## 🌐 URLs Disponibles

- **HTTP:** http://localhost:3000
- **HTTPS:** https://localhost:3443

## 🔒 Certificados SSL

Los certificados se encuentran en la carpeta `cert/`:
- `cert/server.key` - Clave privada
- `cert/server.crt` - Certificado público

### Regenerar Certificados

Si necesitas regenerar los certificados:

```bash
./generate-cert.sh
```

## ⚠️ Advertencia del Navegador

Como el certificado es autofirmado, el navegador mostrará una advertencia de seguridad. Para continuar:

1. En Chrome/Brave: Haz clic en "Avanzado" → "Continuar a localhost (no seguro)"
2. En Firefox: Haz clic en "Avanzado" → "Aceptar el riesgo y continuar"

Esto es **normal para desarrollo local** con certificados autofirmados.

## 🔧 Configuración

### Variables de Entorno

Puedes cambiar los puertos con variables de entorno:

```bash
PORT=3000 HTTPS_PORT=3443 npm start
```

### Modo Solo HTTP

Si no hay certificados en `./cert/`, el servidor solo iniciará en modo HTTP.

## 📱 Acceso desde otros dispositivos

Para acceder desde otros dispositivos en tu red local con HTTPS:

1. Encuentra tu IP local: `ifconfig` (busca tu IP, ej: 192.168.1.59)
2. Accede desde otro dispositivo: `https://192.168.1.59:3443`

**Nota:** Necesitarás aceptar el certificado en cada dispositivo.

## 🔐 Para Producción

Para producción, usa certificados válidos de Let's Encrypt o tu proveedor SSL favorito. Reemplaza los archivos en `cert/` con:
- Tu certificado: `cert/server.crt`
- Tu clave privada: `cert/server.key`
