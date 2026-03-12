import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
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

async function createTables(connection) {
    console.log('Creating tables if they do not exist...');

    await connection.execute(`
    CREATE TABLE IF NOT EXISTS users (
      username VARCHAR(255) PRIMARY KEY,
      edits INT DEFAULT 0,
      articles_created INT DEFAULT 0,
      pages_created INT DEFAULT 0,
      volume_added BIGINT DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

    await connection.execute(`
    CREATE TABLE IF NOT EXISTS calendar_months (
      month_year VARCHAR(7) PRIMARY KEY,
      active_users JSON,
      active_users_10plus INT DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

    await connection.execute(`
    CREATE TABLE IF NOT EXISTS articles (
      title VARCHAR(255) PRIMARY KEY,
      author VARCHAR(255),
      size INT DEFAULT 0,
      created_date VARCHAR(25),
      last_modified_date VARCHAR(25)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

    console.log('Tables created or already exist.');
}

async function importStats(connection) {
    console.log('Importing user stats...');
    const statsPath = path.join(__dirname, '..', 'src', 'data', 'stats.json');
    if (!fs.existsSync(statsPath)) {
        console.log('No stats.json found, skipping user import.');
        return;
    }

    const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
    for (const user of stats) {
        await connection.execute(
            `INSERT INTO users (username, edits, articles_created, pages_created, volume_added)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
       edits=VALUES(edits), articles_created=VALUES(articles_created), pages_created=VALUES(pages_created), volume_added=VALUES(volume_added)`,
            [user.username, user.edits || 0, user.articlesCreated || 0, user.pagesCreated || 0, user.volumeAdded || 0]
        );
    }
    console.log(`Imported ${stats.length} users.`);
}

async function importCalendar(connection) {
    console.log('Importing calendar stats and articles...');
    const calendarPath = path.join(__dirname, '..', 'src', 'data', 'calendar.json');
    if (!fs.existsSync(calendarPath)) {
        console.log('No calendar.json found, skipping calendar import.');
        return;
    }

    const calendar = JSON.parse(fs.readFileSync(calendarPath, 'utf8'));
    for (const month of calendar) {
        const activeUsersJson = JSON.stringify(month.activeUsers || []);
        await connection.execute(
            `INSERT INTO calendar_months (month_year, active_users, active_users_10plus)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE 
       active_users=VALUES(active_users), active_users_10plus=VALUES(active_users_10plus)`,
            [month.month, activeUsersJson, month.activeUsers10Plus || 0]
        );

        // Import articles from the newArticles array in the calendar
        if (month.newArticles && month.newArticles.length > 0) {
            for (const article of month.newArticles) {
                await connection.execute(
                    `INSERT INTO articles (title, author, size, created_date, last_modified_date)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
           size=VALUES(size), last_modified_date=VALUES(last_modified_date)`,
                    [article.title, article.author, article.size || 0, article.timestamp, article.timestamp]
                );
            }
        }
    }
    console.log(`Imported calendar data for ${calendar.length} months.`);
}

async function main() {
    if (!dbConfig.host || !dbConfig.user || !dbConfig.password || !dbConfig.database) {
        console.error("Missing required DB environment variables (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME).");
        process.exit(1);
    }
    console.log(`Connecting to ${dbConfig.host} as ${dbConfig.user}...`);
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to the database.');

        await createTables(connection);
        await importStats(connection);
        await importCalendar(connection);

        console.log('Historical import complete!');
    } catch (error) {
        console.error('Database migration failed:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

main();
