import fs from 'fs';
import path from 'path';

const API_URL = 'https://incubator.wikimedia.org/w/api.php';

async function fetchAllPages() {
  let pages = [];
  let apcontinue = null;

  console.log('Fetching article list...');

  while (true) {
    const url = new URL(API_URL);
    url.searchParams.set('action', 'query');
    url.searchParams.set('list', 'allpages');
    url.searchParams.set('apprefix', 'Wp/isv/');
    url.searchParams.set('apnamespace', '0');
    url.searchParams.set('aplimit', '500');
    url.searchParams.set('format', 'json');
    if (apcontinue) {
      url.searchParams.set('apcontinue', apcontinue);
    }

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.error) {
      console.error('API Error:', data.error);
      break;
    }

    if (data.query && data.query.allpages) {
      pages.push(...data.query.allpages);
    }

    if (data.continue && data.continue.apcontinue) {
      apcontinue = data.continue.apcontinue;
    } else {
      break;
    }
  }

  return pages;
}

async function fetchCategoriesForPages(pages) {
  console.log('Fetching categories...');
  // Max 50 titles per query
  const chunkSize = 50;

  for (let i = 0; i < pages.length; i += chunkSize) {
    const chunk = pages.slice(i, i + chunkSize);
    const titles = chunk.map(p => p.title).join('|');

    const url = new URL(API_URL);
    url.searchParams.set('action', 'query');
    url.searchParams.set('prop', 'categories|info');
    url.searchParams.set('titles', titles);
    url.searchParams.set('cllimit', 'max');
    url.searchParams.set('format', 'json');

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.query && data.query.pages) {
      const pageMap = data.query.pages;
      Object.values(pageMap).forEach(pInfo => {
        const pageRef = pages.find(p => p.title === pInfo.title);
        if (pageRef) {
          pageRef.categories = (pInfo.categories || []).map(c => c.title);
          pageRef.size = pInfo.length || 0;
          pageRef.timestamp = pInfo.touched || new Date().toISOString();
        }
      });
    }

    // Progress indicator
    console.log(`Processed ${Math.min(i + chunkSize, pages.length)} / ${pages.length} articles`);
    // Delay slightly to be polite to Wikipedia API
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

function processCategories(pages) {
  // Clean up categories and title prefix
  pages.forEach(p => {
    // Remove "Wp/isv/" prefix from human readable title
    p.cleanTitle = p.title.replace('Wp/isv/', '');

    p.cleanCategories = (p.categories || []).map(cat => {
      // Categories look like "Category:Wp/isv/Biology" or similar.
      return cat.replace(/^Category:(Wp\/isv\/)?/, '');
    }).filter(c => !c.match(/incubator/i) && !c.match(/articles/i));
    // basic filtering to remove wiki meta-categories if any
  });
}

async function main() {
  const pages = await fetchAllPages();
  console.log(`Found ${pages.length} articles.`);

  await fetchCategoriesForPages(pages);

  processCategories(pages);

  // Filter out any pages that might just be Wp/isv/ navigation pages? Let's keep all for now.
  const validPages = pages.filter(p => !p.cleanTitle.includes('O_Wikipediji') && !p.cleanTitle.includes('Glavna_stranica'));

  // Ensure src/data exists
  const dataDir = path.join(process.cwd(), 'src', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const outputPath = path.join(dataDir, 'articles.json');
  fs.writeFileSync(outputPath, JSON.stringify(validPages, null, 2));
  console.log(`Saved ${validPages.length} articles to ${outputPath}`);
}

main().catch(console.error);
