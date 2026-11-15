/*
 * Cálculo nocturno de oscilaciones.
 * Revisa los objetos caros y líquidos del Grand Exchange, analiza 90 días de precios
 * de cada uno y escribe oscilaciones.json para que la página cargue al instante.
 *
 * Uso: node scan.js
 * Variables opcionales: API_BASE, MIN_PRICE (gp), MIN_UNITS (unidades al día), MAX_ITEMS.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const Swing = require('./swing.js');

const API = process.env.API_BASE || 'https://prices.runescape.wiki/api/v1/osrs';
const UA = 'varrock-desk nightly scan (+https://github.com/Manuel-vibecoder/varrock-desk)';
const MIN_PRICE = Number(process.env.MIN_PRICE || 1e6);
const MIN_UNITS = Number(process.env.MIN_UNITS || 3);
const MAX_ITEMS = Number(process.env.MAX_ITEMS || 450);
const PAUSE_MS = Number(process.env.PAUSE_MS || 300);
const OUT = path.join(__dirname, 'oscilaciones.json');

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJSON(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.status === 429) { await sleep(5000 * i); continue; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      if (i === tries) throw e;
      await sleep(2000 * i);
    }
  }
}

const TAX_EXEMPT = new Set(['old school bond']);
const taxFor = name => price => TAX_EXEMPT.has(name.toLowerCase()) ? 0 : Math.min(5e6, Math.floor(price * 0.02));
const round = (x, d) => x == null ? null : Math.round(x * 10 ** d) / 10 ** d;

async function main() {
  const t0 = Date.now();
  const [mapping, d24] = await Promise.all([getJSON(API + '/mapping'), getJSON(API + '/24h')]);
  const day = d24.data || {};
  const cands = [];
  for (const it of mapping) {
    const d = day[it.id];
    if (!d || !d.avgHighPrice || !d.avgLowPrice) continue;
    const mid = (d.avgHighPrice + d.avgLowPrice) / 2;
    const units = (d.highPriceVolume || 0) + (d.lowPriceVolume || 0);
    if (mid < MIN_PRICE || units < MIN_UNITS) continue;
    cands.push({ it, value: mid * units });
  }
  cands.sort((a, b) => b.value - a.value);
  const list = cands.slice(0, MAX_ITEMS);
  console.log(`Candidatos: ${cands.length}; se analizan ${list.length}`);

  const items = [];
  let failed = 0;
  for (const { it } of list) {
    try {
      const j = await getJSON(`${API}/timeseries?timestep=6h&id=${it.id}`);
      const s = Swing.analyze(Swing.fromApi(j.data), { now: Date.now(), tax: taxFor(it.name) });
      if (s) items.push({
        id: it.id, name: it.name,
        floor: Math.round(s.floor), ceil: Math.round(s.ceil), net: Math.round(s.net), netRoi: round(s.netRoi, 4),
        trips: s.trips, entries: s.entries, medianDays: round(s.medianDays, 1), worstDrop: round(s.worstDrop, 4),
        openDays: round(s.openDays, 1), trend30: round(s.trend30, 4), dailyUnits: round(s.dailyUnits, 1),
        candidate: s.candidate, score: round(s.score, 5)
      });
    } catch (e) {
      failed++;
      console.warn(`Sin datos para ${it.name}: ${e.message}`);
    }
    await sleep(PAUSE_MS);
  }
  items.sort((a, b) => b.score - a.score);
  const out = {
    generatedAt: new Date().toISOString(), windowDays: 90, minPrice: MIN_PRICE,
    analyzed: list.length, failed, candidates: items.filter(x => x.candidate).length, items
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`Listo en ${Math.round((Date.now() - t0) / 1000)} s: ${items.length} analizados, ${out.candidates} candidatos, ${failed} con error.`);
  if (list.length && failed > list.length / 2) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
