// api/fetch-url.js — funzione serverless Vercel.
// Recupera una pagina web e ne estrae il testo principale (via Readability),
// per pre-compilare la textarea di valutazione. Il risultato torna al
// frontend perché l'utente lo controlli — non viene mai inviato al modello
// direttamente da qui.

import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import dns from 'node:dns/promises';
import net from 'node:net';

const FETCH_TIMEOUT_MS = 10000;
const MAX_RESPONSE_CHARS = 5 * 1024 * 1024; // 5MB di HTML, prima dell'estrazione
const MAX_EXTRACTED_CHARS = 20000; // stesso limite di api/evaluate.js

function isPrivateOrReservedIP(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // include il metadata endpoint cloud
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
    return false;
  }
  return true; // formato non riconosciuto: blocca per sicurezza
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Metodo non consentito' });
    return;
  }

  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'URL mancante' });
    return;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    res.status(400).json({ error: 'URL non valido' });
    return;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    res.status(400).json({ error: 'Sono supportati solo link http/https' });
    return;
  }
  if (parsed.hostname === 'localhost' || parsed.hostname.endsWith('.local')) {
    res.status(400).json({ error: 'Questo indirizzo non è consentito' });
    return;
  }

  // Protezione SSRF di base: rifiuta indirizzi che risolvono a IP privati/interni.
  try {
    const addresses = await dns.lookup(parsed.hostname, { all: true });
    if (addresses.length === 0 || addresses.some(a => isPrivateOrReservedIP(a.address))) {
      res.status(400).json({ error: 'Questo indirizzo non è consentito' });
      return;
    }
  } catch {
    res.status(400).json({ error: 'Impossibile risolvere questo indirizzo' });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(parsed.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SlopDetectorBot/1.0; +https://slop-detector-ashy.vercel.app)'
      }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      res.status(502).json({ error: 'La pagina ha risposto con un errore (' + response.status + ')' });
      return;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      res.status(415).json({ error: 'Il link non porta a una pagina HTML leggibile' });
      return;
    }

    const html = await response.text();
    if (html.length > MAX_RESPONSE_CHARS) {
      res.status(413).json({ error: 'Pagina troppo grande da elaborare' });
      return;
    }

    const { document } = parseHTML(html);
    const article = new Readability(document).parse();

    if (!article || !article.textContent || article.textContent.trim().length < 200) {
      res.status(422).json({ error: 'Non sono riuscito a estrarre il testo principale da questa pagina — copialo e incollalo manualmente.' });
      return;
    }

    let text = article.textContent.trim().replace(/\n{3,}/g, '\n\n');
    if (text.length > MAX_EXTRACTED_CHARS) {
      text = text.slice(0, MAX_EXTRACTED_CHARS);
    }

    res.status(200).json({ title: article.title || '', text });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      res.status(504).json({ error: 'La pagina ha impiegato troppo tempo a rispondere' });
      return;
    }
    res.status(500).json({ error: err.message || 'Errore nel recupero della pagina' });
  }
}
