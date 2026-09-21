# The Slop Detector

Trova il segnale in mezzo al rumore: uno strumento che valuta i contenuti testuali
per rilevanza e qualità, non per capire se sono stati scritti da un'AI. Demo live:
https://slop-detector-ashy.vercel.app

Struttura del progetto:

```
slop-detector/
├── index.html       # frontend statico
├── api/
│   └── evaluate.js  # funzione serverless Vercel — proxy verso Anthropic
├── package.json
├── LICENSE
└── .gitignore
```

Il frontend non chiama più direttamente `api.anthropic.com`: invia una POST a
`/api/evaluate` (stesso dominio), che è la funzione serverless in `api/evaluate.js`.
È lei ad aggiungere la chiave API e inoltrare la richiesta ad Anthropic — la chiave
non è mai visibile nel browser.

## Deploy su Vercel

1. Installa la CLI (se non l'hai già): `npm i -g vercel`
2. Dalla cartella del progetto: `vercel` (poi `vercel --prod` per il deploy definitivo)
   — oppure collega la cartella a un repo Git e importalo da vercel.com/new.
3. Imposta la variabile d'ambiente **ANTHROPIC_API_KEY** in Project Settings →
   Environment Variables, con una chiave presa da console.anthropic.com
   (account separato dall'abbonamento Claude.ai, a fatturazione a consumo).
4. Rideploya se la variabile è stata aggiunta dopo il primo deploy.

## Sviluppo locale

```bash
npm i -g vercel
vercel dev
```

`vercel dev` serve sia il frontend sia la funzione in `api/`, così il fetch a
`/api/evaluate` funziona anche in locale (serve comunque `ANTHROPIC_API_KEY` in
un file `.env.local`, non committato).

## Contribuire

Il progetto è open source (licenza MIT, vedi [LICENSE](LICENSE)) — contributi,
fork e personalizzazioni sono benvenuti.

1. Fai un fork del repository
2. Crea un branch per la tua modifica (`git checkout -b nome-modifica`)
3. Apri una Pull Request descrivendo cosa cambia e perché

Idee facili da cui partire: nuovi criteri di valutazione nel system prompt
(`SYSTEM_PROMPT` in `index.html`), nuovi tipi di riferimento nel form "Il tuo
contesto", miglioramenti all'interfaccia. Per modifiche più sostanziali al
criterio di giudizio, apri prima una issue per discuterne — è un prompt
delicato, tarato con parecchi test.

---
Collegato a Vercel per il deploy automatico ad ogni push su `main`.
