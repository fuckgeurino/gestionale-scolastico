const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// DB SQLite
const db = new sqlite3.Database('./school.db', (err) => {
    if (err) console.error('Errore apertura DB:', err.message);
    else console.log('DB connesso');
});

// Endpoint media e voti
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

// Endpoint invio email ai genitori
app.post('/api/students/:id/send-email', (req, res) => {
    const studentId = req.params.id;
    const { subject, message } = req.body;

    db.get(
        `SELECT name, email_genitore FROM students WHERE id = ?`,
        [studentId],
        (err, student) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!student) return res.status(404).json({ error: 'Studente non trovato' });
            if (!student.email_genitore) return res.status(400).json({ error: 'Email genitore mancante' });

            const transporter = nodemailer.createTransport({
                host: "smtp.protonmail.com",
                port: 465,
                secure: true,
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            transporter.sendMail({
                from: `"Scuola" <${process.env.EMAIL_USER}>`,
                to: student.email_genitore,
                subject: subject,
                text: message
            }, (error, info) => {
                if (error) return res.status(500).json({ error: error.message });
                res.json({ success: true, info: info.response });
            });
        }
    );
});

app.listen(PORT, () => {
    console.log(`Server avviato su http://localhost:${PORT}`);
});
