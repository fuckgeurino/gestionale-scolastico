const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Percorso database (nella cartella locale del progetto)
const DB_FILE = path.join(__dirname, 'data', 'db.sqlite');

// Crea la cartella ./data se non esiste
const dbDir = path.dirname(DB_FILE);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Connessione al database
const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) {
    console.error('Errore apertura DB:', err.message);
    process.exit(1);
  }
  console.log('Database SQLite connesso.');
});

// Middleware
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Gestionale scolastico attivo 🚀');
});

// Avvio server
app.listen(port, () => {
  console.log(`Server in ascolto su http://localhost:${port}`);
});
