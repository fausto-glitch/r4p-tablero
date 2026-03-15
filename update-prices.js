/**
 * update-prices.js
 * Script para actualizar los precios del tablero R4P MX
 * Se ejecuta vía GitHub Actions diariamente
 *
 * Usa Node.js built-in https (sin dependencias externas)
 */

const fs = require('fs');
const https = require('https');

// ============================================
// CONFIGURACIÓN
// ============================================

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';

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
// FUNCIONES
// ============================================

function fetchYahooPrice(symbol) {
  return new Promise((resolve) => {
    const url = `${YAHOO_BASE}${symbol}?interval=1d&range=5d`;

    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    }, (res) => {
      if (res.statusCode !== 200) {
        console.warn(`  ⚠ Yahoo respondió ${res.statusCode} para ${symbol}`);
        res.resume();
        return resolve(null);
      }

      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          const result = data.chart?.result?.[0];
          if (!result) return resolve(null);

          const closes = result.indicators?.quote?.[0]?.close?.filter(c => c != null);
          if (!closes || closes.length < 2) return resolve(null);

          const current = closes[closes.length - 1];
          const previous = closes[closes.length - 2];
          const change = current - previous;
          const changePct = (change / previous) * 100;

          resolve({
            price: current.toFixed(2),
            change: (change >= 0 ? '+' : '') + change.toFixed(2),
            changePct: (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%',
            direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
          });
        } catch (err) {
          console.warn(`  ⚠ Error parseando ${symbol}: ${err.message}`);
          resolve(null);
        }
      });
    }).on('error', (err) => {
      console.warn(`  ⚠ Error de red ${symbol}: ${err.message}`);
      resolve(null);
    });
  });
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ============================================
// ACTUALIZACIÓN DEL HTML
// ============================================

async function updateDashboard() {
  console.log('🐂 R4P MX - Actualizando Tablero de Commodities...\n');

  const htmlPath = './index.html';
  let html = fs.readFileSync(htmlPath, 'utf-8');

  const now = new Date();
  const timestamp = now.toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });

  console.log(`📅 Fecha/hora: ${timestamp}\n`);
  console.log('📊 Obteniendo precios CBOT/CME...');

  const updatedPrices = {};
  let successCount = 0;

  for (const [name, symbol] of Object.entries(CBOT_SYMBOLS)) {
    process.stdout.write(`  → ${name} (${symbol})... `);
    const data = await fetchYahooPrice(symbol);

    if (data) {
      updatedPrices[name] = data;
      successCount++;
      console.log(`${data.price} (${data.changePct})`);
    } else {
      console.log('sin datos');
    }

    await delay(600); // Pausa entre requests
  }

  console.log(`\n📈 ${successCount}/${Object.keys(CBOT_SYMBOLS).length} precios obtenidos`);

  // Actualizar referencePrices en el HTML
  if (successCount > 0) {
    const priceRegex = /const referencePrices\s*=\s*\{[^}]+\}/s;
    const priceMatch = html.match(priceRegex);

    if (priceMatch) {
      // Extraer precios existentes
      const existingPrices = {};
      const entryRegex = /'([^']+)':\s*\{([^}]+)\}/g;
      let m;
      while ((m = entryRegex.exec(priceMatch[0])) !== null) {
        existingPrices[m[1]] = m[2];
      }

      // Merge: actualizado si existe, sino mantener existente
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

      const newPrices = 'const referencePrices = {\n' + entries.join(',\n') + '\n  }';
      html = html.replace(priceRegex, newPrices);
      console.log(`✅ ${successCount} precios CBOT actualizados en el HTML`);
    } else {
      console.warn('⚠ No se encontró referencePrices en index.html');
    }
  }

  // Actualizar timestamp
  const tsRegex = /Última actualización:[^<]*/;
  html = html.replace(tsRegex, `Última actualización: ${timestamp}`);

  const dateMetaRegex = /data-updated="[^"]*"/;
  html = html.replace(dateMetaRegex, `data-updated="${now.toISOString()}"`);

  // Guardar
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
