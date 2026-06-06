#!/bin/bash

# Script para generar certificados SSL autofirmados

echo "Generando certificados SSL autofirmados..."

# Crear directorio para certificados
mkdir -p cert

# Generar certificado autofirmado
openssl req -newkey rsa:2048 -new -nodes -x509 -days 3650 \
  -keyout cert/server.key \
  -out cert/server.crt \
  -subj "/C=MX/ST=Estado/L=Ciudad/O=ChikillaVIP/OU=Dev/CN=localhost"

echo ""
echo "✅ Certificados generados exitosamente en ./cert/"
echo ""
echo "📁 Archivos creados:"
echo "   - cert/server.key (clave privada)"
echo "   - cert/server.crt (certificado)"
echo ""
echo "🚀 Ahora puedes iniciar el servidor con:"
echo "   npm start"
echo ""
echo "🌐 Servidores disponibles en:"
echo "   HTTP:  http://localhost:3000"
echo "   HTTPS: https://localhost:3443"
echo ""
