import { useState } from 'react';
import { ArrowLeft, TrendingUp, Users, ChevronUp, ChevronDown, FileText, Calendar, ChevronRight } from 'lucide-react';
import statsData from '../data/stats.json';
import calendarData from '../data/calendar.json';
import '../index.css';

const API_URL = 'https://incubator.wikimedia.org/w/api.php';

export default function StatisticsModal({ onClose, t, articlesData, calendarDataLive, statsDataLive }) {
    const [activeTab, setActiveTab] = useState('users'); // users or articles
    const [sortConfig, setSortConfig] = useState({ key: 'edits', direction: 'desc' });
    const [articleSortConfig, setArticleSortConfig] = useState({ key: 'timestamp', direction: 'desc' });
    const [expandedMonth, setExpandedMonth] = useState(null);

    // Choose dynamic calendar data if available; otherwise fallback to static json
    const displayedCalendarData = calendarDataLive || calendarData;

    const displayedStatsData = statsDataLive || statsData;

    const rankedStatsData = [...displayedStatsData].sort((a, b) => b.edits - a.edits).map((u, index) => ({
        ...u,
        rank: index + 1
    }));

    const sortedStats = rankedStatsData.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];

        // Handle sorting text (username)
        if (typeof valA === 'string' && typeof valB === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }

        if (valA < valB) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (valA > valB) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    const sortedArticles = [...(articlesData || [])].sort((a, b) => {
        let valA = a[articleSortConfig.key];
        let valB = b[articleSortConfig.key];

        if (articleSortConfig.key === 'cleanTitle') {
            valA = valA ? valA.toLowerCase() : '';
            valB = valB ? valB.toLowerCase() : '';
        }

        if (articleSortConfig.key === 'timestamp') {
            valA = valA ? new Date(valA).getTime() : 0;
            valB = valB ? new Date(valB).getTime() : 0;
        }

        if (valA < valB) {
            return articleSortConfig.direction === 'asc' ? -1 : 1;
        }
        if (valA > valB) {
            return articleSortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    const requestSort = (key) => {
        let direction = 'desc'; // Default to descending for stats like Edits
        if (key === 'username') direction = 'asc'; // Default alphabetical

        if (sortConfig.key === key) {
            // Toggle direction
            direction = sortConfig.direction === 'desc' ? 'asc' : 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return null;
        return sortConfig.direction === 'asc' ? <ChevronUp size={14} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: '4px' }} /> : <ChevronDown size={14} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: '4px' }} />;
    };

    const requestArticleSort = (key) => {
        let direction = 'desc';
        if (key === 'cleanTitle') direction = 'asc';
        if (articleSortConfig.key === key) {
            direction = articleSortConfig.direction === 'desc' ? 'asc' : 'desc';
        }
        setArticleSortConfig({ key, direction });
    };

    const getArticleSortIcon = (key) => {
        if (articleSortConfig.key !== key) return null;
        return articleSortConfig.direction === 'asc' ? <ChevronUp size={14} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: '4px' }} /> : <ChevronDown size={14} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: '4px' }} />;
    };

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="statistics-page fade-in">
            <div className="statistics-header">
                <button className="back-btn" onClick={onClose}>
                    <ArrowLeft size={20} /> {t('back')}
                </button>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <TrendingUp /> Statistika
                </h2>
                <div style={{ width: '120px' }}></div> {/* Spacer to keep title centered */}
            </div>

            <div className="statistics-body">
                <div className="tabs-container">
                    <button
                        className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                        onClick={() => setActiveTab('users')}
                    >
                        <Users size={18} /> {t('users')}
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'articles' ? 'active' : ''}`}
                        onClick={() => setActiveTab('articles')}
                    >
                        <FileText size={18} /> {t('articles')}
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'calendar' ? 'active' : ''}`}
                        onClick={() => setActiveTab('calendar')}
                    >
                        <Calendar size={18} /> {t('calendar')}
                    </button>
                </div>

                <div className="tab-content fade-in">
                    {activeTab === 'users' && (
                        <div className="stats-card" style={{ height: '100%' }}>
                            <div className="table-responsive">
                                <table className="user-leaderboard comprehensive-leaderboard" style={{ width: '100%' }}>
                                    <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--card-bg)', zIndex: 1 }}>
                                        <tr>
                                            <th className="sortable-header" onClick={() => requestSort('username')} style={{ textAlign: 'left', padding: '0.5rem' }}>
                                                {t('tableUser')} {getSortIcon('username')}
                                            </th>
                                            <th className="sortable-header" onClick={() => requestSort('edits')} style={{ textAlign: 'right', padding: '0.5rem', minWidth: '80px' }}>
                                                {t('tableEdits')} {getSortIcon('edits')}
                                            </th>
                                            <th className="sortable-header" onClick={() => requestSort('articlesCreated')} style={{ textAlign: 'right', padding: '0.5rem', minWidth: '110px' }} title="Articles Created (Namespace 0)">
                                                {t('tableArtCreated')} {getSortIcon('articlesCreated')}
                                            </th>
                                            <th className="sortable-header" onClick={() => requestSort('pagesCreated')} style={{ textAlign: 'right', padding: '0.5rem', minWidth: '110px' }} title="Pages Created (All Namespaces)">
                                                {t('tablePgCreated')} {getSortIcon('pagesCreated')}
                                            </th>
                                            <th className="sortable-header" onClick={() => requestSort('volumeAdded')} style={{ textAlign: 'right', padding: '0.5rem', minWidth: '105px' }}>
                                                {t('tableInputVol')} {getSortIcon('volumeAdded')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedStats.length > 0 ? sortedStats.map((u, idx) => {
                                            const displayRank = idx + 1;
                                            return (
                                                <tr key={idx}>
                                                    <td className="user-cell" style={{ padding: '0.5rem' }}>
                                                        {displayRank <= 3 ? <span className="medal">{displayRank === 1 ? '🥇' : displayRank === 2 ? '🥈' : '🥉'}</span> : <span className="rank-num">{displayRank}.</span>}
                                                        <a href={`https://incubator.wikimedia.org/wiki/User:${u.username.replace(/ /g, '_')}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }} onMouseOver={(e) => e.target.style.textDecoration = 'underline'} onMouseOut={(e) => e.target.style.textDecoration = 'none'}>
                                                            {u.username}
                                                        </a>
                                                    </td>
                                                    <td className="count-cell" style={{ textAlign: 'right', padding: '0.5rem' }}>{u.edits.toLocaleString()}</td>
                                                    <td className="count-cell" style={{ textAlign: 'right', padding: '0.5rem' }}>{u.articlesCreated.toLocaleString()}</td>
                                                    <td className="count-cell" style={{ textAlign: 'right', padding: '0.5rem' }}>{u.pagesCreated.toLocaleString()}</td>
                                                    <td className="count-cell" style={{ textAlign: 'right', padding: '0.5rem' }}>
                                                        <span className={u.volumeAdded > 0 ? "positive-growth" : ""} style={{ color: u.volumeAdded > 0 ? 'var(--brand-primary)' : 'inherit', fontWeight: 'bold' }}>
                                                            +{u.volumeAdded.toLocaleString()} B
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        }) : <tr><td colSpan="5" style={{ textAlign: 'center', padding: '1rem' }}>{t('noData')}</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'articles' && (
                        <div className="stats-card">
                            <div className="stats-list-container">
                                <div className="table-responsive">
                                    <table className="user-leaderboard comprehensive-leaderboard" style={{ width: '100%' }}>
                                        <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--card-bg)', zIndex: 1 }}>
                                            <tr>
                                                <th className="sortable-header" onClick={() => requestArticleSort('cleanTitle')} style={{ textAlign: 'left', padding: '0.5rem' }}>
                                                    {t('tableArticle')} {getArticleSortIcon('cleanTitle')}
                                                </th>
                                                <th className="sortable-header" onClick={() => requestArticleSort('size')} style={{ textAlign: 'right', padding: '0.5rem', minWidth: '100px' }}>
                                                    {t('tableSize')} (Bytes) {getArticleSortIcon('size')}
                                                </th>
                                                <th className="sortable-header" onClick={() => requestArticleSort('timestamp')} style={{ textAlign: 'right', padding: '0.5rem', minWidth: '180px' }}>
                                                    {t('tableDate')} {getArticleSortIcon('timestamp')}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedArticles.length > 0 ? sortedArticles.map((article, idx) => (
                                                <tr key={idx}>
                                                    <td style={{ padding: '0.5rem' }}>
                                                        <a
                                                            href={`https://incubator.wikimedia.org/wiki/${article.title}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{ fontWeight: 500 }}
                                                        >
                                                            {article.cleanTitle.replace(/_/g, ' ')}
                                                        </a>
                                                    </td>
                                                    <td className="count-cell" style={{ textAlign: 'right', padding: '0.5rem' }}>{article.size?.toLocaleString()} B</td>
                                                    <td className="count-cell" style={{ textAlign: 'right', padding: '0.5rem' }}>{formatDate(article.timestamp)}</td>
                                                </tr>
                                            )) : <tr><td colSpan="3" style={{ textAlign: 'center', padding: '1rem' }}>{t('noData')}</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'calendar' && (
                        <div className="stats-card">
                            <div className="calendar-container fade-in">
                                {displayedCalendarData && displayedCalendarData.length > 0 ? displayedCalendarData.map((data, idx) => {
                                    const isExpanded = expandedMonth === data.month;
                                    return (
                                        <div key={idx} className="calendar-month-block">
                                            <button
                                                className={`month-header-btn ${isExpanded ? 'expanded' : ''}`}
                                                onClick={() => setExpandedMonth(isExpanded ? null : data.month)}
                                            >
                                                <div className="month-title">
                                                    <ChevronRight size={18} className={`expand-icon ${isExpanded ? 'rotated' : ''}`} />
                                                    <strong>{data.month}</strong>
                                                </div>
                                                <div className="month-summary-badges">
                                                    <span className="badge users-badge" title="Totaľny broj avtorov"><Users size={14} /> {data.activeUsers.length}</span>
                                                    {data.activeUsers10Plus > 0 && (
                                                        <span className="badge active-badge" title="Avtory s 10+ izměnjami" style={{ color: '#008a00' }}><TrendingUp size={14} /> {data.activeUsers10Plus} (10+)</span>
                                                    )}
                                                    <span className="badge articles-badge" title="Nove članky"><FileText size={14} /> {data.newArticles.length}</span>
                                                </div>
                                            </button>

                                            {isExpanded && (
                                                <div className="month-details fade-in">
                                                    <div className="active-users-list">
                                                        <strong>{t('activeUsersMonth')}:</strong>
                                                        <div className="user-tags">
                                                            {data.activeUsers.map((u, i) => (
                                                                <a key={i} href={`https://incubator.wikimedia.org/wiki/User:${u.replace(/ /g, '_')}`} target="_blank" rel="noopener noreferrer" className="user-tag" style={{ textDecoration: 'none' }} onMouseOver={(e) => e.target.style.textDecoration = 'underline'} onMouseOut={(e) => e.target.style.textDecoration = 'none'}>
                                                                    {u}
                                                                </a>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {data.newArticles.length > 0 && (
                                                        <div className="table-responsive" style={{ marginTop: '1rem' }}>
                                                            <table className="user-leaderboard comprehensive-leaderboard" style={{ width: '100%' }}>
                                                                <thead style={{ backgroundColor: 'var(--card-bg)' }}>
                                                                    <tr>
                                                                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>{t('tableArticle')}</th>
                                                                        <th style={{ textAlign: 'left', padding: '0.5rem', minWidth: '120px' }}>{t('tableAuthor')}</th>
                                                                        <th style={{ textAlign: 'right', padding: '0.5rem', minWidth: '100px' }}>{t('tableSize')}</th>
                                                                        <th style={{ textAlign: 'right', padding: '0.5rem', minWidth: '140px' }}>{t('tableDate')}</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {data.newArticles.map((article, aIdx) => (
                                                                        <tr key={aIdx}>
                                                                            <td style={{ padding: '0.5rem' }}>
                                                                                <a href={`https://incubator.wikimedia.org/wiki/Wp/isv/${article.title.replace(/ /g, '_')}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 500 }}>
                                                                                    {article.title}
                                                                                </a>
                                                                            </td>
                                                                            <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>
                                                                                <a href={`https://incubator.wikimedia.org/wiki/User:${article.author.replace(/ /g, '_')}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }} onMouseOver={(e) => e.target.style.textDecoration = 'underline'} onMouseOut={(e) => e.target.style.textDecoration = 'none'}>
                                                                                    {article.author}
                                                                                </a>
                                                                            </td>
                                                                            <td className="count-cell" style={{ textAlign: 'right', padding: '0.5rem' }}>{article.size.toLocaleString()} B</td>
                                                                            <td className="count-cell" style={{ textAlign: 'right', padding: '0.5rem' }}>{formatDate(article.timestamp)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                }) : (
                                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                                        <Calendar size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                                        <p>{t('noData')}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
