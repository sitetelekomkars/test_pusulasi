// =======================================================
// === AYARLAR VE GÜVENLİ URL'LER ===
// =======================================================

const BAKIM_MODU = false; 

// Apps Script URL'si
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzbocJrJPU7_u0lvlnBQ8CrQYHCfy22G6UU8jRo5s6Yrl4rpTQ_a7oB5Ttf_NkGsUOiQg/exec"; 

let jokers = { call: 1, half: 1, double: 1 };
let doubleChanceUsed = false;
let firstAnswerIndex = -1;
const VALID_CATEGORIES = ['Teknik', 'İkna', 'Kampanya', 'Bilgi'];

// --- GLOBAL DEĞİŞKENLER ---
let database = [], newsData = [], sportsData = [], salesScripts = [], quizQuestions = [];
let currentUser = "";
let isAdminMode = false;      // YETKİ
let isEditingActive = false;  // GÖRÜNÜM
let sessionTimeout;
let activeCards = []; 
let currentCategory = 'all';
let adminUserList = []; 
let allEvaluationsData = []; 
const MONTH_NAMES = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];


// =======================================================
// === YARDIMCI VE HESAPLAMA FONKSİYONLARI (GLOBAL) ===
// =======================================================

// --- PUAN HESAPLAMA MOTORU ---
window.updateRowScore = function(index, max) {
    const slider = document.getElementById(`slider-${index}`);
    const badge = document.getElementById(`badge-${index}`);
    const noteInput = document.getElementById(`note-${index}`);
    const row = document.getElementById(`row-${index}`);
    
    if(!slider) return;

    const val = parseInt(slider.value);
    badge.innerText = val;
    
    if (val < max) {
        noteInput.style.display = 'block';
        badge.style.background = '#d32f2f'; 
        row.style.borderColor = '#ffcdd2';
        row.style.background = '#fff5f5';
    } else {
        noteInput.style.display = 'none';
        noteInput.value = ''; 
        badge.style.background = '#2e7d32'; 
        row.style.borderColor = '#eee';
        row.style.background = '#fff';
    }
    window.recalcTotalScore();
};

window.recalcTotalScore = function() {
    let currentTotal = 0;
    let maxTotal = 0;
    
    const sliders = document.querySelectorAll('.slider-input');
    sliders.forEach(s => {
        currentTotal += parseInt(s.value) || 0;
        maxTotal += parseInt(s.getAttribute('max')) || 0; 
    });

    const liveScoreEl = document.getElementById('live-score');
    const ringEl = document.getElementById('score-ring');
    
    if(liveScoreEl) liveScoreEl.innerText = currentTotal;

    if(ringEl) {
        let color = '#2e7d32'; 
        let ratio = maxTotal > 0 ? (currentTotal / maxTotal) * 100 : 0;

        if(ratio < 50) color = '#d32f2f'; 
        else if(ratio < 85) color = '#ed6c02'; 
        else if(ratio < 95) color = '#fabb00'; 

        ringEl.style.background = `conic-gradient(${color} ${ratio}%, #444 ${ratio}%)`;
    }
};

// --- DİĞER YARDIMCILAR ---
function getToken() { return localStorage.getItem("sSportToken"); }
function getFavs() { return JSON.parse(localStorage.getItem('sSportFavs') || '[]'); }
function toggleFavorite(title) { event.stopPropagation(); let favs = getFavs(); if (favs.includes(title)) { favs = favs.filter(t => t !== title); } else { favs.push(title); } localStorage.setItem('sSportFavs', JSON.stringify(favs)); if (currentCategory === 'fav') { filterCategory(document.querySelector('.btn-fav'), 'fav'); } else { renderCards(activeCards); } }
function isFav(title) { return getFavs().includes(title); }

function formatDateToDDMMYYYY(dateString) {
    if (!dateString) return 'N/A';
    if (dateString.match(/^\d{2}\.\d{2}\.\d{4}/)) { return dateString; }
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) { return dateString; }
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    } catch (e) { return dateString; }
}

function isNew(dateStr) { if (!dateStr) return false; let date; if (dateStr.indexOf('.') > -1) { const cleanDate = dateStr.split(' ')[0]; const parts = cleanDate.split('.'); date = new Date(parts[2], parts[1] - 1, parts[0]); } else { date = new Date(dateStr); } if (isNaN(date.getTime())) return false; const now = new Date(); const diffTime = Math.abs(now - date); const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); return diffDays <= 3; }
function getCategorySelectHtml(currentCategory, id) { let options = VALID_CATEGORIES.map(cat => `<option value="${cat}" ${cat === currentCategory ? 'selected' : ''}>${cat}</option>`).join(''); if (currentCategory && !VALID_CATEGORIES.includes(currentCategory)) { options = `<option value="${currentCategory}" selected>${currentCategory} (Hata)</option>` + options; } return `<select id="${id}" class="swal2-input" style="width:100%; margin-top:5px;">${options}</select>`; }
function escapeForJsString(text) { if (!text) return ""; return text.toString().replace(/\\/g, '\\\\').replace(/'/g, '\\\'').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, ''); }

document.addEventListener('contextmenu', event => event.preventDefault());
document.onkeydown = function(e) { if(e.keyCode == 123) return false; }
document.addEventListener('DOMContentLoaded', () => { checkSession(); });

function checkSession() {
    const savedUser = localStorage.getItem("sSportUser");
    const savedToken = localStorage.getItem("sSportToken");
    const savedRole = localStorage.getItem("sSportRole"); 
    if (savedUser && savedToken) {
        currentUser = savedUser;
        document.getElementById("login-screen").style.display = "none"; 
        document.getElementById("user-display").innerText = currentUser;
        checkAdmin(savedRole); 
        startSessionTimer();
        if (BAKIM_MODU) document.getElementById("maintenance-screen").style.display = "flex";
        else { document.getElementById("main-app").style.display = "block"; loadContentData(); }
    }
}

function enterBas(e) { if (e.key === "Enter") girisYap(); }
function girisYap() { const uName = document.getElementById("usernameInput").value.trim(); const uPass = document.getElementById("passInput").value.trim(); const loadingMsg = document.getElementById("loading-msg"); const errorMsg = document.getElementById("error-msg"); if(!uName || !uPass) { errorMsg.innerText = "Lütfen bilgileri giriniz."; errorMsg.style.display = "block"; return; } loadingMsg.style.display = "block"; loadingMsg.innerText = "Doğrulanıyor..."; errorMsg.style.display = "none"; document.querySelector('.login-btn').disabled = true; const hashedPass = CryptoJS.SHA256(uPass).toString(); fetch(SCRIPT_URL, { method: 'POST', headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "login", username: uName, password: hashedPass }) }).then(response => response.json()).then(data => { loadingMsg.style.display = "none"; document.querySelector('.login-btn').disabled = false; if (data.result === "success") { currentUser = data.username; localStorage.setItem("sSportUser", currentUser); localStorage.setItem("sSportToken", data.token); localStorage.setItem("sSportRole", data.role); if (data.forceChange === true) { Swal.fire({ icon: 'warning', title: '⚠️ Güvenlik Uyarısı', text: 'İlk girişiniz. Lütfen şifrenizi değiştirin.', allowOutsideClick: false, allowEscapeKey: false, confirmButtonText: 'Şifremi Değiştir' }).then(() => { changePasswordPopup(true); }); } else { document.getElementById("login-screen").style.display = "none"; document.getElementById("user-display").innerText = currentUser; checkAdmin(data.role); startSessionTimer(); if (BAKIM_MODU) document.getElementById("maintenance-screen").style.display = "flex"; else { document.getElementById("main-app").style.display = "block"; loadContentData(); } } } else { errorMsg.innerText = data.message || "Hatalı giriş!"; errorMsg.style.display = "block"; } }).catch(error => { console.error("Login Error:", error); loadingMsg.style.display = "none"; document.querySelector('.login-btn').disabled = false; errorMsg.innerText = "Sunucu hatası! Lütfen sayfayı yenileyin."; errorMsg.style.display = "block"; }); }

function checkAdmin(role) { 
    const editBtn = document.getElementById('quickEditBtn'); 
    const addBtn = document.getElementById('addCardBtn'); 
    isAdminMode = (role === "admin"); 
    isEditingActive = false;
    document.body.classList.remove('editing');
    
    if(isAdminMode) { 
        editBtn.style.display = "flex"; 
        addBtn.style.display = "flex"; 
        editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i> Düzenlemeyi Aç';
        editBtn.classList.remove('active');
    } else { 
        editBtn.style.display = "none"; 
        addBtn.style.display = "none"; 
    } 
}

function logout() { currentUser = ""; isAdminMode = false; isEditingActive = false; document.body.classList.remove('editing'); localStorage.removeItem("sSportUser"); localStorage.removeItem("sSportToken"); localStorage.removeItem("sSportRole"); if (sessionTimeout) clearTimeout(sessionTimeout); document.getElementById("main-app").style.display = "none"; document.getElementById("login-screen").style.display = "flex"; document.getElementById("passInput").value = ""; document.getElementById("usernameInput").value = ""; document.getElementById("error-msg").style.display = "none"; }
function startSessionTimer() { if (sessionTimeout) clearTimeout(sessionTimeout); sessionTimeout = setTimeout(() => { Swal.fire({ icon: 'warning', title: 'Oturum Süresi Doldu', text: 'Güvenlik nedeniyle otomatik çıkış yapıldı.', confirmButtonText: 'Tamam' }).then(() => { logout(); }); }, 3600000); }
function openUserMenu() { let options = { title: `Merhaba, ${currentUser}`, showCancelButton: true, showDenyButton: true, confirmButtonText: '🔑 Şifre Değiştir', denyButtonText: '🚪 Çıkış Yap', cancelButtonText: 'İptal' }; Swal.fire(options).then((result) => { if (result.isConfirmed) changePasswordPopup(); else if (result.isDenied) logout(); }); }

async function changePasswordPopup(isMandatory = false) { 
    const { value: formValues } = await Swal.fire({ 
        title: isMandatory ? 'Yeni Şifre Belirleyin' : 'Şifre Değiştir', 
        html: `${isMandatory ? '<p style="font-size:0.9rem; color:#d32f2f;">İlk giriş şifrenizi değiştirmeden devam edemezsiniz.</p>' : ''}<input id="swal-old-pass" type="password" class="swal2-input" placeholder="Eski Şifre (Mevcut)"><input id="swal-new-pass" type="password" class="swal2-input" placeholder="Yeni Şifre">`, 
        focusConfirm: false, showCancelButton: !isMandatory, allowOutsideClick: !isMandatory, allowEscapeKey: !isMandatory, confirmButtonText: 'Değiştir', cancelButtonText: 'İptal', 
        preConfirm: () => { 
            const o = document.getElementById('swal-old-pass').value; 
            const n = document.getElementById('swal-new-pass').value; 
            if(!o || !n) { Swal.showValidationMessage('Alanlar boş bırakılamaz'); } 
            return [ o, n ] 
        } 
    }); 
    if (formValues) { 
        Swal.fire({ title: 'İşleniyor...', didOpen: () => { Swal.showLoading() } }); 
        fetch(SCRIPT_URL, { method: 'POST', headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "changePassword", username: currentUser, oldPass: CryptoJS.SHA256(formValues[0]).toString(), newPass: CryptoJS.SHA256(formValues[1]).toString(), token: getToken() }) }) 
        .then(response => response.json())
        .then(data => { 
            if(data.result === "success") { 
                Swal.fire('Başarılı!', 'Şifreniz güncellendi. Güvenlik gereği yeniden giriş yapınız.', 'success').then(() => { logout(); }); 
            } else { 
                Swal.fire('Hata', data.message || 'İşlem başarısız.', 'error').then(() => { if(isMandatory) changePasswordPopup(true); }); 
            } 
        }).catch(err => { 
            Swal.fire('Hata', 'Sunucu hatası.', 'error'); 
            if(isMandatory) changePasswordPopup(true); 
        }); 
    } else if (isMandatory) { changePasswordPopup(true); } 
}

function loadContentData() { 
    document.getElementById('loading').style.display = 'block'; 
    fetch(SCRIPT_URL, { method: 'POST', headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "fetchData" }) })
    .then(response => response.json()).then(data => {
        document.getElementById('loading').style.display = 'none'; 
        if (data.result === "success") {
            const rawData = data.data; 
            const fetchedCards = rawData.filter(i => ['card','bilgi','teknik','kampanya','ikna'].includes(i.Type)).map(i => ({ 
                title: i.Title, category: i.Category, text: i.Text, script: i.Script, code: i.Code, link: i.Link, date: formatDateToDDMMYYYY(i.Date)
            }));
            const fetchedNews = rawData.filter(i => i.Type === 'news').map(i => ({ date: formatDateToDDMMYYYY(i.Date), title: i.Title, desc: i.Text, type: i.Category, status: i.Status }));
            const fetchedSports = rawData.filter(i => i.Type === 'sport').map(i => ({ title: i.Title, icon: i.Icon, desc: i.Text, tip: i.Tip, detail: i.Detail, pronunciation: i.Pronunciation }));
            const fetchedSales = rawData.filter(i => i.Type === 'sales').map(i => ({ title: i.Title, text: i.Text }));
            const fetchedQuiz = rawData.filter(i => i.Type === 'quiz').map(i => ({ q: i.Text, opts: i.QuizOptions ? i.QuizOptions.split(',') : [], a: parseInt(i.QuizAnswer) }));

            database = fetchedCards; newsData = fetchedNews; sportsData = fetchedSports; salesScripts = fetchedSales; quizQuestions = fetchedQuiz;
            if(currentCategory === 'fav') { filterCategory(document.querySelector('.btn-fav'), 'fav'); } else { activeCards = database; renderCards(database); } 
            startTicker();
        } else { document.getElementById('loading').innerHTML = `Veriler alınamadı: ${data.message || 'Bilinmeyen Hata'}`; }
    }).catch(error => { console.error("Fetch Hatası:", error); document.getElementById('loading').innerHTML = 'Bağlantı Hatası! Sunucuya ulaşılamıyor.'; }); 
}

function renderCards(data) { 
    activeCards = data; 
    const container = document.getElementById('cardGrid'); 
    container.innerHTML = ''; 
    if (data.length === 0) { container.innerHTML = '<div style="grid-column:1/-1; text-align:center;">Kayıt Yok / Bulunamadı</div>'; return; } 
    data.forEach((item, index) => { 
        const safeTitle = escapeForJsString(item.title); 
        const isFavorite = isFav(item.title); 
        const favClass = isFavorite ? 'fas fa-star active' : 'far fa-star'; 
        const newBadge = isNew(item.date) ? '<span class="new-badge">YENİ</span>' : ''; 
        const editIconHtml = (isAdminMode && isEditingActive) ? `<i class="fas fa-pencil-alt edit-icon" onclick="editContent(${index})"></i>` : ''; 
        let rawText = item.text || ""; 
        let formattedText = rawText.replace(/\n/g, '<br>').replace(/\*(.*?)\*/g, '<b>$1</b>'); 
        let html = `<div class="card ${item.category}">${newBadge}
            <div class="icon-wrapper">${editIconHtml}<i class="${favClass} fav-icon" onclick="toggleFavorite('${safeTitle}')"></i></div>
            <div class="card-header"><h3 class="card-title">${highlightText(item.title)}</h3><span class="badge">${item.category}</span></div>
            <div class="card-content" onclick="showCardDetail('${safeTitle}', '${escapeForJsString(item.text)}')"><div class="card-text-truncate">${highlightText(formattedText)}</div><div style="font-size:0.8rem; color:#999; margin-top:5px; text-align:right;">(Tamamını oku)</div></div>
            <div class="script-box">${highlightText(item.script)}</div>
            <div class="card-actions"><button class="btn btn-copy" onclick="copyText('${escapeForJsString(item.script)}')"><i class="fas fa-copy"></i> Kopyala</button>${item.code ? `<button class="btn btn-copy" style="background:var(--secondary); color:#333;" onclick="copyText('${escapeForJsString(item.code)}')">Kod</button>` : ''}${item.link ? `<a href="${item.link}" target="_blank" class="btn btn-link"><i class="fas fa-external-link-alt"></i> Link</a>` : ''}</div>
        </div>`; 
        container.innerHTML += html; 
    }); 
}

function highlightText(htmlContent) { if (!htmlContent) return ""; const searchTerm = document.getElementById('searchInput').value.trim(); if (!searchTerm) return htmlContent; const regex = new RegExp(`(${searchTerm})(?![^<]*>|[^<>]*<\/)`, "gi"); return htmlContent.replace(regex, '<span class="highlight">$1</span>'); }
function showCardDetail(title, text) { Swal.fire({ title: title, html: `<div style="text-align:left; font-size:1rem; line-height:1.6;">${text.replace(/\\n/g,'<br>')}</div>`, showCloseButton: true, showConfirmButton: false, width: '600px', background: '#f8f9fa' }); }
function filterContent() { const search = document.getElementById('searchInput').value.toLowerCase(); let filtered = database; if (currentCategory === 'fav') { filtered = filtered.filter(i => isFav(i.title)); } else if (currentCategory !== 'all') { filtered = filtered.filter(i => i.category === currentCategory); } if (search) { filtered = filtered.filter(i => (i.title && i.title.toLowerCase().includes(search)) || (i.text && i.text.toLowerCase().includes(search)) ); } renderCards(filtered); }
function filterCategory(btn, cat) { currentCategory = cat; document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); filterContent(); }
function copyText(t) { navigator.clipboard.writeText(t.replace(/\\n/g, '\n')).then(() => Swal.fire({icon:'success', title:'Kopyalandı', toast:true, position:'top-end', showConfirmButton:false, timer:1500}) ); }

function toggleEditMode() { 
    if (!isAdminMode) return; 
    isEditingActive = !isEditingActive; 
    document.body.classList.toggle('editing', isEditingActive); 
    const btn = document.getElementById('quickEditBtn'); 
    if(isEditingActive) { 
        btn.classList.add('active'); btn.innerHTML = '<i class="fas fa-times"></i> Düzenlemeyi Kapat'; 
        Swal.fire({ icon: 'success', title: 'Düzenleme Modu AÇIK', text: 'Kalem ikonlarına tıklayarak içerikleri düzenleyebilirsiniz.', timer: 1500, showConfirmButton: false }); 
    } else { 
        btn.classList.remove('active'); btn.innerHTML = '<i class="fas fa-pencil-alt"></i> Düzenlemeyi Aç'; 
    } 
    if (currentCategory === 'fav') filterCategory(document.querySelector('.btn-fav'), 'fav'); else renderCards(activeCards.length > 0 ? activeCards : database); 
    if(document.getElementById('guide-modal').style.display === 'flex') openGuide(); 
    if(document.getElementById('sales-modal').style.display === 'flex') openSales(); 
    if(document.getElementById('news-modal').style.display === 'flex') openNews(); 
}

function sendUpdate(o, c, v, t='card') { if (!Swal.isVisible()) Swal.fire({ title: 'Kaydediliyor...', didOpen: () => { Swal.showLoading() } }); fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: "updateContent", title: o, column: c, value: v, type: t, originalText: o, username: currentUser, token: getToken() }) }).then(r => r.json()).then(data => { if (data.result === "success") { Swal.fire({icon: 'success', title: 'Başarılı', timer: 1500, showConfirmButton: false}); setTimeout(loadContentData, 1600); } else { Swal.fire('Hata', 'Kaydedilemedi: ' + (data.message || 'Bilinmeyen Hata'), 'error'); } }).catch(err => Swal.fire('Hata', 'Sunucu hatası.', 'error')); }

// --- CRUD & EDİT FONKSİYONLARI ---
async function addNewCardPopup() {
    const catSelectHTML = getCategorySelectHtml('Bilgi', 'swal-new-cat');
    const { value: formValues } = await Swal.fire({
        title: 'Yeni İçerik Ekle',
        html: `
            <div style="margin-bottom:15px; text-align:left;">
                <label style="font-weight:bold; font-size:0.9rem;">Ne Ekleyeceksin?</label>
                <select id="swal-type-select" class="swal2-input" style="width:100%; margin-top:5px; height:35px; font-size:0.9rem;" onchange="toggleAddFields()"><option value="card">📌 Bilgi Kartı</option><option value="news">📢 Duyuru</option><option value="sales">📞 Telesatış Scripti</option><option value="sport">🏆 Spor İçeriği</option></select>
            </div>
            <div id="preview-card" class="card Bilgi" style="text-align:left; box-shadow:none; border:1px solid #e0e0e0; margin-top:10px;">
                <div class="card-header" style="align-items: center; gap: 10px;"><input id="swal-new-title" class="swal2-input" style="margin:0; height:40px; flex-grow:1; border:none; border-bottom:2px solid #eee; padding:0 5px; font-weight:bold; color:#0e1b42;" placeholder="Başlık..."><div id="cat-container" style="width: 110px;">${catSelectHTML}</div></div>
                <div class="card-content" style="margin-bottom:10px;"><textarea id="swal-new-text" class="swal2-textarea" style="margin:0; width:100%; box-sizing:border-box; border:none; resize:none; font-family:inherit; min-height:100px; padding:10px; background:#f9f9f9;" placeholder="İçerik metni..."></textarea></div>
                <div id="script-container" class="script-box" style="padding:0; border:1px solid #f0e68c;"><textarea id="swal-new-script" class="swal2-textarea" style="margin:0; width:100%; box-sizing:border-box; border:none; background:transparent; font-style:italic; min-height:80px; font-size:0.9rem;" placeholder="Script metni..."></textarea></div>
                <div id="extra-container" class="card-actions" style="margin-top:15px; display:grid; grid-template-columns: 1fr 1fr; gap:10px;"><div style="position:relative;"><i class="fas fa-code" style="position:absolute; left:10px; top:10px; color:#aaa;"></i><input id="swal-new-code" class="swal2-input" style="margin:0; height:35px; font-size:0.85rem; padding-left:30px;" placeholder="Kod"></div><div style="position:relative;"><i class="fas fa-link" style="position:absolute; left:10px; top:10px; color:#aaa;"></i><input id="swal-new-link" class="swal2-input" style="margin:0; height:35px; font-size:0.85rem; padding-left:30px;" placeholder="Link"></div></div>
                <div id="sport-extra" style="display:none; padding:10px;"><label>Kısa Açıklama</label><input id="swal-sport-tip" class="swal2-input"><label>Detay</label><input id="swal-sport-detail" class="swal2-input"><label>Okunuşu</label><input id="swal-sport-pron" class="swal2-input"><label>İkon</label><input id="swal-sport-icon" class="swal2-input"></div>
                <div id="news-extra" style="display:none; padding:10px;"><label>Duyuru Tipi</label><select id="swal-news-type" class="swal2-input"><option value="info">Bilgi</option><option value="update">Değişiklik</option><option value="fix">Çözüldü</option></select><label>Durum</label><select id="swal-news-status" class="swal2-input"><option value="Aktif">Aktif</option><option value="Pasif">Pasif</option></select></div>
            </div>`,
        width: '700px', showCancelButton: true, confirmButtonText: '<i class="fas fa-plus"></i> Ekle', cancelButtonText: 'İptal', focusConfirm: false,
        didOpen: () => {
            const selectEl = document.getElementById('swal-new-cat'); const cardEl = document.getElementById('preview-card');
            selectEl.addEventListener('change', function() { cardEl.className = 'card ' + this.value; });
            window.toggleAddFields = function() {
                const type = document.getElementById('swal-type-select').value;
                const catCont = document.getElementById('cat-container'); const scriptCont = document.getElementById('script-container'); const extraCont = document.getElementById('extra-container');
                const sportExtra = document.getElementById('sport-extra'); const newsExtra = document.getElementById('news-extra'); const cardPreview = document.getElementById('preview-card');
                catCont.style.display = 'none'; scriptCont.style.display = 'none'; extraCont.style.display = 'none'; sportExtra.style.display = 'none'; newsExtra.style.display = 'none';
                cardPreview.style.borderLeft = "5px solid var(--info)"; cardPreview.className = 'card Bilgi'; 
                if (type === 'card') { catCont.style.display = 'block'; scriptCont.style.display = 'block'; extraCont.style.display = 'grid'; cardPreview.className = 'card ' + document.getElementById('swal-new-cat').value; } 
                else if (type === 'sales') { scriptCont.style.display = 'block'; cardPreview.style.borderLeft = "5px solid var(--sales)"; } 
                else if (type === 'sport') { sportExtra.style.display = 'block'; cardPreview.style.borderLeft = "5px solid var(--primary)"; } 
                else if (type === 'news') { newsExtra.style.display = 'block'; cardPreview.style.borderLeft = "5px solid var(--secondary)"; }
            };
        },
        preConfirm: () => {
            return { cardType: document.getElementById('swal-type-select').value, category: document.getElementById('swal-new-cat').value, title: document.getElementById('swal-new-title').value, text: document.getElementById('swal-new-text').value, script: document.getElementById('swal-new-script').value, code: document.getElementById('swal-new-code').value, status: document.getElementById('swal-news-status').value, link: document.getElementById('swal-new-link').value, tip: document.getElementById('swal-sport-tip').value, detail: document.getElementById('swal-sport-detail').value, pronunciation: document.getElementById('swal-sport-pron').value, icon: document.getElementById('swal-sport-icon').value, date: new Date().toLocaleDateString("tr-TR") }
        }
    });
    if (formValues) {
        if(!formValues.title) { Swal.fire('Hata', 'Başlık zorunlu!', 'error'); return; }
        Swal.fire({ title: 'Ekleniyor...', didOpen: () => { Swal.showLoading() } });
        fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: "addCard", username: currentUser, token: getToken(), ...formValues }) })
        .then(response => response.json()).then(data => { if (data.result === "success") { Swal.fire({icon: 'success', title: 'Başarılı', timer: 2000, showConfirmButton: false}); setTimeout(loadContentData, 3500); } else { Swal.fire('Hata', data.message, 'error'); } });
    }
}

async function editContent(index) {
    const item = activeCards[index]; const catSelectHTML = getCategorySelectHtml(item.category, 'swal-cat');
    const { value: formValues } = await Swal.fire({
        title: 'Kartı Düzenle',
        html: `<div class="card ${item.category}" style="text-align:left;"><input id="swal-title" class="swal2-input" style="width:100%; font-weight:bold;" value="${item.title}">${catSelectHTML}<textarea id="swal-text" class="swal2-textarea" placeholder="İçerik...">${(item.text||'').replace(/<br>/g,'\n')}</textarea><textarea id="swal-script" class="swal2-textarea" placeholder="Script...">${(item.script||'').replace(/<br>/g,'\n')}</textarea><input id="swal-code" class="swal2-input" value="${item.code||''}" placeholder="Kod"><input id="swal-link" class="swal2-input" value="${item.link||''}" placeholder="Link"></div>`,
        width: '700px', showCancelButton: true, confirmButtonText: 'Kaydet', preConfirm: () => ({ cat: document.getElementById('swal-cat').value, title: document.getElementById('swal-title').value, text: document.getElementById('swal-text').value, script: document.getElementById('swal-script').value, code: document.getElementById('swal-code').value, link: document.getElementById('swal-link').value })
    });
    if (formValues) {
        if(formValues.cat !== item.category) sendUpdate(item.title, "Category", formValues.cat);
        if(formValues.text !== (item.text || '').replace(/<br>/g,'\n')) setTimeout(() => sendUpdate(item.title, "Text", formValues.text), 500);
        if(formValues.script !== (item.script || '').replace(/<br>/g,'\n')) setTimeout(() => sendUpdate(item.title, "Script", formValues.script), 1000);
        if(formValues.title !== item.title) setTimeout(() => sendUpdate(item.title, "Title", formValues.title), 2500);
    }
}

async function editSport(title) {
    event.stopPropagation(); const s = sportsData.find(item => item.title === title);
    if (!s) return;
    const { value: formValues } = await Swal.fire({
        title: 'Spor Düzenle',
        html: `<input id="swal-title" class="swal2-input" value="${s.title}"><textarea id="swal-desc" class="swal2-textarea">${s.desc||''}</textarea><input id="swal-tip" class="swal2-input" value="${s.tip||''}"><textarea id="swal-detail" class="swal2-textarea">${s.detail||''}</textarea><input id="swal-pron" class="swal2-input" value="${s.pronunciation||''}"><input id="swal-icon" class="swal2-input" value="${s.icon||''}">`,
        width: '600px', showCancelButton: true, confirmButtonText: 'Kaydet', preConfirm: () => [ document.getElementById('swal-title').value, document.getElementById('swal-desc').value, document.getElementById('swal-tip').value, document.getElementById('swal-detail').value, document.getElementById('swal-pron').value, document.getElementById('swal-icon').value ]
    });
    if (formValues) { sendUpdate(s.title, "Text", formValues[1], 'sport'); setTimeout(() => sendUpdate(s.title, "Title", formValues[0], 'sport'), 1000); }
}

async function editSales(title) {
    event.stopPropagation(); const s = salesScripts.find(item => item.title === title);
    if (!s) return;
    const { value: formValues } = await Swal.fire({ title: 'Satış Düzenle', html: `<input id="swal-title" class="swal2-input" value="${s.title}"><textarea id="swal-text" class="swal2-textarea">${s.text||''}</textarea>`, preConfirm: () => [document.getElementById('swal-title').value, document.getElementById('swal-text').value] });
    if(formValues) { sendUpdate(s.title, "Text", formValues[1], 'sales'); }
}

async function editNews(index) {
    const i = newsData[index];
    const { value: formValues } = await Swal.fire({ title: 'Duyuru Düzenle', html: `<input id="swal-title" class="swal2-input" value="${i.title}"><input id="swal-date" class="swal2-input" value="${i.date}"><textarea id="swal-desc" class="swal2-textarea">${i.desc}</textarea><select id="swal-status" class="swal2-input"><option value="Aktif">Aktif</option><option value="Pasif">Pasif</option></select>`, preConfirm: () => [document.getElementById('swal-title').value, document.getElementById('swal-date').value, document.getElementById('swal-desc').value, document.getElementById('swal-status').value] });
    if(formValues) { sendUpdate(i.title, "Text", formValues[2], 'news'); setTimeout(() => sendUpdate(i.title, "Status", formValues[3], 'news'), 1000); }
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }
let tickerIndex = 0;
function startTicker() { const t = document.getElementById('ticker-content'); const activeNews = newsData.filter(i => i.status !== 'Pasif'); if(activeNews.length === 0) { t.innerHTML = "Güncel duyuru yok."; return; } function showNext() { const i = activeNews[tickerIndex]; t.style.animation = 'none'; t.offsetHeight; t.style.animation = 'slideIn 0.5s ease-out'; t.innerHTML = `<strong>${i.date}:</strong> ${i.title} - ${i.desc}`; tickerIndex = (tickerIndex + 1) % activeNews.length; } showNext(); setInterval(showNext, 60000); }
function openNews() { document.getElementById('news-modal').style.display = 'flex'; const c = document.getElementById('news-container'); c.innerHTML = ''; newsData.forEach((i, index) => { let editBtn = (isAdminMode && isEditingActive) ? `<i class="fas fa-pencil-alt edit-icon" style="top:0; right:0;" onclick="event.stopPropagation(); editNews(${index})"></i>` : ''; c.innerHTML += `<div class="news-item">${editBtn}<span class="news-date">${i.date}</span><span class="news-title">${i.title}</span><div class="news-desc">${i.desc}</div></div>`; }); }
function openGuide() { document.getElementById('guide-modal').style.display = 'flex'; const grid = document.getElementById('guide-grid'); grid.innerHTML = ''; sportsData.forEach((s, index) => { let editBtn = (isAdminMode && isEditingActive) ? `<i class="fas fa-pencil-alt edit-icon" style="top:5px; right:5px;" onclick="event.stopPropagation(); editSport('${escapeForJsString(s.title)}')"></i>` : ''; grid.innerHTML += `<div class="guide-item" onclick="showSportDetail(${index})">${editBtn}<i class="fas ${s.icon} guide-icon"></i><span class="guide-title">${s.title}</span><div class="guide-desc">${s.desc}</div></div>`; }); }
function showSportDetail(index) { const sport = sportsData[index]; Swal.fire({ title: sport.title, html: `<div style="text-align:left;">${sport.detail||''}</div>` }); }
function openSales() { document.getElementById('sales-modal').style.display = 'flex'; const c = document.getElementById('sales-grid'); c.innerHTML = ''; salesScripts.forEach((s, index) => { let editBtn = (isAdminMode && isEditingActive) ? `<i class="fas fa-pencil-alt edit-icon" style="top:10px; right:40px;" onclick="event.stopPropagation(); editSales('${escapeForJsString(s.title)}')"></i>` : ''; c.innerHTML += `<div class="sales-item" id="sales-${index}" onclick="toggleSales('${index}')">${editBtn}<div class="sales-header"><span class="sales-title">${s.title}</span></div><div class="sales-text">${s.text}</div></div>`; }); }
function toggleSales(index) { document.getElementById(`sales-${index}`).classList.toggle('active'); }

// --- KALİTE YÖNETİMİ ---
function populateMonthFilter() { const s = document.getElementById('month-select-filter'); s.innerHTML = ''; const now = new Date(); for(let i=0; i<6; i++) { let m = (now.getMonth() - i + 12) % 12; let y = now.getFullYear() - (now.getMonth() - i < 0 ? 1 : 0); let val = `${(m+1).toString().padStart(2,'0')}.${y}`; s.innerHTML += `<option value="${val}" ${i===0?'selected':''}>${MONTH_NAMES[m]} ${y}</option>`; } }

function openQualityArea() {
    document.getElementById('quality-modal').style.display = 'flex';
    document.getElementById('admin-quality-controls').style.display = isAdminMode ? 'block' : 'none';
    populateMonthFilter();
    
    // Filtre değişikliğini dinle
    const mSelect = document.getElementById('month-select-filter');
    const newSelect = mSelect.cloneNode(true);
    mSelect.parentNode.replaceChild(newSelect, mSelect);
    newSelect.addEventListener('change', () => fetchEvaluationsForAgent(isAdminMode ? document.getElementById('agent-select-admin').value : currentUser));

    if (isAdminMode) {
        fetchUserListForAdmin().then(users => {
            const sel = document.getElementById('agent-select-admin');
            sel.innerHTML = users.map(u => `<option value="${u.name}" data-group="${u.group}">${u.name} (${u.group})</option>`).join('');
            if(users.length>0) sel.value = users[0].name;
            sel.onchange = function() { fetchEvaluationsForAgent(this.value); };
            fetchEvaluationsForAgent(sel.value);
        });
    } else { fetchEvaluationsForAgent(currentUser); }
}

async function fetchEvaluationsForAgent(forcedName) {
    const listEl = document.getElementById('evaluations-list');
    const loader = document.getElementById('quality-loader');
    listEl.innerHTML = ''; loader.style.display = 'block';
    
    let targetAgent = forcedName || (isAdminMode ? document.getElementById('agent-select-admin').value : currentUser);
    const selectedMonth = document.getElementById('month-select-filter').value;

    const response = await fetch(SCRIPT_URL, { method: 'POST', headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "fetchEvaluations", targetAgent: targetAgent, username: currentUser, token: getToken() }) });
    const data = await response.json();
    loader.style.display = 'none';

    if (data.result === "success") {
        allEvaluationsData = data.evaluations;
        const filtered = allEvaluationsData.filter(e => e.date.includes(selectedMonth));
        
        // İstatistikler
        const total = filtered.reduce((sum, e) => sum + (parseFloat(e.score)||0), 0);
        const avg = filtered.length > 0 ? Math.round(total / filtered.length) : 0;
        document.getElementById('eval-count-span').innerText = `Adet: ${filtered.length}`;
        document.getElementById('monthly-avg-span').innerText = `Ort: ${avg}%`;

        if(filtered.length === 0) { listEl.innerHTML = '<div style="text-align:center;">Kayıt yok.</div>'; return; }

        filtered.reverse().forEach((eval, index) => {
            const color = eval.score >= 90 ? '#2e7d32' : (eval.score >= 70 ? '#ed6c02' : '#d32f2f');
            let detailHtml = '';
            try { JSON.parse(eval.details).forEach(d => { detailHtml += `<div>${d.q}: <b>${d.score}/${d.max}</b> ${d.note?`(${d.note})`:''}</div>`; }); } catch(e){ detailHtml=eval.details; }
            
            // --- TARİH VE FORMAT DÜZELTMESİ (GÜNCELLENDİ) ---
            let displayCallDate = formatDateToDDMMYYYY(eval.callDate);
            
            // DÜZENLEME BUTONU (CALL ID İLE)
            let editBtn = isAdminMode ? `<i class="fas fa-edit" style="float:right; cursor:pointer; color:#1976d2;" onclick="event.stopPropagation(); editEvaluation('${eval.callId}')"></i>` : '';
            
            // --- KART GÖRÜNÜMÜ GÜNCELLENDİ (ÇAĞRI TARİHİ ÜSTTE) ---
            listEl.innerHTML += `<div class="evaluation-summary" style="border-left:5px solid ${color}; padding:10px; margin-bottom:10px; background:#fff;" onclick="toggleEvaluationDetail(${index})">
                ${editBtn}
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-weight:bold; font-size:1.1rem; color:var(--primary);">
                            <i class="far fa-calendar-alt"></i> ${displayCallDate}
                        </span>
                        <span style="font-size:0.75rem; color:#888; margin-top:3px;">
                            (Çağrı Tarihi)
                        </span>
                        <span style="font-size:0.75rem; color:#aaa; margin-top:2px;">
                            Log: ${eval.date} - Call ID: ${eval.callId}
                        </span>
                    </div>
                    <div style="font-weight:bold; color:${color}; font-size:1.4rem;">${eval.score}</div>
                </div>
                <div id="eval-details-${index}" style="display:none; margin-top:10px; border-top:1px dashed #ccc; padding-top:5px;">${detailHtml}<br><b>Yorum:</b> ${eval.feedback}</div>
            </div>`;
        });
    }
}

// --- DÜZENLEME FONKSİYONU (CALL ID İLE & YEDEK MANTIKLI) ---
async function editEvaluation(targetCallId) {
    const evalData = allEvaluationsData.find(i => i.callId == targetCallId);
    if (!evalData) { Swal.fire('Hata', 'Kayıt bulunamadı.', 'error'); return; }

    const agentName = evalData.agent || evalData.agentName;
    const selectEl = document.getElementById('agent-select-admin');
    if(selectEl) { 
        const opt = Array.from(selectEl.options).find(o => o.value === agentName);
        if(opt) selectEl.value = agentName; 
    }
    const group = evalData.group || 'Genel';

    Swal.fire({ title: 'Hazırlanıyor...', didOpen: () => Swal.showLoading() });
    let criteriaList = [];
    if(group === 'Telesatış' || group === 'Chat') criteriaList = await fetchCriteria(group);
    Swal.close();

    const isCriteriaBased = criteriaList.length > 0;
    let oldDetails = []; try { oldDetails = JSON.parse(evalData.details); } catch(e) {}

    let html = `<div style="text-align:left;">
        <label>Call ID</label><input id="eval-callid" class="swal2-input" value="${evalData.callId}" readonly style="background:#eee;">
        <label>Çağrı Tarihi</label><input class="swal2-input" value="${formatDateToDDMMYYYY(evalData.callDate)}" readonly style="background:#eee;">
        <div id="score-ring" style="width:50px; height:50px; border-radius:50%; background:#ccc; margin:10px auto; line-height:50px; text-align:center; font-weight:bold; color:white;">0</div>
    `;

    if(isCriteriaBased) {
        html += '<div style="max-height:300px; overflow-y:auto;">';
        criteriaList.forEach((c, i) => {
            html += `<div style="margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;">
                <div>${c.text} (Max: ${c.points})</div>
                <input type="range" class="slider-input" id="slider-${i}" min="0" max="${c.points}" style="width:100%;" oninput="updateRowScore(${i}, ${c.points})">
                <span id="badge-${i}" style="float:right; font-weight:bold;">0</span>
                <input id="note-${i}" class="swal2-input" placeholder="Not..." style="display:none; height:30px; margin-top:5px;">
            </div>`;
        });
        html += '</div>';
    } else {
        html += `<label>Puan</label><input id="eval-manual-score" type="number" class="swal2-input" value="${evalData.score}"><textarea id="eval-details" class="swal2-textarea">${evalData.details}</textarea>`;
    }
    html += `<label>Yorum</label><textarea id="eval-feedback" class="swal2-textarea">${evalData.feedback}</textarea></div>`;

    const { value: formValues } = await Swal.fire({
        title: 'Düzenle: ' + agentName,
        html: html,
        width: '600px',
        showCancelButton: true,
        confirmButtonText: 'Güncelle',
        didOpen: () => {
            document.getElementById('eval-feedback').value = evalData.feedback || ''; 
            
            if(isCriteriaBased) {
                criteriaList.forEach((c, i) => {
                    let oldItem = oldDetails.find(d => d.q === c.text);
                    if(!oldItem && oldDetails[i]) oldItem = oldDetails[i]; 
                    if(!oldItem) oldItem = { score: c.points, note: '' };
                    
                    const sl = document.getElementById(`slider-${i}`);
                    const nt = document.getElementById(`note-${i}`);
                    
                    sl.value = oldItem.score;
                    nt.value = oldItem.note || '';
                    if(oldItem.score < c.points) nt.style.display='block';
                    
                    window.updateRowScore(i, c.points);
                });
                window.recalcTotalScore();
            }
        },
        preConfirm: () => {
            if(isCriteriaBased) {
                let total = 0, details = [];
                criteriaList.forEach((c, i) => {
                    let s = parseInt(document.getElementById(`slider-${i}`).value);
                    let n = document.getElementById(`note-${i}`).value;
                    total += s;
                    details.push({ q: c.text, max: c.points, score: s, note: n });
                });
                return { agentName, callId: evalData.callId, score: total, details: JSON.stringify(details), feedback: document.getElementById('eval-feedback').value, callDate: evalData.callDate };
            }
            return { agentName, callId: evalData.callId, score: document.getElementById('eval-manual-score').value, details: document.getElementById('eval-details').value, feedback: document.getElementById('eval-feedback').value, callDate: evalData.callDate };
        }
    });

    if(formValues) {
        Swal.fire({ title: 'Güncelleniyor...', didOpen: () => Swal.showLoading() });
        fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: "updateEvaluation", username: currentUser, token: getToken(), ...formValues }) })
        .then(r => r.json()).then(d => {
            if(d.result === "success") { Swal.fire('Başarılı', 'Güncellendi.', 'success'); fetchEvaluationsForAgent(agentName); }
            else { Swal.fire('Hata', d.message, 'error'); }
        });
    }
}

// ... Diğer standart fonksiyonlar (fetchUserListForAdmin, fetchCriteria, vb.) aynı kalabilir ...
// Eksik kalan yardımcılar:
function fetchUserListForAdmin() { return fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "getUserList", username: currentUser, token: getToken() }) }).then(r=>r.json()).then(d=>d.users||[]); }
function fetchCriteria(g) { return fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "getCriteria", group: g, username: currentUser, token: getToken() }) }).then(r=>r.json()).then(d=>d.criteria||[]); }
function toggleEvaluationDetail(i) { const d = document.getElementById(`eval-details-${i}`); d.style.display = d.style.display === 'none' ? 'block' : 'none'; }
// ... (LogEvaluationPopup, PenaltyGame, Wizard vb. önceki kodlardan aynen devam eder) ...
const wizardSteps={ start:{title:"İade Talebi Analizi",text:"Lütfen müşterinin durumunu seçiniz:",options:[ {text:"İçerik İzlemiş / Kullanım Var",next:"izleme_var"}, {text:"Aylık Paket (İzleme YOK)",next:"aylik_izleme_yok"}, {text:"Yıllık Paket (İzleme YOK)",next:"yillik_izleme_yok"}, {text:"Mükerrer (Çift) Çekim",next:"mukerrer"}, {text:"Aynı Gün Yanlışlıkla Yıllık Alım",next:"ayni_gun_yillik"}, {text:"Apple / Google Store İptali",next:"store_iptal"}, {text:"Winback Paket Geçiş İadesi",next:"winback_iade"} ]}, izleme_var:{result:"red",title:"❌ İADE REDDEDİLİR",text:"İçerik izlenmişse (genel arıza hariç) iade yapılmaz.",script:"Hizmetimizden aktif olarak faydalandığınız için iade prosedürlerimiz gereği talebinize olumlu yanıt veremiyoruz."}, aylik_izleme_yok:{title:"Aylık Paket - İzleme Yok",text:"THH tehdidi var mı?",options:[{text:"Evet/Israrcı",next:"aylik_teklif"},{text:"Hayır",next:"izleme_var"}]}, aylik_teklif:{title:"İndirim Teklifi",text:"Önce 6AY50 ile indirim teklif et.",options:[{text:"İndirimi Kabul Etti",next:"indirim_kabul"},{text:"Reddetti (Tam İade)",next:"tam_iade"}]}, yillik_izleme_yok:{title:"Yıllık Paket",text:"Paket kampanyalı mıydı?",options:[{text:"Hayır (Standart)",next:"yillik_standart"},{text:"Evet (Kampanyalı)",next:"yillik_kampanyali"}]}, yillik_standart:{title:"Standart Yıllık",text:"Sırasıyla: 1. YILLIKLOCA İndirimi, 2. Aylığa Geçiş öner.",options:[{text:"Teklifi Kabul Etti",next:"islem_tamam"},{text:"Hepsini Reddetti (Tam İade)",next:"tam_iade"}]}, yillik_kampanyali:{title:"Kampanyalı Yıllık",text:"Sadece Aylığa Geçiş önerilebilir.",options:[{text:"Aylığa Geçişi Kabul Etti",next:"ayliga_gecis"},{text:"Reddetti (Tam İade)",next:"tam_iade"}]}, mukerrer:{title:"Mükerrer Çekim",text:"15 gün içinde ve Aynı Cihaz/IP mi?",options:[{text:"Evet",next:"mukerrer_iade"},{text:"Hayır",next:"izleme_var"}]}, ayni_gun_yillik:{title:"Aynı Gün Yıllık",text:"24 saat içinde mi?",options:[{text:"Evet",next:"bir_defaya_mahsus"},{text:"Hayır",next:"izleme_var"}]}, store_iptal:{result:"red",title:"❌ BİZ İPTAL EDEMEYİZ",text:"Apple/Google alımları telefondan yapılmalı."}, winback_iade:{result:"yellow",title:"⚠️ SADECE 2. PAKET İADE",text:"Sadece son alınan indirimli paket iade edilebilir."}, indirim_kabul:{result:"green",title:"✅ İNDİRİM TANIMLA",text:"139.5 TL iade yapıldı."}, tam_iade:{result:"green",title:"✅ TAM İADE YAP",text:"Teklifler reddedildi, iade sağla."}, mukerrer_iade:{result:"green",title:"✅ MÜKERRER İADE",text:"Fazla paketi iade et."}, ayliga_gecis:{result:"green",title:"✅ AYLIK GEÇİŞ",text:"Yıllık iptal, aylık tanımla, farkı iade et."}, bir_defaya_mahsus:{result:"green",title:"✅ TEK SEFERLİK İADE",text:"Yıllık iade, aylık devam."}, islem_tamam:{result:"green",title:"✅ İŞLEM TAMAM",text:"Teklif kabul edildi."} };
function openWizard(){ document.getElementById('wizard-modal').style.display='flex'; renderStep('start'); }
function renderStep(k){ const s=wizardSteps[k]; const b=document.getElementById('wizard-body'); let h=`<h2>${s.title||''}</h2>`; if(s.result){ let i=s.result==='red'?'🛑':(s.result==='green'?'✅':'⚠️'); let c=s.result==='red'?'res-red':(s.result==='green'?'res-green':'res-yellow'); h+=`<div class="result-box ${c}"><div style="font-size:3rem;margin-bottom:10px;">${i}</div><h3>${s.title}</h3><p>${s.text}</p>${s.script?`<div class="script-box">${s.script}</div>`:''}</div><button class="restart-btn" onclick="renderStep('start')"><i class="fas fa-redo"></i> Başa Dön</button>`; }else{ h+=`<p>${s.text}</p><div class="wizard-options">`; s.options.forEach(o=>{ h+=`<button class="option-btn" onclick="renderStep('${o.next}')"><i class="fas fa-chevron-right"></i> ${o.text}</button>`; }); h+=`</div>`; if(k!=='start')h+=`<button class="restart-btn" onclick="renderStep('start')" style="background:#eee;color:#333;margin-top:15px;">Geri Dön</button>`; } b.innerHTML=h; }
