const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./monitoring.db');

db.all('SELECT * FROM history ORDER BY rowid DESC LIMIT 10', [], (err, rows) => {
    if (err) {
        console.error('Gagal membaca data:', err.message);
    } else {
        console.log('DATA MONITORING TERAKHIR:');
        console.table(rows);

        console.log('Jumlah data:', rows.length);
    }

    db.close();
});