// api/evaluate.js — funzione serverless Vercel.
// Riceve la richiesta dal frontend, allega la chiave API lato server
// (mai esposta al browser), chiama Anthropic, restituisce il risultato.
//
// Su Vercel questo file va messo esattamente in /api/evaluate.js nella
// root del progetto — Vercel lo pubblica automaticamente come endpoint
// POST /api/evaluate, senza configurazione aggiuntiva.
//
// Richiede una variabile d'ambiente ANTHROPIC_API_KEY impostata nel
// progetto Vercel (Settings > Environment Variables), presa dalla
// Console Anthropic (console.anthropic.com) — è un account separato
// dall'abbonamento Claude.ai, con fatturazione a consumo.

const MAX_MESSAGE_LENGTH = 20000; // ~5000 parole, protezione minima contro input abnormi

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Metodo non consentito' });
    return;
  }

  const { system, message } = req.body || {};

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Messaggio mancante' });
    return;
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({ error: 'Testo troppo lungo' });
    return;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 4096,
        // Thinking adattivo attivo: senza uno spazio di ragionamento il
        // modello tende ad appiattire i quattro criteri su un unico giudizio
        // complessivo invece di valutarli davvero uno per uno.
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        system: system || undefined,
        messages: [{ role: 'user', content: message }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error', response.status, errText);
      res.status(response.status).json({ error: 'Errore dalla API Anthropic', detail: errText });
      return;
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    console.error('evaluate.js handler error', err);
    res.status(500).json({ error: err.message || 'Errore interno' });
  }
}
