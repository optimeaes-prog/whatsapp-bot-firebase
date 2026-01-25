#!/bin/bash

# Script para configurar variables de entorno en Firebase desde .env
# Uso: ./scripts/setupProduction.sh

set -e

echo "🔧 Configurando Firebase Functions para producción..."
echo ""

# Verificar que existe el archivo .env
if [ ! -f "functions/.env" ]; then
    echo "❌ Error: No se encuentra el archivo functions/.env"
    exit 1
fi

# Cargar variables del .env
source functions/.env

echo "📝 Configurando secrets..."
echo ""

# Configurar WHAPI_TOKEN
if [ ! -z "$WHAPI_TOKEN" ]; then
    echo "🔑 Configurando WHAPI_TOKEN..."
    echo "$WHAPI_TOKEN" | firebase functions:secrets:set WHAPI_TOKEN
    echo "✅ WHAPI_TOKEN configurado"
else
    echo "⚠️  WHAPI_TOKEN no encontrado en .env"
fi

# Configurar OPENAI_API_KEY
if [ ! -z "$OPENAI_API_KEY" ]; then
    echo "🔑 Configurando OPENAI_API_KEY..."
    echo "$OPENAI_API_KEY" | firebase functions:secrets:set OPENAI_API_KEY
    echo "✅ OPENAI_API_KEY configurado"
else
    echo "⚠️  OPENAI_API_KEY no encontrado en .env"
fi

echo ""
echo "📝 Configurando variables de entorno..."
echo ""

# Configurar WHAPI_API_URL
if [ ! -z "$WHAPI_API_URL" ]; then
    firebase functions:config:set whapi.url="$WHAPI_API_URL"
    echo "✅ whapi.url configurado: $WHAPI_API_URL"
else
    firebase functions:config:set whapi.url="https://gate.whapi.cloud"
    echo "✅ whapi.url configurado (default): https://gate.whapi.cloud"
fi

# Configurar OPENAI_MODEL
if [ ! -z "$OPENAI_MODEL" ]; then
    firebase functions:config:set openai.model="$OPENAI_MODEL"
    echo "✅ openai.model configurado: $OPENAI_MODEL"
else
    firebase functions:config:set openai.model="gpt-4o"
    echo "✅ openai.model configurado (default): gpt-4o"
fi

# Configurar NOTIFICATION_NUMBER
if [ ! -z "$NOTIFICATION_NUMBER" ]; then
    firebase functions:config:set notification.number="$NOTIFICATION_NUMBER"
    echo "✅ notification.number configurado: $NOTIFICATION_NUMBER"
else
    echo "⚠️  NOTIFICATION_NUMBER no encontrado en .env (puedes configurarlo después)"
fi

echo ""
echo "🎉 Configuración completada!"
echo ""
echo "📋 Resumen de configuración:"
firebase functions:config:get
echo ""
echo "✅ Listo para desplegar. Ejecuta: firebase deploy --only functions"
