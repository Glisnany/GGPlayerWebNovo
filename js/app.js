// --- Configurações Iniciais ---
if (window.location.protocol === 'https:') {
    document.getElementById('https-warning').style.display = 'flex';
}

const SERVER_URLS = [
    "http://playprime.top",
    "http://livebr.top",
    "http://lulu.dns2.site",
    "http://skylinetop.top",
    "http://sprph.fun",
    "http://live11.site",
    "http://topcar123.com.br",
    "http://telefunplay.xyz",
    "http://idealtv.online",
    "http://dnsbox.fun",
    "http://cordelrellsers.xyz",
    "http://phspr.pro",
    "http://tvzplay.win",
    "http://agh56.pandoraplay10.top",
    "http://funpla.shop",
    "http://elites5.sbs",
    "http://raxz.buzz",
    "http://vtvbr.sbs",
    "http://am52030.atp1.top",
    "http://mplay.run",
    "http://d.cdnbr.site",
    "http://odinsuper1x00.top",
    "http://dnscloud.shop:80",
    "http://dnsgood.site",
    "http://akdemia.click",
    "http://crcns.com:80"
];

const DOM = {
    screens: document.querySelectorAll('.screen'),
    loginForm: document.getElementById('login-form'),
    userInput: document.getElementById('user-input'),
    passInput: document.getElementById('pass-input'),
    loginError: document.getElementById('login-error'),
    btnLogin: document.getElementById('btn-login'),
    loginText: document.getElementById('login-text'),
    loginSpinner: document.getElementById('login-spinner'),
    
    navBtns: document.querySelectorAll('.tab-btn[data-target]'),
    btnLogout: document.getElementById('btn-logout'),
    expireDate: document.getElementById('expire-date'),
    searchInput: document.getElementById('search-input'),
    
    categoriesPanel: document.getElementById('categories-panel'),
    categoryTitle: document.getElementById('category-title'),
    categoriesList: document.getElementById('categories-list'),
    
    itemsPanel: document.getElementById('items-panel'),
    contentGrid: document.getElementById('content-grid'),
    
    liveHero: document.getElementById('live-hero'),
    miniPlayer: document.getElementById('mini-player'),
    heroTitle: document.getElementById('hero-title'),
    btnFullscreen: document.getElementById('btn-fullscreen'),
    
    detailsScreen: document.getElementById('details-screen'),
    btnCloseDetails: document.getElementById('btn-close-details'),
    detailsPoster: document.getElementById('details-poster'),
    detailsTitle: document.getElementById('details-title'),
    detailsYear: document.getElementById('details-year'),
    detailsRating: document.getElementById('details-rating'),
    detailsPlot: document.getElementById('details-plot'),
    btnPlayVod: document.getElementById('btn-play-vod'),
    btnFavVod: document.getElementById('btn-fav-vod'),
    seriesEpisodesContainer: document.getElementById('series-episodes-container'),
    seasonSelect: document.getElementById('season-select'),
    episodesList: document.getElementById('episodes-list'),
    
    playerScreen: document.getElementById('player-screen'),
    btnClosePlayer: document.getElementById('btn-close-player'),
    mainPlayer: document.getElementById('main-player')
};

let appState = {
    credentials: null,
    currentTab: 'live',
    currentCategory: null,
    isShowingCategories: true,
    categories: { live: [], movies: [], series: [] },
    streams: { live: [], movies: [], series: [] },
    allStreams: { live: null, movies: null, series: null }, // Cache for global search
    favorites: JSON.parse(localStorage.getItem('gg_favorites')) || [],
    history: JSON.parse(localStorage.getItem('gg_history')) || [],
    watchProgress: JSON.parse(localStorage.getItem('gg_progress')) || {},
    hlsMini: null,
    hlsMain: null,
    currentPlayback: null
};

async function fetchApi(action, params = {}) {
    if (!appState.credentials) return null;
    
    const { dns, user, pass } = appState.credentials;
    let targetUrl = `${dns}/player_api.php?username=${user}&password=${pass}`;
    if (action) targetUrl += `&action=${action}`;
    
    for (const key in params) {
        targetUrl += `&${key}=${params[key]}`;
    }

    try {
        const res = await fetch(targetUrl);
        if (!res.ok) throw new Error('Direct fetch failed');
        return await res.json();
    } catch (e) {
        const proxyUrl = `api/proxy.php?url=${encodeURIComponent(targetUrl)}`;
        try {
            const res2 = await fetch(proxyUrl);
            if (!res2.ok) throw new Error('Proxy fetch failed');
            return await res2.json();
        } catch (e2) {
            return null;
        }
    }
}

function saveFavorites() { localStorage.setItem('gg_favorites', JSON.stringify(appState.favorites)); }
function saveHistory() { localStorage.setItem('gg_history', JSON.stringify(appState.history)); }
function saveProgress() { localStorage.setItem('gg_progress', JSON.stringify(appState.watchProgress)); }

function isFav(id, type) { return appState.favorites.some(f => f.id == id && f.type == type); }
function toggleFav(item) {
    const idx = appState.favorites.findIndex(f => f.id == item.id && f.type == item.type);
    if (idx >= 0) appState.favorites.splice(idx, 1);
    else appState.favorites.push(item);
    saveFavorites();
}

function addToHistory(item) {
    const idx = appState.history.findIndex(h => h.id == item.id && h.type == item.type);
    if (idx >= 0) appState.history.splice(idx, 1);
    appState.history.unshift(item);
    if (appState.history.length > 50) appState.history.pop();
    saveHistory();
}

function showScreen(screenId) {
    DOM.screens.forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

DOM.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = DOM.userInput.value.trim();
    const pass = DOM.passInput.value.trim();
    
    DOM.loginText.style.display = 'none';
    DOM.loginSpinner.style.display = 'inline-block';
    DOM.btnLogin.disabled = true;
    DOM.loginError.innerText = 'Procurando servidor... aguarde.';
    
    const testDns = async (dnsUrl) => {
        let cleanDns = dnsUrl.trim();
        if (cleanDns.endsWith('/')) cleanDns = cleanDns.slice(0, -1);
        if (!cleanDns.startsWith('http')) cleanDns = 'http://' + cleanDns;
        
        const targetUrl = cleanDns + '/player_api.php?username=' + user + '&password=' + pass;
        
        try {
            const proxyUrl = 'api/proxy.php?url=' + encodeURIComponent(targetUrl);
            const res = await fetch(proxyUrl);
            if (!res.ok) throw new Error('Proxy failed');
            const data = await res.json();
            if (data && data.user_info && data.user_info.auth === 1) return { dns: cleanDns, data: data };
        } catch(e) {}
        
        try {
            const res2 = await fetch(targetUrl);
            if (res2.ok) {
                const data2 = await res2.json();
                if (data2 && data2.user_info && data2.user_info.auth === 1) return { dns: cleanDns, data: data2 };
            }
        } catch(e2) {}
        
        throw new Error('Invalid');
    };

    try {
        const result = await Promise.any(SERVER_URLS.map(url => testDns(url)));
        appState.credentials = { dns: result.dns, user, pass };
        localStorage.setItem('gg_credentials', JSON.stringify(appState.credentials));
        DOM.loginError.innerText = '';
        initDashboard(result.data.user_info);
    } catch (e) {
        DOM.loginError.innerText = 'Usuário, senha incorretos ou servidores offline.';
    }
    
    DOM.loginText.style.display = 'inline-block';
    DOM.loginSpinner.style.display = 'none';
    DOM.btnLogin.disabled = false;
});

async function initDashboard(userInfo) {
    showScreen('main-screen');
    try {
        if (userInfo.exp_date) {
            const date = new Date(userInfo.exp_date * 1000);
            DOM.expireDate.innerText = `Vence em: ${date.toLocaleDateString('pt-BR')}`;
        }
    } catch(e) {}
    
    let liveCats = await fetchApi('get_live_categories');
    appState.categories.live = Array.isArray(liveCats) ? liveCats : [];
    
    let vodCats = await fetchApi('get_vod_categories');
    appState.categories.movies = Array.isArray(vodCats) ? vodCats : [];
    
    let seriesCats = await fetchApi('get_series_categories');
    appState.categories.series = Array.isArray(seriesCats) ? seriesCats : [];
    
    switchTab('live');
}

DOM.navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        DOM.navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        switchTab(btn.dataset.target);
    });
});

DOM.btnLogout.addEventListener('click', () => {
    localStorage.removeItem('gg_credentials');
    window.location.reload();
});

function switchTab(tab) {
    appState.currentTab = tab;
    appState.isShowingCategories = true;
    stopMiniPlayer();
    DOM.contentGrid.innerHTML = '';
    DOM.searchInput.value = '';
    
    if (tab === 'live') {
        DOM.categoriesPanel.style.display = 'flex';
        DOM.liveHero.style.display = 'flex';
        DOM.contentGrid.style.display = 'none';
        renderCategories(appState.categories.live, 'live');
    } else if (tab === 'movies' || tab === 'series') {
        DOM.categoriesPanel.style.display = 'flex';
        DOM.liveHero.style.display = 'none';
        DOM.contentGrid.style.display = 'flex';
        renderCategories(appState.categories[tab], tab);
    } else if (tab === 'favorites') {
        DOM.categoriesPanel.style.display = 'none';
        DOM.liveHero.style.display = 'none';
        DOM.contentGrid.style.display = 'flex';
        renderGrid(appState.favorites);
    } else if (tab === 'history') {
        DOM.categoriesPanel.style.display = 'none';
        DOM.liveHero.style.display = 'none';
        DOM.contentGrid.style.display = 'flex';
        
        DOM.contentGrid.innerHTML = `<div style="width: 100%; text-align: right; margin-bottom: 15px;">
            <button id="btn-clear-history" class="btn-secondary">Limpar Histórico</button>
        </div>`;
        document.getElementById('btn-clear-history').addEventListener('click', () => {
            appState.history = [];
            saveHistory();
            switchTab('history');
        });
        
        const wrapper = document.createElement('div');
        wrapper.className = 'content-grid';
        wrapper.style.width = '100%';
        DOM.contentGrid.appendChild(wrapper);
        
        appState.history.forEach(item => {
            wrapper.appendChild(createCard(item));
        });
    }
}

function renderCategories(cats, type) {
    DOM.categoriesList.innerHTML = '';
    
    const allLi = document.createElement('li');
    allLi.className = 'category-item active';
    allLi.innerText = 'Todos';
    allLi.onclick = () => selectCategory(null, type, allLi);
    DOM.categoriesList.appendChild(allLi);
    
    const favLi = document.createElement('li');
    favLi.className = 'category-item';
    favLi.innerHTML = '<span style="color:var(--gold);">&#9733; Favoritos</span>';
    favLi.onclick = () => selectCategory('FAVORITES', type, favLi);
    DOM.categoriesList.appendChild(favLi);
    
    cats.forEach(c => {
        const li = document.createElement('li');
        li.className = 'category-item';
        li.innerText = c.category_name;
        li.onclick = () => selectCategory(c.category_id, type, li);
        DOM.categoriesList.appendChild(li);
    });
    
    if (type !== 'live') {
        selectCategory(null, type, allLi);
    }
}

function renderChannelsList(items) {
    DOM.categoriesList.innerHTML = '';
    
    const backLi = document.createElement('li');
    backLi.className = 'category-item';
    backLi.innerHTML = '<strong style="color:var(--gold);">&larr; Voltar às Categorias</strong>';
    backLi.onclick = () => {
        appState.isShowingCategories = true;
        renderCategories(appState.categories.live, 'live');
    };
    DOM.categoriesList.appendChild(backLi);
    
    items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'category-item';
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        
        const isFavorite = isFav(item.id, item.type);
        const favIcon = isFavorite ? '<span class="fav-icon" style="color:var(--gold);font-size:20px;cursor:pointer;">&#9733;</span>' : '<span class="fav-icon" style="color:gray;font-size:20px;cursor:pointer;">&#9734;</span>';
        
        li.innerHTML = `<span style="display:inline-block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:85%; pointer-events:none;">${item.name}</span> ${favIcon}`;
        
        li.onclick = (e) => {
            if (e.target.classList.contains('fav-icon')) {
                e.stopPropagation();
                toggleFav(item);
                renderChannelsList(appState.streams.live);
                return;
            }
            document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
            playMiniPlayer(item);
        };
        DOM.categoriesList.appendChild(li);
    });
}

async function selectCategory(catId, type, liElement) {
    if (liElement) {
        document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
        liElement.classList.add('active');
    }
    
    appState.currentCategory = catId;
    
    if (catId === 'FAVORITES') {
        const favs = appState.favorites.filter(f => f.type === type);
        appState.streams[type] = favs;
        if (type === 'live') {
            appState.isShowingCategories = false;
            renderChannelsList(favs);
        } else {
            renderGrid(favs);
        }
        return;
    }
    
    if (type !== 'live') DOM.contentGrid.innerHTML = '<div style="width:100%;text-align:center;padding:20px;">Carregando...</div>';
    else DOM.categoriesList.innerHTML = '<li class="category-item">Carregando...</li>';
    
    let action = '';
    if (type === 'live') action = 'get_live_streams';
    else if (type === 'movies') action = 'get_vod_streams';
    else if (type === 'series') action = 'get_series';
    
    try {
        let streams = await fetchApi(action, catId ? { category_id: catId } : {});
        if (!Array.isArray(streams)) streams = [];
        
        let items = streams.map(s => {
            return {
                id: s.stream_id || s.series_id,
                name: s.name || 'Sem Nome',
                logo: s.stream_icon || s.cover || '',
                type: type,
                stream_type: s.stream_type || ''
            };
        });
        
        appState.streams[type] = items;
        
        if (type === 'live') {
            appState.isShowingCategories = false;
            renderChannelsList(items);
        } else {
            renderGrid(items);
        }
    } catch (err) {
        if (type !== 'live') DOM.contentGrid.innerHTML = '<div style="width:100%;text-align:center;padding:20px;color:red;">Erro ao carregar a lista.</div>';
        else DOM.categoriesList.innerHTML = '<li class="category-item" style="color:red;">Erro ao carregar a lista.</li>';
    }
}

function renderGrid(items) {
    DOM.contentGrid.innerHTML = '';
    items.forEach(item => DOM.contentGrid.appendChild(createCard(item)));
}

function createCard(item) {
    const div = document.createElement('div');
    div.className = 'stream-item';
    
    let progressTag = '';
    if ((item.type === 'movies' || item.type === 'series') && appState.watchProgress[item.id]) {
        const p = appState.watchProgress[item.id];
        if (p > 90) progressTag = '<div class="tag-overlay" style="background:#4CAF50;">Assistido</div>';
        else if (p > 0) progressTag = `<div class="tag-overlay">Assistindo (${Math.floor(p)}%)</div>`;
    }
    
    // Fallback logo is REMOVED to save weight. If error, image becomes transparent.
    div.innerHTML = `
        <div class="stream-item-inner">
            <img src="${item.logo}" onerror="this.style.opacity=0;">
            ${progressTag}
        </div>
        <div class="stream-title">${item.name}</div>
    `;
    
        div.addEventListener('click', () => {
        if (item.type === 'live') openFullscreenPlayer(item);
        else openDetails(item);
    });
    
    return div;
}

// --- GLOBAL SEARCH ---
let searchTimeout;
DOM.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const term = e.target.value.trim().toLowerCase();
    
    if (!term) {
        switchTab(appState.currentTab);
        return;
    }
    
    searchTimeout = setTimeout(() => performGlobalSearch(term), 800);
});

async function performGlobalSearch(term) {
    // Mantém o painel de categorias visível para o usuário continuar digitando!
    DOM.liveHero.style.display = 'none';
    DOM.contentGrid.style.display = 'flex';
    DOM.contentGrid.innerHTML = '<div style="width:100%;text-align:center;padding:20px;font-size:18px;color:var(--gold);">Pesquisando em todo o sistema... Aguarde.</div>';
    
    try {
        let allResults = [];
        
        if (!appState.allStreams.live) {
            const live = await fetchApi('get_live_streams');
            appState.allStreams.live = Array.isArray(live) ? live.map(s => ({
                id: s.stream_id, name: s.name || '', logo: s.stream_icon || '', type: 'live'
            })) : [];
        }
        allResults.push(...appState.allStreams.live.filter(i => i.name.toLowerCase().includes(term)));
        
        if (!appState.allStreams.movies) {
            const vod = await fetchApi('get_vod_streams');
            appState.allStreams.movies = Array.isArray(vod) ? vod.map(s => ({
                id: s.stream_id, name: s.name || '', logo: s.stream_icon || s.cover || '', type: 'movies'
            })) : [];
        }
        allResults.push(...appState.allStreams.movies.filter(i => i.name.toLowerCase().includes(term)));
        
        if (!appState.allStreams.series) {
            const series = await fetchApi('get_series');
            appState.allStreams.series = Array.isArray(series) ? series.map(s => ({
                id: s.series_id, name: s.name || '', logo: s.cover || '', type: 'series'
            })) : [];
        }
        allResults.push(...appState.allStreams.series.filter(i => i.name.toLowerCase().includes(term)));
        
        if (allResults.length === 0) {
            DOM.contentGrid.innerHTML = '<div style="width:100%;text-align:center;padding:20px;font-size:18px;">Nenhum resultado encontrado.</div>';
        } else {
            renderGrid(allResults);
        }
    } catch (err) {
        DOM.contentGrid.innerHTML = '<div style="width:100%;text-align:center;padding:20px;color:red;">Erro ao processar pesquisa.</div>';
    }
}

// --- PLAYERS (HLS & NATIVE) ---
function getStreamUrl(item, extension = '') {
    const { dns, user, pass } = appState.credentials;
    if (item.type === 'live') return `${dns}/live/${user}/${pass}/${item.id}.m3u8`;
    if (item.type === 'movies') return `${dns}/movie/${user}/${pass}/${item.id}.${extension || 'mp4'}`;
    if (item.type === 'series') return `${dns}/series/${user}/${pass}/${item.id}.${extension || 'mp4'}`;
    return '';
}

function loadVideo(videoEl, url, isHls, hlsObjKey) {
    if (appState[hlsObjKey]) {
        appState[hlsObjKey].destroy();
        appState[hlsObjKey] = null;
    }
    
    if (isHls && typeof Hls !== 'undefined' && Hls.isSupported() && !videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        const hls = new Hls({ maxBufferLength: 30 });
        hls.loadSource(url);
        hls.attachMedia(videoEl);
        appState[hlsObjKey] = hls;
    } else {
        videoEl.src = url;
    }
    videoEl.load();
    videoEl.play().catch(e => console.log("Autoplay blocked"));
}

function playMiniPlayer(item) {
    DOM.heroTitle.innerText = item.name;
    DOM.btnFullscreen.style.display = 'inline-block';
    DOM.btnFullscreen.onclick = () => openFullscreenPlayer(item);
    const url = getStreamUrl(item);
    loadVideo(DOM.miniPlayer, url, true, 'hlsMini');
}

function stopMiniPlayer() {
    DOM.heroTitle.innerText = "Selecione um canal";
    DOM.btnFullscreen.style.display = 'none';
    DOM.miniPlayer.pause();
    DOM.miniPlayer.removeAttribute('src');
    DOM.miniPlayer.load();
    if (appState.hlsMini) {
        appState.hlsMini.destroy();
        appState.hlsMini = null;
    }
}

function openFullscreenPlayer(item, extension = '') {
    stopMiniPlayer();
    addToHistory(item);
    appState.currentPlayback = item;
    showScreen('player-screen');
    const url = getStreamUrl(item, extension);
    loadVideo(DOM.mainPlayer, url, item.type === 'live', 'hlsMain');
    
    if (item.type !== 'live' && appState.watchProgress[item.id]) {
        const p = appState.watchProgress[item.id];
        DOM.mainPlayer.onloadedmetadata = () => {
            if (p > 0 && p < 90) DOM.mainPlayer.currentTime = (DOM.mainPlayer.duration * p) / 100;
            DOM.mainPlayer.onloadedmetadata = null;
        };
    }
}

DOM.btnClosePlayer.addEventListener('click', () => {
    DOM.mainPlayer.pause();
    DOM.mainPlayer.removeAttribute('src');
    DOM.mainPlayer.load();
    if (appState.hlsMain) {
        appState.hlsMain.destroy();
        appState.hlsMain = null;
    }
    DOM.playerScreen.classList.remove('active');
    if (appState.currentTab === 'live') DOM.heroTitle.innerText = "Selecione um canal";
    appState.currentPlayback = null;
});

DOM.mainPlayer.addEventListener('timeupdate', () => {
    if (!appState.currentPlayback || appState.currentPlayback.type === 'live') return;
    const vid = DOM.mainPlayer;
    if (vid.duration) {
        const pct = (vid.currentTime / vid.duration) * 100;
        appState.watchProgress[appState.currentPlayback.id] = pct;
        if (Math.floor(vid.currentTime) % 5 === 0) saveProgress();
    }
});

// --- VOD DETAILS ---
async function openDetails(item) {
    DOM.detailsPoster.style.opacity = 1;
    DOM.detailsPoster.src = item.logo;
    DOM.detailsPoster.onerror = function() { this.style.opacity = 0; };
    
    DOM.detailsTitle.innerText = item.name;
    DOM.detailsPlot.innerText = "Carregando detalhes...";
    DOM.detailsYear.innerText = "";
    DOM.detailsRating.innerText = "";
    DOM.seriesEpisodesContainer.style.display = 'none';
    
    DOM.btnFavVod.onclick = () => {
        toggleFav(item);
        updateFavBtn(item);
    };
    updateFavBtn(item);
    
    DOM.detailsScreen.classList.add('active');
    
    if (item.type === 'movies') {
        const info = await fetchApi('get_vod_info', { vod_id: item.id });
        if (info && info.info) {
            DOM.detailsPlot.innerText = info.info.plot || 'Sem sinopse.';
            DOM.detailsYear.innerText = info.info.releasedate || info.info.year || '';
            DOM.detailsRating.innerText = info.info.rating ? `⭐ ${info.info.rating}` : '';
            DOM.btnPlayVod.style.display = 'inline-block';
            DOM.btnPlayVod.onclick = () => openFullscreenPlayer(item, info.movie_data?.container_extension);
        }
    } else if (item.type === 'series') {
        DOM.btnPlayVod.style.display = 'none';
        const info = await fetchApi('get_series_info', { series_id: item.id });
        if (info && info.info) {
            DOM.detailsPlot.innerText = info.info.plot || 'Sem sinopse.';
            DOM.detailsYear.innerText = info.info.releaseDate || '';
            DOM.detailsRating.innerText = info.info.rating ? `⭐ ${info.info.rating}` : '';
            if (info.episodes) {
                DOM.seriesEpisodesContainer.style.display = 'block';
                renderSeriesEpisodes(info.episodes, item);
            }
        }
    }
}

function updateFavBtn(item) {
    const isF = isFav(item.id, item.type);
    DOM.btnFavVod.innerHTML = isF ? '&#9733; Favoritado' : '&#9734; Favoritar';
    DOM.btnFavVod.style.color = isF ? 'var(--gold)' : 'white';
}

function renderSeriesEpisodes(episodesData, seriesItem) {
    DOM.seasonSelect.innerHTML = '';
    const seasons = Object.keys(episodesData);
    
    seasons.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.innerText = `Temporada ${s}`;
        DOM.seasonSelect.appendChild(opt);
    });
    
    DOM.seasonSelect.onchange = () => {
        const season = DOM.seasonSelect.value;
        const eps = episodesData[season] || [];
        DOM.episodesList.innerHTML = '';
        
        eps.forEach(ep => {
            const epDiv = document.createElement('div');
            epDiv.className = 'episode-item';
            
            let epName = ep.title || `Episódio ${ep.episode_num}`;
            let tag = '';
            if (appState.watchProgress[ep.id]) {
                const p = appState.watchProgress[ep.id];
                if (p > 90) tag = '<span style="color:#4CAF50;font-size:12px;margin-left:10px;">(Assistido)</span>';
                else if (p > 0) tag = `<span style="color:var(--gold);font-size:12px;margin-left:10px;">(Assistindo ${Math.floor(p)}%)</span>`;
            }

            epDiv.innerHTML = `<span><b>${ep.episode_num}.</b> ${epName} ${tag}</span> &#9654;`;
            epDiv.onclick = () => {
                const epItem = {
                    id: ep.id,
                    name: `${seriesItem.name} - S${season}E${ep.episode_num}`,
                    logo: seriesItem.logo,
                    type: 'series'
                };
                openFullscreenPlayer(epItem, ep.container_extension);
            };
            DOM.episodesList.appendChild(epDiv);
        });
    };
    
    if (seasons.length > 0) DOM.seasonSelect.onchange();
}

DOM.btnCloseDetails.addEventListener('click', () => {
    DOM.detailsScreen.classList.remove('active');
});

const savedCreds = localStorage.getItem('gg_credentials');
if (savedCreds) {
    appState.credentials = JSON.parse(savedCreds);
    DOM.userInput.value = appState.credentials.user;
    DOM.passInput.value = appState.credentials.pass;
    DOM.btnLogin.click();
} else {
    showScreen('login-screen');
}


