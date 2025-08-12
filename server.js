const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Percorso database
const DB_FILE = process.env.DB_FILE || '/data/db.sqlite';

// Assicurati che la cartella /data esista
const dbDir = path.dirname(DB_FILE);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Connessione al database
const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) {
    console.error('Errore apertura DB:', err.message);
    process.exit(1); // Stop se il DB non si apre
  }
  console.log('Database SQLite connesso.');
});

// Middleware e rotte
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Gestionale scolastico attivo 🚀');
});

// Avvio server
app.listen(port, () => {
  console.log(`Server in ascolto su http://localhost:${port}`);
});
