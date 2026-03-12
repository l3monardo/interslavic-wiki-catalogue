import fs from 'fs';
import path from 'path';

const API_URL = 'https://incubator.wikimedia.org/w/api.php';
const NAMESPACES = [0, 10, 14, 828]; // Main, Template, Category, Module

const fetchWithRetry = async (url, options = {}, retries = 5, backoff = 2000) => {
    const headers = {
        'User-Agent': 'InterslavicWikiCatalogueBot/1.0 (https://github.com/l3monardo/interslavic-wiki-catalogue; gleb@example.com)',
        ...options.headers
    };

    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, { ...options, headers });

            if (res.status === 429 || res.status >= 500) {
                throw new Error(`HTTP Error ${res.status}`);
            }

            const text = await res.text();
            try {
                return JSON.parse(text);
            } catch (parseError) {
                if (text.trim().startsWith('<!DOCTYPE')) {
                    throw new Error('Received HTML instead of JSON (Rate limit or API error)');
                }
                throw parseError;
            }
        } catch (err) {
            if (i === retries - 1) throw err;
            const wait = backoff * Math.pow(2, i);
            console.warn(`Attempt ${i + 1} failed for ${url}. Retrying in ${wait}ms... Error: ${err.message}`);
            await new Promise(r => setTimeout(r, wait));
        }
    }
};

async function fetchAllPages() {
    let allPages = [];

    for (const ns of NAMESPACES) {
        let apcontinue = null;
        console.log(`Fetching pages for namespace ${ns}...`);
        while (true) {
            const url = new URL(API_URL);
            url.searchParams.set('action', 'query');
            url.searchParams.set('list', 'allpages');
            url.searchParams.set('apprefix', 'Wp/isv/');
            url.searchParams.set('apnamespace', ns.toString());
            url.searchParams.set('aplimit', '500');
            url.searchParams.set('format', 'json');
            if (apcontinue) {
                url.searchParams.set('apcontinue', apcontinue);
            }

            const data = await fetchWithRetry(url.toString());

            if (data.error) {
                console.error('API Error:', data.error);
                break;
            }

            if (data.query && data.query.allpages) {
                allPages.push(...data.query.allpages.map(p => ({ ...p, ns })));
            }

            if (data.continue && data.continue.apcontinue) {
                apcontinue = data.continue.apcontinue;
            } else {
                break;
            }
        }
    }
    return allPages;
}

async function fetchStatsForPages(pages) {
    const userStats = {};
    const calendarStats = {}; // YYYY-MM -> { activeUsers: Set(), newArticles: [] }

    const initUser = (user) => {
        if (!userStats[user]) {
            userStats[user] = { edits: 0, articlesCreated: 0, pagesCreated: 0, volumeAdded: 0 };
        }
    };

    const concurrency = 2; // Reduced concurrency to be gentler on the API
    let currentIndex = 0;

    const worker = async () => {
        while (currentIndex < pages.length) {
            const index = currentIndex++;
            const page = pages[index];

            let rvcontinue = null;
            let previousSize = 0;
            let isFirstRevOfPage = true;

            while (true) {
                const url = new URL(API_URL);
                url.searchParams.set('action', 'query');
                url.searchParams.set('prop', 'revisions');
                url.searchParams.set('titles', page.title);
                url.searchParams.set('rvprop', 'user|size|timestamp');
                url.searchParams.set('rvlimit', 'max');
                url.searchParams.set('rvdir', 'newer'); // Oldest first
                url.searchParams.set('format', 'json');
                if (rvcontinue) url.searchParams.set('rvcontinue', rvcontinue);

                try {
                    const data = await fetchWithRetry(url.toString());
                    // Small delay between requests to be nice
                    await new Promise(r => setTimeout(r, 100));

                    if (data.query && data.query.pages) {
                        const pageData = Object.values(data.query.pages)[0];
                        if (pageData.revisions) {
                            for (const rev of pageData.revisions) {
                                const user = rev.user || 'Unknown';
                                initUser(user);

                                userStats[user].edits += 1;

                                const currentSize = rev.size || 0;
                                const sizeDiff = currentSize - previousSize;
                                if (sizeDiff > 0) {
                                    userStats[user].volumeAdded += sizeDiff;
                                }
                                previousSize = currentSize;

                                // Calendar tracking
                                const timestamp = rev.timestamp;
                                if (timestamp) {
                                    const dateObj = new Date(timestamp);
                                    const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

                                    if (!calendarStats[monthKey]) {
                                        calendarStats[monthKey] = {
                                            activeUsers: new Set(),
                                            userEdits: {},
                                            newArticles: []
                                        };
                                    }

                                    calendarStats[monthKey].activeUsers.add(user);
                                    calendarStats[monthKey].userEdits[user] = (calendarStats[monthKey].userEdits[user] || 0) + 1;

                                    if (isFirstRevOfPage && page.ns === 0) {
                                        let cleanTitle = page.title.replace('Wp/isv/', '').replace(/_/g, ' ');
                                        calendarStats[monthKey].newArticles.push({
                                            title: cleanTitle,
                                            author: user,
                                            size: currentSize,
                                            timestamp: timestamp
                                        });
                                    }
                                }

                                if (isFirstRevOfPage) {
                                    isFirstRevOfPage = false;
                                    if (page.ns === 0) {
                                        userStats[user].articlesCreated += 1;
                                    }
                                    userStats[user].pagesCreated += 1;
                                }
                            }
                        }
                    }

                    if (data.continue && data.continue.rvcontinue) {
                        rvcontinue = data.continue.rvcontinue;
                    } else {
                        break;
                    }
                } catch (e) {
                    console.error(`Failed to fetch revisions for ${page.title}:`, e);
                    // Wait a bit and retry
                    await new Promise(r => setTimeout(r, 2000));
                }
            }

            if ((index + 1) % 100 === 0) {
                console.log(`Processed ${index + 1}/${pages.length} pages...`);
            }
        }
    };

    const workers = Array(concurrency).fill(null).map(() => worker());
    await Promise.all(workers);

    return { userStats, calendarStats };
}

async function main() {
    console.log('Fetching all pages...');
    const pages = await fetchAllPages();
    console.log(`Found ${pages.length} pages total.`);

    console.log('Fetching revisions and calculating stats...');
    const { userStats, calendarStats } = await fetchStatsForPages(pages);

    const statsArray = Object.entries(userStats)
        .map(([username, stats]) => ({
            username,
            ...stats
        }))
        .filter(u => u.username !== 'Unknown' && !u.username.includes('bot') && !u.username.includes('Bot'))
        .sort((a, b) => b.edits - a.edits);

    const dataDir = path.join(process.cwd(), 'src', 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const outputPath = path.join(dataDir, 'stats.json');
    fs.writeFileSync(outputPath, JSON.stringify(statsArray, null, 2));
    console.log(`Saved stats for ${statsArray.length} users to ${outputPath}`);

    // Process Calendar
    const formattedCalendar = Object.entries(calendarStats)
        .map(([month, data]) => {
            const validUsers = Array.from(data.activeUsers)
                .filter(u => u !== 'Unknown' && !u.includes('bot') && !u.includes('Bot'));

            let active10Plus = 0;
            validUsers.forEach(u => {
                if (data.userEdits[u] >= 10) {
                    active10Plus++;
                }
            });

            return {
                month,
                activeUsers: validUsers,
                activeUsers10Plus: active10Plus,
                newArticles: data.newArticles.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            }
        })
        .sort((a, b) => b.month.localeCompare(a.month)); // Sort descending by month

    const calendarOutputPath = path.join(dataDir, 'calendar.json');
    fs.writeFileSync(calendarOutputPath, JSON.stringify(formattedCalendar, null, 2));
    console.log(`Saved calendar stats for ${formattedCalendar.length} months to ${calendarOutputPath}`);
}

main().catch(console.error);
