/**
 * update-prices.js
 * Script para actualizar los precios del tablero R4P MX
 * Se ejecuta vía GitHub Actions diariamente
 *
 * NOTA: Este script usa APIs públicas gratuitas para CBOT/CME.
 * Para los precios de ganado mexicano, usa datos de referencia
 * que pueden actualizarse manualmente o conectarse a APIs cuando estén disponibles.
 */

const fs = require('fs');

// ============================================
// CONFIGURACIÓN DE APIs
// ============================================

// Yahoo Finance API (gratuita, no requiere key)
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';

// Mapeo de commodities CBOT a símbolos de Yahoo Finance
const CBOT_SYMBOLS = {
  'Maíz': 'ZC=F',
  'Trigo SRW': 'ZW=F',
  'Trigo HRW': 'KE=F',
  'Soya': 'ZS=F',
  'Aceite de Soya': 'ZL=F',
  'Harina de Soya': 'ZM=F',
  'Ganado Vivo': 'LE=F',
  'Ganado Alimentado': 'GF=F',
  'Cerdo Magro': 'HE=F',
  'Arroz': 'ZR=F',
  'Avena': 'ZO=F',
  'Algodón': 'CT=F',
  'Azúcar': 'SB=F',
  'Café': 'KC=F',
  'Cacao': 'CC=F',
  'Jugo de Naranja': 'OJ=F',
  'Canola': 'RS=F',
  'Leche Clase III': 'DC=F'
};

// ============================================
// FUNCIONES DE OBTENCIÓN DE DATOS
// ============================================

async function fetchYahooPrice(symbol) {
  try {
    const fetch = (await import('node-fetch')).default;
    const url = `${YAHOO_BASE}${symbol}?interval=1d&range=5d`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!res.ok) {
      console.warn(`  ⚠ Yahoo Finance respondió ${res.status} para ${symbol}`);
      return null;
    }

    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const closes = result.indicators?.quote?.[0]?.close?.filter(c => c != null);

    if (!closes || closes.length < 2) return null;

    const current = closes[closes.length - 1];
    const previous = closes[closes.length - 2];
    const change = current - previous;
    const changePct = ((change / previous) * 100);

    return {
      price: current.toFixed(2),
      change: (change >= 0 ? '+' : '') + change.toFixed(2),
      changePct: (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%',
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
    };
  } catch (err) {
    console.warn(`  ⚠ Error fetching ${symbol}: ${err.message}`);
    return null;
  }
}

// ============================================
// ACTUALIZACIÓN DEL HTML
// ============================================

async function updateDashboard() {
  console.log('🐂 R4P MX - Actualizando Tablero de Commodities...\n');

  // Leer el HTML actual
  const htmlPath = './index.html';
  let html = fs.readFileSync(htmlPath, 'utf-8');

  // Obtener timestamp
  const now = new Date();
  const timestamp = now.toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });

  console.log(`📅 Fecha/hora: ${timestamp}\n`);

  // ---- ACTUALIZAR PRECIOS CBOT ----
  console.log('📊 Obteniendo precios CBOT/CME...');

  const updatedPrices = {};
  for (const [name, symbol] of Object.entries(CBOT_SYMBOLS)) {
    process.stdout.write(`  → ${name} (${symbol})... `);
    const data = await fetchYahooPrice(symbol);
    if (data) {
      updatedPrices[name] = data;
      console.log(`${data.price} (${data.changePct})`);
    } else {
      console.log('sin datos');
    }
    // Pequeña pausa para no saturar la API
    await new Promise(r => setTimeout(r, 500));
  }

  // Actualizar el array referencePrices en el HTML
  if (Object.keys(updatedPrices).length > 0) {
    // Buscar y reemplazar los precios en el array referencePrices
    const priceRegex = /const referencePrices\s*=\s*\{[^}]+\}/s;
    const priceMatch = html.match(priceRegex);

    if (priceMatch) {
      // Construir nuevo objeto de precios manteniendo los que no se actualizaron
      let newPrices = 'const referencePrices = {\n';

      // Extraer precios existentes
      const existingPrices = {};
      const entryRegex = /'([^']+)':\s*\{([^}]+)\}/g;
      let m;
      while ((m = entryRegex.exec(priceMatch[0])) !== null) {
        existingPrices[m[1]] = m[2];
      }

      // Merge: usar actualizado si existe, sino mantener existente
      const allKeys = new Set([...Object.keys(existingPrices), ...Object.keys(updatedPrices)]);
      const entries = [];

      for (const key of allKeys) {
        if (updatedPrices[key]) {
          const d = updatedPrices[key];
          entries.push(`    '${key}': { price: '${d.price}', change: '${d.change}', changePct: '${d.changePct}' }`);
        } else if (existingPrices[key]) {
          entries.push(`    '${key}': {${existingPrices[key]}}`);
        }
      }

      newPrices += entries.join(',\n') + '\n  }';
      html = html.replace(priceRegex, newPrices);
      console.log(`\n✅ ${Object.keys(updatedPrices).length} precios CBOT actualizados`);
    }
  }

  // ---- ACTUALIZAR TIMESTAMP ----
  const tsRegex = /Última actualización:[^<]*/;
  html = html.replace(tsRegex, `Última actualización: ${timestamp}`);

  // También actualizar el meta tag de fecha si existe
  const dateMetaRegex = /data-updated="[^"]*"/;
  html = html.replace(dateMetaRegex, `data-updated="${now.toISOString()}"`);

  // ---- GUARDAR ----
  fs.writeFileSync(htmlPath, html, 'utf-8');
  console.log('\n💾 Dashboard guardado exitosamente');
  console.log('🌐 Los cambios se publicarán automáticamente en GitHub Pages\n');
}

// ============================================
// EJECUTAR
// ============================================
updateDashboard().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
