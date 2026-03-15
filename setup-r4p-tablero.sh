#!/bin/bash
# ============================================================
#  🐂 SETUP AUTOMÁTICO — Tablero R4P MX en GitHub Pages
#
#  Este script hace TODO por ti:
#  1. Crea el repositorio en GitHub
#  2. Sube el tablero
#  3. Configura la actualización automática diaria
#  4. Activa GitHub Pages
#
#  REQUISITOS:
#  - macOS o Windows (Git Bash/WSL)
#  - Git instalado (https://git-scm.com)
#  - GitHub CLI instalado:
#      macOS:   brew install gh
#      Windows: winget install GitHub.cli
#      Linux:   sudo apt install gh
#
#  USO:
#  1. Pon este script en la misma carpeta que tu archivo
#     Tablero_Commodities_CBOT.html y update-prices.js
#  2. Abre terminal y ejecuta:
#        chmod +x setup-r4p-tablero.sh
#        ./setup-r4p-tablero.sh
# ============================================================

set -e

REPO_NAME="tablero-r4p-mx"
HTML_FILE="Tablero_Commodities_CBOT.html"
UPDATE_SCRIPT="update-prices.js"

echo ""
echo "  🐂 ═══════════════════════════════════════════"
echo "  🐂  RANCHING 4 PROFIT MX — Setup del Tablero"
echo "  🐂 ═══════════════════════════════════════════"
echo ""

# ---- Verificar herramientas ----
echo "🔍 Verificando herramientas..."

if ! command -v git &> /dev/null; then
    echo "❌ Git no está instalado. Instálalo desde https://git-scm.com"
    exit 1
fi
echo "  ✅ Git encontrado"

if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) no está instalado."
    echo "   Instálalo con:"
    echo "     macOS:   brew install gh"
    echo "     Windows: winget install GitHub.cli"
    echo "     Linux:   sudo apt install gh"
    exit 1
fi
echo "  ✅ GitHub CLI encontrado"

# ---- Login a GitHub ----
if ! gh auth status &> /dev/null; then
    echo ""
    echo "📝 Necesitas iniciar sesión en GitHub."
    echo "   Se abrirá tu navegador para autenticarte..."
    echo ""
    gh auth login --web
fi
echo "  ✅ Autenticado en GitHub"

# ---- Obtener usuario ----
GH_USER=$(gh api user --jq '.login')
echo "  👤 Usuario: $GH_USER"

# ---- Verificar que existe el HTML ----
if [ ! -f "$HTML_FILE" ]; then
    echo ""
    echo "❌ No encuentro '$HTML_FILE' en esta carpeta."
    echo "   Asegúrate de que este script esté en la misma carpeta"
    echo "   que el archivo del tablero."
    echo ""
    echo "   Archivos en esta carpeta:"
    ls -la *.html 2>/dev/null || echo "   (no hay archivos .html)"
    exit 1
fi
echo "  ✅ Archivo del tablero encontrado"

# ---- Crear repositorio ----
echo ""
echo "📦 Creando repositorio en GitHub..."

if gh repo view "$GH_USER/$REPO_NAME" &> /dev/null; then
    echo "  ⚠️  El repositorio '$REPO_NAME' ya existe."
    read -p "  ¿Quieres continuar y actualizarlo? (s/n): " CONFIRM
    if [ "$CONFIRM" != "s" ] && [ "$CONFIRM" != "S" ]; then
        echo "  Cancelado."
        exit 0
    fi
    # Clonar el existente
    rm -rf "$REPO_NAME"
    gh repo clone "$GH_USER/$REPO_NAME" "$REPO_NAME"
else
    gh repo create "$REPO_NAME" \
        --public \
        --description "🐂 Tablero de Commodities CBOT y Ganado Mexicano — Ranching 4 Profit MX" \
        --clone
fi

echo "  ✅ Repositorio listo"

# ---- Copiar archivos ----
echo ""
echo "📄 Preparando archivos..."

# Copiar HTML como index.html
cp "$HTML_FILE" "$REPO_NAME/index.html"
echo "  ✅ Tablero copiado como index.html"

# Copiar script de actualización
if [ -f "$UPDATE_SCRIPT" ]; then
    cp "$UPDATE_SCRIPT" "$REPO_NAME/"
    echo "  ✅ Script de actualización copiado"
fi

# Crear el workflow de GitHub Actions
mkdir -p "$REPO_NAME/.github/workflows"
cat > "$REPO_NAME/.github/workflows/update-dashboard.yml" << 'WORKFLOW_EOF'
name: Actualizar Tablero R4P MX

on:
  schedule:
    # Todos los días a las 12:08 UTC (6:08 AM hora México Centro)
    - cron: '8 12 * * *'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  update-prices:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repositorio
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Instalar dependencias
        run: npm install node-fetch@3

      - name: Actualizar precios CBOT
        run: node update-prices.js

      - name: Commit y push cambios
        run: |
          git config user.name "R4P MX Bot"
          git config user.email "bot@ranching4profitmx.com"
          git add index.html
          git diff --staged --quiet || git commit -m "📊 Actualización automática de precios $(date +'%Y-%m-%d %H:%M')"
          git push
WORKFLOW_EOF
echo "  ✅ Workflow de actualización creado"

# Crear README
cat > "$REPO_NAME/README.md" << 'README_EOF'
# 🐂 Tablero R4P MX — Commodities y Ganado

Tablero interactivo de precios de commodities agrícolas (CBOT/CME) y ganado bovino mexicano.

**Ranching 4 Profit MX**

## 🌐 Ver el tablero

👉 Visita el tablero en vivo en la sección **Environments** → **github-pages** de este repositorio.

## 📊 Datos incluidos

- **18 commodities CBOT/CME**: Maíz, Trigo, Soya, Ganado Vivo, y más
- **6 plazas de ganado mexicano**: Hermosillo, Chihuahua, Nuevo León, Jalisco, Durango, Tamaulipas
- **49 categorías de peso** detalladas por plaza

## 🔄 Actualización automática

Los precios CBOT se actualizan automáticamente todos los días a las 6:08 AM (hora centro de México) vía GitHub Actions.

## 📱 Compatible

Funciona en cualquier dispositivo: computadora, tablet o celular.
README_EOF
echo "  ✅ README creado"

# Crear package.json para el workflow
cat > "$REPO_NAME/package.json" << 'PKG_EOF'
{
  "name": "tablero-r4p-mx",
  "version": "1.0.0",
  "private": true,
  "description": "Tablero de Commodities y Ganado - Ranching 4 Profit MX",
  "scripts": {
    "update": "node update-prices.js"
  }
}
PKG_EOF
echo "  ✅ package.json creado"

# ---- Push a GitHub ----
echo ""
echo "🚀 Subiendo a GitHub..."

cd "$REPO_NAME"
git add -A
git commit -m "🐂 Tablero R4P MX — primera versión

Incluye:
- Tablero interactivo de commodities CBOT/CME
- Precios de ganado bovino de 6 plazas mexicanas
- Actualización automática diaria vía GitHub Actions"

git push -u origin main 2>/dev/null || git push -u origin master

cd ..
echo "  ✅ Archivos subidos"

# ---- Activar GitHub Pages ----
echo ""
echo "🌐 Activando GitHub Pages..."

gh api \
  --method POST \
  "repos/$GH_USER/$REPO_NAME/pages" \
  -f "source[branch]=main" \
  -f "source[path]=/" \
  2>/dev/null || echo "  (Pages puede estar ya activado)"

# Esperar un momento
sleep 3

# Obtener URL
PAGES_URL="https://$GH_USER.github.io/$REPO_NAME/"

echo "  ✅ GitHub Pages activado"

# ---- Resultado final ----
echo ""
echo "  🎉 ═══════════════════════════════════════════════"
echo "  🎉  ¡TABLERO PUBLICADO EXITOSAMENTE!"
echo "  🎉 ═══════════════════════════════════════════════"
echo ""
echo "  🌐 Tu tablero está en:"
echo ""
echo "     $PAGES_URL"
echo ""
echo "  📋 Repositorio:"
echo "     https://github.com/$GH_USER/$REPO_NAME"
echo ""
echo "  🔄 Actualización automática: Diaria a las 6:08 AM"
echo ""
echo "  📱 Comparte este link con tus alumnos:"
echo "     $PAGES_URL"
echo ""
echo "  ⏳ NOTA: GitHub Pages puede tardar 1-2 minutos en"
echo "     activarse la primera vez. Si no carga aún,"
echo "     espera un momento y recarga la página."
echo ""
echo "  🐂 ¡Ranching 4 Profit MX!"
echo ""
