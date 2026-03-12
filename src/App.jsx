import { useState, useMemo, useEffect } from 'react';
import Fuse from 'fuse.js';
import { Search, ExternalLink, BookOpen, Layers, RefreshCw, AlertCircle, TrendingUp, Moon, Sun, Activity, Clock, User as UserIcon } from 'lucide-react';
import initialArticlesData from './data/articles.json';
import StatisticsModal from './components/StatisticsModal';
import { translations } from './translations';
import './index.css';

const INTERSLAVIC_ALPHABET = [
  { id: 'A', display: 'A А', keys: ['a', 'а'] },
  { id: 'B', display: 'B Б', keys: ['b', 'б'] },
  { id: 'C', display: 'C Ц', keys: ['c', 'ц'] },
  { id: 'Č', display: 'Č Ч', keys: ['č', 'ч'] },
  { id: 'D', display: 'D Д', keys: ['d', 'д'], exclude: ['dž', 'дж'] },
  { id: 'Dž', display: 'Dž Дж', keys: ['dž', 'дж'] },
  { id: 'E', display: 'E Е', keys: ['e', 'е'] },
  { id: 'Ě', display: 'Ě Є', keys: ['ě', 'є'] },
  { id: 'F', display: 'F Ф', keys: ['f', 'ф'] },
  { id: 'G', display: 'G Г', keys: ['g', 'г'] },
  { id: 'H', display: 'H Х', keys: ['h', 'х'] },
  { id: 'I', display: 'I И', keys: ['i', 'и'] },
  { id: 'J', display: 'J Ј', keys: ['j', 'ј'] },
  { id: 'K', display: 'K К', keys: ['k', 'к'] },
  { id: 'L', display: 'L Л', keys: ['l', 'л'], exclude: ['lj'] },
  { id: 'Lj', display: 'Lj Љ', keys: ['lj', 'љ'] },
  { id: 'M', display: 'M М', keys: ['m', 'м'] },
  { id: 'N', display: 'N Н', keys: ['n', 'н'], exclude: ['nj'] },
  { id: 'Nj', display: 'Nj Њ', keys: ['nj', 'њ'] },
  { id: 'O', display: 'O О', keys: ['o', 'о'] },
  { id: 'P', display: 'P П', keys: ['p', 'п'] },
  { id: 'R', display: 'R Р', keys: ['r', 'р'] },
  { id: 'S', display: 'S С', keys: ['s', 'с'] },
  { id: 'Š', display: 'Š Ш', keys: ['š', 'ш'] },
  { id: 'T', display: 'T Т', keys: ['t', 'т'] },
  { id: 'U', display: 'U У', keys: ['u', 'у'] },
  { id: 'V', display: 'V В', keys: ['v', 'в'] },
  { id: 'Y', display: 'Y Ы', keys: ['y', 'ы'] },
  { id: 'Z', display: 'Z З', keys: ['z', 'з'] },
  { id: 'Ž', display: 'Ž Ж', keys: ['ž', 'ж'] },
];

function App() {
  const [articlesData, setArticlesData] = useState(() => {
    const cached = localStorage.getItem('cachedArticles');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error('Failed to parse cached articles', e);
      }
    }
    return initialArticlesData;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeLetter, setActiveLetter] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [showStatistics, setShowStatistics] = useState(false);
  const [calendarDataLive, setCalendarDataLive] = useState(() => {
    const cached = localStorage.getItem('cachedCalendarData');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { console.error('Failed to parse cached calendar data', e); }
    }
    return null;
  });
  const [statsDataLive, setStatsDataLive] = useState(() => {
    const cached = localStorage.getItem('cachedStatsData');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { console.error('Failed to parse cached stats data', e); }
    }
    return null;
  });
  const [lang, setLang] = useState('en');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [categorySortOrder, setCategorySortOrder] = useState('desc'); // 'desc' for most to least, 'asc' for least to most
  const [showOnlyWellWritten, setShowOnlyWellWritten] = useState(false);
  const [recentChanges, setRecentChanges] = useState([]);
  const [lastTickerUpdate, setLastTickerUpdate] = useState(null);

  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    // Initial stats fetch automatically on load
    const fetchInitialStats = async () => {
      try {
        const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost/api.php?action=getStats' : '/api.php?action=getStats';
        const response = await fetch(apiUrl);
        if (response.ok) {
          const dbData = await response.json();
          if (dbData.users && dbData.calendar) {
            setStatsDataLive(dbData.users);
            setCalendarDataLive(dbData.calendar);
            localStorage.setItem('cachedStatsData', JSON.stringify(dbData.users));
            localStorage.setItem('cachedCalendarData', JSON.stringify(dbData.calendar));
          }
        }
      } catch (err) {
        console.warn("Initial stats fetch failed:", err);
      }
    };

    fetchInitialStats();

    // Polling for recent changes every 15 seconds
    const fetchRecentChanges = async () => {
      try {
        const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost/api.php?action=getRecentChanges' : '/api.php?action=getRecentChanges';
        const response = await fetch(apiUrl);
        if (response.ok) {
          const data = await response.json();
          setRecentChanges(data);
          setLastTickerUpdate(new Date());
        }
      } catch (err) {
        console.warn("Recent changes fetch failed:", err);
      }
    };

    fetchRecentChanges();
    const interval = setInterval(fetchRecentChanges, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newMode = !prev;
      if (newMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return newMode;
    });
  };

  const t = (key) => {
    return translations[lang][key] || key;
  };

  // Compute categories and counts
  const categories = useMemo(() => {
    const catMap = new Map();

    // Default "All" category
    catMap.set('All', articlesData.length);

    articlesData.forEach(article => {
      if (article.cleanCategories && article.cleanCategories.length > 0) {
        article.cleanCategories.forEach(cat => {
          catMap.set(cat, (catMap.get(cat) || 0) + 1);
        });
      } else {
        catMap.set('Uncategorized', (catMap.get('Uncategorized') || 0) + 1);
      }
    });

    // Sort categories
    let sorted = Array.from(catMap.entries());

    // Sort logic
    sorted.sort((a, b) => {
      if (a[0] === 'All') return -1;
      if (b[0] === 'All') return 1;
      if (categorySortOrder === 'desc') {
        return b[1] - a[1];
      } else {
        return a[1] - b[1];
      }
    });

    return sorted;
  }, [articlesData, categorySortOrder]);

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    let result = categories;

    if (showOnlyWellWritten) {
      result = result.filter(([cat]) =>
        cat === 'Članky s zvězdoju' || cat === 'Članky s prověrjenym pravopisom'
      );
    }

    if (!categorySearch.trim()) return result;

    const searchLower = categorySearch.toLowerCase();
    return result.filter(([cat]) => {
      if (cat === 'All' || cat === 'Uncategorized') {
        return t(cat === 'All' ? 'allArticles' : 'uncategorized').toLowerCase().includes(searchLower) || cat.toLowerCase().includes(searchLower);
      }
      return cat.replace(/_/g, ' ').toLowerCase().includes(searchLower);
    });
  }, [categories, categorySearch, t, showOnlyWellWritten]);

  // Setup Fuse.js for search
  const fuse = useMemo(() => {
    return new Fuse(articlesData, {
      keys: ['cleanTitle'],
      threshold: 0.3,
    });
  }, [articlesData]);

  // Filter articles based on search term and category
  const filteredArticles = useMemo(() => {
    let result = articlesData;

    if (searchTerm) {
      const searchResults = fuse.search(searchTerm);
      result = searchResults.map(r => r.item);
    }

    if (activeCategory !== 'All') {
      result = result.filter(article => {
        if (activeCategory === 'Uncategorized') {
          return !article.cleanCategories || article.cleanCategories.length === 0;
        }
        return article.cleanCategories && article.cleanCategories.includes(activeCategory);
      });
    }

    if (activeLetter) {
      const letterObj = INTERSLAVIC_ALPHABET.find(l => l.id === activeLetter);
      if (letterObj) {
        result = result.filter(article => {
          const t = article.cleanTitle.toLowerCase();
          const startsWithInclude = letterObj.keys.some(k => t.startsWith(k));
          const startsWithExclude = letterObj.exclude ? letterObj.exclude.some(ek => t.startsWith(ek)) : false;
          return startsWithInclude && !startsWithExclude;
        });
      }
    }

    // Sort alphabetically by cleanTitle if no search term, otherwise keep Fuse relevance sort
    if (!searchTerm) {
      result = [...result].sort((a, b) => a.cleanTitle.localeCompare(b.cleanTitle));
    }

    return result;
  }, [searchTerm, activeCategory, activeLetter, fuse, articlesData]);

  // The heavy client-side stats calculator has been removed in favor of a real-time PHP API.

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshStatus('Fetching article list...');

    try {
      const API_URL = 'https://incubator.wikimedia.org/w/api.php';
      let pages = [];
      let apcontinue = null;

      while (true) {
        // ... (API fetch logic remains completely unchanged, removing from replace block purely for mapping safety)
        const url = new URL(API_URL);
        url.searchParams.set('action', 'query');
        url.searchParams.set('list', 'allpages');
        url.searchParams.set('apprefix', 'Wp/isv/');
        url.searchParams.set('apnamespace', '0');
        url.searchParams.set('aplimit', '500');
        url.searchParams.set('format', 'json');
        url.searchParams.set('origin', '*'); // required for CORS
        if (apcontinue) {
          url.searchParams.set('apcontinue', apcontinue);
        }

        const res = await fetch(url.toString()); // continue logic unchanged
        const data = await res.json();

        if (data.error) throw new Error(data.error.info || 'API Error');

        if (data.query && data.query.allpages) {
          pages.push(...data.query.allpages);
        }

        if (data.continue && data.continue.apcontinue) {
          apcontinue = data.continue.apcontinue;
        } else {
          break;
        }
      }

      setRefreshStatus(`Fetching categories for ${pages.length} articles...`);
      const chunkSize = 50;

      for (let i = 0; i < pages.length; i += chunkSize) {
        setRefreshStatus(`Processing categories: ${Math.min(i + chunkSize, pages.length)} / ${pages.length}`);
        const chunk = pages.slice(i, i + chunkSize);
        const titles = chunk.map(p => p.title).join('|');

        const url = new URL(API_URL);
        url.searchParams.set('action', 'query');
        url.searchParams.set('prop', 'categories|info');
        url.searchParams.set('titles', titles);
        url.searchParams.set('cllimit', 'max');
        url.searchParams.set('format', 'json');
        url.searchParams.set('origin', '*');

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

        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Fetch revisions for user stats and calendar data
      setRefreshStatus('Fetching revisions for user stats and calendar...');
      const pagesForStats = pages.map(p => ({ ...p, ns: 0 })); // All pages here are namespace 0
      const { statsArray, formattedCalendar } = await fetchUserAndCalendarStats(pagesForStats);

      setStatsDataLive(statsArray);
      setCalendarDataLive(formattedCalendar);
      pages.forEach(p => {
        p.cleanTitle = p.title.replace('Wp/isv/', '');
        p.cleanCategories = (p.categories || []).map(cat => {
          return cat.replace(/^Category:(Wp\/isv\/)?/, '');
        }).filter(c => !c.match(/incubator/i) && !c.match(/articles/i));
      });

      const validPages = pages.filter(p => !p.cleanTitle.includes('O_Wikipediji') && !p.cleanTitle.includes('Glavna_stranica'));

      setArticlesData(validPages);
      try {
        localStorage.setItem('cachedArticles', JSON.stringify(validPages));
      } catch (e) {
        console.error('Failed to cache articles data', e);
      }

      setRefreshStatus('Fetching real-time statistics...');

      try {
        const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost/api.php?action=getStats' : '/api.php?action=getStats';
        const response = await fetch(apiUrl);
        if (response.ok) {
          const dbData = await response.json();
          if (dbData.users && dbData.calendar) {
            setStatsDataLive(dbData.users);
            setCalendarDataLive(dbData.calendar);
            localStorage.setItem('cachedStatsData', JSON.stringify(dbData.users));
            localStorage.setItem('cachedCalendarData', JSON.stringify(dbData.calendar));
          }
        }
      } catch (err) {
        console.warn("Could not fetch API stats (are you running locally without PHP?)", err);
      }

      setRefreshStatus('');
    } catch (e) {
      console.error(e);
      setRefreshStatus(t('errorRefreshing'));
      setTimeout(() => setRefreshStatus(''), 3000);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (showStatistics) {
    return <StatisticsModal onClose={() => setShowStatistics(false)} t={t} articlesData={articlesData} calendarDataLive={calendarDataLive} statsDataLive={statsDataLive} />;
  }

  return (
    <div className="app-container">
      <header className="header" style={{ position: 'relative' }}>
        <div className="header-top-row">
          <div className="language-toggle">
            <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>English</button>
            <button className={`lang-btn ${lang === 'isv-lat' ? 'active' : ''}`} onClick={() => setLang('isv-lat')}>Medžuslovjansky</button>
            <button className={`lang-btn ${lang === 'isv-cyr' ? 'active' : ''}`} onClick={() => setLang('isv-cyr')}>Меджусловјанскы</button>

            <button className="lang-btn theme-toggle" onClick={toggleTheme} style={{ marginLeft: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Toggle Light/Dark Theme">
              {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
          <button
            className="needed-articles-link"
            onClick={() => setSelectedArticle({
              title: "Wp/isv/Incubator:Članky,_ktore_trěba_imati_v_enciklopediji",
              cleanTitle: "Članky, koje jest potrěbno napisati"
            })}
          >
            <AlertCircle size={14} />
            <span>{t('neededArticles')}</span>
          </button>
        </div>

        <h1>{t('wikiTitle')}</h1>
        <p>{t('wikiSubtitle')}</p>
        <div className="header-actions">
          <button
            className={`refresh-btn ${isRefreshing ? 'refreshing' : ''}`}
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
            {isRefreshing ? refreshStatus || t('refreshing') : t('refreshList')}
          </button>
          <button
            className="refresh-btn nav-btn"
            onClick={() => setShowStatistics(true)}
          >
            <TrendingUp size={16} /> {t('statistics')}
          </button>
        </div>
      </header>

      {/* Modern Search Bar */}
      <div className="search-container">
        <div className="search-wrapper">
          <Search className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder={t('searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Alphabet Filter Bar */}
      <div className="alphabet-container fade-in">
        <button
          className={`alphabet-btn ${activeLetter === null ? 'active' : ''}`}
          onClick={() => setActiveLetter(null)}
        >
          All
        </button>
        {INTERSLAVIC_ALPHABET.map(letter => (
          <button
            key={letter.id}
            className={`alphabet-btn ${activeLetter === letter.id ? 'active' : ''}`}
            onClick={() => setActiveLetter(letter.id)}
          >
            {letter.display}
          </button>
        ))}
      </div>

      {selectedArticle ? (
        <div className="article-view-container fade-in">
          <div className="article-view-header">
            <button className="nav-btn back-btn" onClick={() => setSelectedArticle(null)}>
              ← {t('backToSearch')}
            </button>
            <div className="article-view-title">{selectedArticle.cleanTitle.replace(/_/g, ' ')}</div>
            <a
              href={`https://incubator.wikimedia.org/wiki/${selectedArticle.title}`}
              target="_blank"
              rel="noopener noreferrer"
              className="nav-btn external-btn"
            >
              {t('openInIncubator')} <ExternalLink size={14} style={{ display: 'inline', verticalAlign: 'middle', marginBottom: '2px' }} />
            </a>
          </div>
          <iframe
            src={`https://incubator.wikimedia.org/wiki/${selectedArticle.title}`}
            title={selectedArticle.cleanTitle}
            className="article-iframe"
          />
        </div>
      ) : (
        <main className="main-content">
          {/* Category Sidebar */}
          <aside className="category-sidebar">
            <div className="category-title fade-in">
              <Layers size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
              {t('categoriesTitle')}
            </div>

            <div className="category-controls fade-in">
              <div className="category-search">
                <Search size={14} className="category-search-icon" />
                <input
                  type="text"
                  placeholder={t('categorySearchPlaceholder')}
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  className="category-search-input"
                />
              </div>

              <div className="category-sort">
                <select
                  value={categorySortOrder}
                  onChange={(e) => setCategorySortOrder(e.target.value)}
                  className="category-sort-select"
                >
                  <option value="desc">{t('sortMost')}</option>
                  <option value="asc">{t('sortLeast')}</option>
                </select>
              </div>

              <div className="well-written-toggle">
                <label className="well-written-label">
                  <input
                    type="checkbox"
                    checked={showOnlyWellWritten}
                    onChange={(e) => {
                      setShowOnlyWellWritten(e.target.checked);
                      if (e.target.checked) {
                        setActiveCategory('All');
                      }
                    }}
                  />
                  <span>🌟 {t('wellWritten')}</span>
                </label>
              </div>
            </div>

            <div className="category-list">
              {filteredCategories.map(([cat, count], index) => (
                <button
                  key={cat}
                  className={`category-pill fade-in ${activeCategory === cat ? 'active' : ''}`}
                  style={{ animationDelay: `${index * 0.03}s` }}
                  onClick={() => setActiveCategory(cat)}
                >
                  <span>{cat === 'All' ? t('allArticles') : cat === 'Uncategorized' ? t('uncategorized') : cat.replace(/_/g, ' ')}</span>
                  <span className="count">{count}</span>
                </button>
              ))}
            </div>
          </aside>

          {/* Article Grid Layout */}
          <section className="article-grid-container fade-in">
            <LiveActivity changes={recentChanges} />
            <div className="grid-header">
              <h2 className="grid-title">
                {activeCategory === 'All' ? t('allArticles') : activeCategory === 'Uncategorized' ? t('uncategorized') : activeCategory.replace(/_/g, ' ')}
              </h2>
              <span className="article-count-label">
                {filteredArticles.length} {filteredArticles.length === 1 ? t('articleFound') : t('articlesFound')}
              </span>
            </div>

            {filteredArticles.length > 0 ? (
              <div className="article-grid">
                {filteredArticles.map((article, index) => (
                  <a
                    href={`https://incubator.wikimedia.org/wiki/${article.title}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="article-card"
                    key={article.pageid}
                    style={{ animation: `fadeInDown 0.5s ease-out ${index * 0.02}s both` }}
                    onClick={(e) => {
                      e.preventDefault();
                      setSelectedArticle(article);
                    }}
                  >
                    <ExternalLink className="external-link-icon" size={20} />
                    <h3 className="article-title">{article.cleanTitle.replace(/_/g, ' ')}</h3>

                    <div className="card-categories">
                      {article.cleanCategories && article.cleanCategories.slice(0, 3).map(cat => (
                        <span className="card-category-tag" key={cat}>
                          {cat.replace(/_/g, ' ')}
                        </span>
                      ))}
                      {(!article.cleanCategories || article.cleanCategories.length === 0) && (
                        <span className="card-category-tag" style={{ color: 'var(--text-muted)', background: 'var(--card-border)' }}>
                          {t('uncategorized')}
                        </span>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <BookOpen className="empty-state-icon" />
                <h3>{t('noArticlesFound')}</h3>
                <p>{t('noArticlesDesc')}</p>
              </div>
            )}
          </section>
        </main>
      )}
    </div>
  );
}

const LiveActivity = ({ changes }) => {
  if (!changes || changes.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-blue-100 dark:border-gray-700 overflow-hidden mb-8">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 flex items-center justify-between">
        <h3 className="text-white font-bold flex items-center gap-2">
          <Activity size={18} className="animate-pulse" />
          Live activity (Incubator)
        </h3>
        <span className="text-blue-100 text-xs font-medium px-2 py-1 bg-white/10 rounded-full backdrop-blur-sm">
          Real-time updates
        </span>
      </div>
      <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
        {changes.map((change, idx) => (
          <div key={idx} className="px-6 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors group">
            <div className="flex flex-col min-w-0 pr-4">
              <span className="text-gray-900 dark:text-gray-100 font-medium truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {change.title}
              </span>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <UserIcon size={12} />
                  {change.user}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                  <Clock size={12} />
                  {new Date(change.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${change.sizeDiff > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                change.sizeDiff < 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                  'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                {change.sizeDiff > 0 ? '+' : ''}{change.sizeDiff}
              </span>
              <a
                href={`https://incubator.wikimedia.org/wiki/Wp/isv/${change.title.replace(/ /g, '_')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all opacity-0 group-hover:opacity-100"
              >
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
