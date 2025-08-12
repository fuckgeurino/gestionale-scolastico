const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = process.env.PORT || 3000;

// Connessione al database (file 'school.db' nella root del progetto)
const db = new sqlite3.Database('./school.db', (err) => {
    if (err) {
        console.error('Errore nella connessione al database:', err.message);
    } else {
        console.log('Connessione al database riuscita');
    }
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// === NUOVO ENDPOINT PER MEDIA E SITUAZIONE STUDENTE ===
app.get('/api/students/:id/summary', (req, res) => {
    const studentId = req.params.id;

    db.get(
        `SELECT AVG(grade) AS average FROM grades WHERE student_id = ?`,
        [studentId],
        (err, avgRow) => {
            if (err) return res.status(500).json({ error: err.message });

            db.all(
                `SELECT subject, grade FROM grades WHERE student_id = ?`,
                [studentId],
                (err, grades) => {
                    if (err) return res.status(500).json({ error: err.message });

                    res.json({
                        average: avgRow.average,
                        grades: grades
                    });
                }
            );
        }
    );
});

// Esempio home route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Avvio server
app.listen(PORT, () => {
    console.log(`Server avviato su http://localhost:${PORT}`);
});
