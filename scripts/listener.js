import EventSource from 'eventsource';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
};

const STREAM_URL = 'https://stream.wikimedia.org/v2/stream/recentchange';

async function main() {
    console.log('Starting Interslavic Wiki Event Listener...');

    // Create DB connection pool
    const pool = mysql.createPool({
        ...dbConfig,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    const es = new EventSource(STREAM_URL, {
        headers: {
            'User-Agent': 'InterslavicWikiCatalogueBot/1.0 (https://github.com/l3monardo/interslavic-wiki-catalogue; gleb@example.com)'
        }
    });

    es.onopen = () => {
        console.log('Connected to Wikimedia EventStream.');
    };

    es.onerror = (err) => {
        console.error('EventStream Error:', err);
    };

    es.onmessage = async (event) => {
        const data = JSON.parse(event.data);

        // Filter for Interslavic Incubator edits
        if (data.wiki === 'incubatorwiki' && data.title && data.title.startsWith('Wp/isv/')) {
            const title = data.title;
            const cleanTitle = title.replace('Wp/isv/', '').replace(/_/g, ' ');
            const user = data.user;
            const timestamp = new Date(data.timestamp * 1000).toISOString();
            const monthKey = timestamp.substring(0, 7); // YYYY-MM
            const type = data.type; // 'edit', 'new', etc.
            const sizeNew = data.length?.new || 0;
            const sizeOld = data.length?.old || 0;
            const sizeDiff = sizeNew - sizeOld;

            // Skip bot edits if preferred, though usually we want to see everything 
            // that affects the catalogue.
            const isBot = data.bot || user.toLowerCase().includes('bot');
            if (isBot) return;

            console.log(`[${timestamp}] New ${type} by ${user} on ${title} (${sizeDiff > 0 ? '+' : ''}${sizeDiff} bytes)`);

            try {
                const connection = await pool.getConnection();
                await connection.beginTransaction();

                try {
                    // 1. Update User Stats
                    const isNewArticle = type === 'new' && data.namespace === 0;
                    await connection.execute(
                        `INSERT INTO users (username, edits, articles_created, pages_created, volume_added)
                     VALUES (?, 1, ?, 1, ?)
                     ON DUPLICATE KEY UPDATE 
                     edits = edits + 1, 
                     articles_created = articles_created + ?, 
                     pages_created = pages_created + 1, 
                     volume_added = volume_added + ?`,
                        [user, isNewArticle ? 1 : 0, Math.max(0, sizeDiff), isNewArticle ? 1 : 0, Math.max(0, sizeDiff)]
                    );

                    // 2. Update Article Info
                    await connection.execute(
                        `INSERT INTO articles (title, author, size, created_date, last_modified_date)
                     VALUES (?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE 
                     size = ?, 
                     last_modified_date = ?`,
                        [cleanTitle, user, sizeNew, timestamp, timestamp, sizeNew, timestamp]
                    );

                    // 3. Update Calendar Months
                    // We need to fetch the current active_users JSON to append to it
                    const [rows] = await connection.execute(
                        'SELECT active_users FROM calendar_months WHERE month_year = ?',
                        [monthKey]
                    );

                    let activeUsers = [];
                    if (rows.length > 0 && rows[0].active_users) {
                        activeUsers = typeof rows[0].active_users === 'string'
                            ? JSON.parse(rows[0].active_users)
                            : rows[0].active_users;
                    }

                    if (!activeUsers.includes(user)) {
                        activeUsers.push(user);
                    }

                    // Simplified active_users_10plus for the listener: 
                    // In a perfect world we'd query all edits this month, but for efficiency 
                    // in a lightweight listener we will just update the user set.
                    // The daily deep-refresh or a more complex query could refine the 10+ count.
                    // For now, we'll keep the activeUsers set updated.

                    await connection.execute(
                        `INSERT INTO calendar_months (month_year, active_users)
                     VALUES (?, ?)
                     ON DUPLICATE KEY UPDATE 
                     active_users = VALUES(active_users)`,
                        [monthKey, JSON.stringify(activeUsers)]
                    );

                    await connection.commit();
                } catch (err) {
                    await connection.rollback();
                    throw err;
                } finally {
                    connection.release();
                }
            } catch (dbErr) {
                console.error('Database Update Error:', dbErr);
            }
        }
    };
}

main().catch(err => {
    console.error('Fatal Listener Error:', err);
});
