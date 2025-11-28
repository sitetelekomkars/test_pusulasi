// =======================================================
// === AYARLAR VE GÜVENLİ URL'LER ===
// =======================================================

const BAKIM_MODU = false; 

// Apps Script URL'si, tüm veri alışverişi bu güvenli URL üzerinden yapılır.
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzbocJrJPU7_u0lvlnBQ8CrQYHCfy22G6UU8jRo5s6Yrl4rpTQ_a7oB5Ttf_NkGsUOiQg/exec"; 

let jokers = { call: 1, half: 1, double: 1 };
let doubleChanceUsed = false;
let firstAnswerIndex = -1;
const VALID_CATEGORIES = ['Teknik', 'İkna', 'Kampanya', 'Bilgi'];
let database = [], newsData = [], sportsData = [], salesScripts = [], quizQuestions = [];
let currentUser = "", isAdminMode = false, isEditingActive = false, sessionTimeout; // isEditingActive eklendi
let activeCards = []; 
let currentCategory = 'all';
let adminUserList = []; 
let allEvaluationsData = []; 
const MONTH_NAMES = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];


// =======================================================
// === TEMEL YARDIMCI FONKSİYONLAR ===
// =======================================================

function getToken() { return localStorage.getItem("sSportToken"); }
function getFavs() { return JSON.parse(localStorage.getItem('sSportFavs') || '[]'); }
function toggleFavorite(title) { event.stopPropagation(); let favs = getFavs(); if (favs.includes(title)) { favs = favs.filter(t => t !== title); } else { favs.push(title); } localStorage.setItem('sSportFavs', JSON.stringify(favs)); if (currentCategory === 'fav') { filterCategory(document.querySelector('.btn-fav'), 'fav'); } else { renderCards(activeCards); } }
function isFav(title) { return getFavs().includes(title); }

/**
 * ISO veya ham tarih dizesini dd.mm.yyyy formatına çevirir.
 * Ticker'daki tarih sorununu çözer.
 */
function formatDateToDDMMYYYY(dateString) {
    if (!dateString) return 'N/A';
    if (dateString.match(/^\d{2}\.\d{2}\.\d{4}/)) {
        return dateString;
    }
    try {
        // ISO formatını düzgün işlemek için
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return dateString;
        }
        // Düzgün formatlama
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    } catch (e) {
        return dateString;
    }
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

// KRİTİK DÜZELTME: Admin girişi yapıldığında düzenleme modunun varsayılan olarak kapalı kalmasını sağlar.
function checkAdmin(role) { 
    const editBtn = document.getElementById('quickEditBtn'); 
    const addBtn = document.getElementById('addCardBtn'); 
    isAdminMode = (role === "admin"); 
    isEditingActive = false; // Yeni eklendi (Görünüm Durumu)

    // Her durumda editing sınıfını ve edit butonunun aktif görünümünü sıfırla
    document.body.classList.remove('editing'); 
    
    if (editBtn) {
        editBtn.classList.remove('active');
        editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i> Düzenlemeyi Aç'; // Buton metnini "Aç" olarak ayarla
    }

    // Rol bazlı buton görünürlüğü
    if(role === "admin") { 
        if (editBtn) editBtn.style.display = "flex"; 
        if (addBtn) addBtn.style.display = "flex"; 
    } else { 
        if (editBtn) editBtn.style.display = "none"; 
        if (addBtn) addBtn.style.display = "none"; 
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

// =======================================================
// === GÜVENLİ VERİ YÜKLEME FONKSİYONU (DÜZELTİLDİ) ===
// =======================================================

function loadContentData() { 
    // Yükleyiciyi göster
    document.getElementById('loading').style.display = 'block'; 

    // Apps Script'e fetchData eylemi ile istek gönderiliyor
    fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        // Apps Script'ten veriyi çekmek için Apps Script'e post ediyoruz.
        body: JSON.stringify({ action: "fetchData" }) 
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('loading').style.display = 'none'; // Yükleyiciyi gizle
        
        if (data.result === "success") {
            const rawData = data.data; // Apps Script'ten gelen doğrudan JSON verisi

            // Gelen JSON verisinin işlenmesi ve TARİH FORMATLAMA UYGULAMASI
            const fetchedCards = rawData.filter(i => ['card','bilgi','teknik','kampanya','ikna'].includes(i.Type)).map(i => ({ 
                title: i.Title, 
                category: i.Category, 
                text: i.Text, 
                script: i.Script, 
                code: i.Code, 
                link: i.Link, 
                date: formatDateToDDMMYYYY(i.Date) // KARTLAR için formatlama
            }));
            
            const fetchedNews = rawData.filter(i => i.Type === 'news').map(i => ({ 
                date: formatDateToDDMMYYYY(i.Date), // DUYURULAR için formatlama
                title: i.Title, 
                desc: i.Text, 
                type: i.Category, 
                status: i.Status 
            }));
            
            const fetchedSports = rawData.filter(i => i.Type === 'sport').map(i => ({ title: i.Title, icon: i.Icon, desc: i.Text, tip: i.Tip, detail: i.Detail, pronunciation: i.Pronunciation }));
            const fetchedSales = rawData.filter(i => i.Type === 'sales').map(i => ({ title: i.Title, text: i.Text }));
            const fetchedQuiz = rawData.filter(i => i.Type === 'quiz').map(i => ({ q: i.Text, opts: i.QuizOptions ? i.QuizOptions.split(',') : [], a: parseInt(i.QuizAnswer) }));

            // Global değişkenlere atama
            database = fetchedCards;
            newsData = fetchedNews;
            sportsData = fetchedSports;
            salesScripts = fetchedSales;
            quizQuestions = fetchedQuiz;
            
            // Kartları render et
            if(currentCategory === 'fav') { 
                filterCategory(document.querySelector('.btn-fav'), 'fav'); 
            } else { 
                activeCards = database; 
                renderCards(database); 
            } 
            startTicker();
            
        } else {
             // Apps Script'ten hata mesajı gelirse
             document.getElementById('loading').innerHTML = `Veriler alınamadı: ${data.message || 'Bilinmeyen Hata'}`;
        }
    })
    .catch(error => { 
        console.error("Fetch Hatası:", error);
        document.getElementById('loading').innerHTML = 'Bağlantı Hatası! Sunucuya ulaşılamıyor.';
    }); 
}
// =======================================================
// === DİĞER FONKSİYONLAR (DEĞİŞTİRİLMEDİ) ===
// =======================================================
function renderCards(data) { 
    activeCards = data; 
    const container = document.getElementById('cardGrid'); 
    container.innerHTML = ''; 
    
    if (data.length === 0) { 
        container.innerHTML = '<div style="grid-column:1/-1; text-align:center;">Kayıt Yok / Bulunamadı</div>'; 
        return; 
    } 
    
    data.forEach((item, index) => { 
        const safeTitle = escapeForJsString(item.title); 
        const isFavorite = isFav(item.title); 
        const favClass = isFavorite ? 'fas fa-star active' : 'far fa-star'; 
        const newBadge = isNew(item.date) ? '<span class="new-badge">YENİ</span>' : ''; 
        
        // ADMIN KONTROLÜ: Sadece isAdminMode true ise edit ikonunu oluştur (Görünürlüğü CSS'e bırakılır).
        const editIconHtml = isAdminMode 
            ? `<i class="fas fa-pencil-alt edit-icon" onclick="editContent(${index})"></i>` 
            : ''; // Admin değilse boş dize gönder
        
        let rawText = item.text || ""; 
        let formattedText = rawText.replace(/\n/g, '<br>').replace(/\*(.*?)\*/g, '<b>$1</b>'); 
        
        let html = `<div class="card ${item.category}">${newBadge}
            <div class="icon-wrapper">
                ${editIconHtml} 
                <i class="${favClass} fav-icon" onclick="toggleFavorite('${safeTitle}')"></i>
            </div>
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
    const editBtn = document.getElementById('quickEditBtn');
    
    if (!isAdminMode) return; 

    isEditingActive = !isEditingActive; // isEditingActive durumunu değiştir
    document.body.classList.toggle('editing', isEditingActive); // CSS sınıfını güncelle

    if (isEditingActive) {
        editBtn.classList.add('active');
        editBtn.innerHTML = '<i class="fas fa-times"></i> Düzenlemeyi Kapat';
        Swal.fire({ icon: 'success', title: 'Düzenleme Modu AÇIK', text: 'Kalem ikonlarına tıklayarak içerikleri düzenleyebilirsiniz.', timer: 1500, showConfirmButton: false });
    } else {
        editBtn.classList.remove('active');
        editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i> Düzenlemeyi Aç';
        Swal.fire({ icon: 'error', title: 'Düzenleme Modu KAPALI', timer: 1000, showConfirmButton: false });
    } 

    if (currentCategory === 'fav') filterCategory(document.querySelector('.btn-fav'), 'fav'); 
    else renderCards(activeCards.length > 0 ? activeCards : database); 
    
    if(document.getElementById('guide-modal').style.display === 'flex') openGuide(); 
    if(document.getElementById('sales-modal').style.display === 'flex') openSales(); 
    if(document.getElementById('news-modal').style.display === 'flex') openNews(); 
}

function sendUpdate(o, c, v, t='card') { if (!Swal.isVisible()) Swal.fire({ title: 'Kaydediliyor...', didOpen: () => { Swal.showLoading() } }); fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: "updateContent", title: o, column: c, value: v, type: t, originalText: o, username: currentUser, token: getToken() }) }).then(r => r.json()).then(data => { if (data.result === "success") { Swal.fire({icon: 'success', title: 'Başarılı', timer: 1500, showConfirmButton: false}); setTimeout(loadContentData, 1600); } else { Swal.fire('Hata', 'Kaydedilemedi: ' + (data.message || 'Bilinmeyen Hata'), 'error'); } }).catch(err => Swal.fire('Hata', 'Sunucu hatası.', 'error')); }

// --- CRUD FONKSİYONLARI ---
async function addNewCardPopup() {
    const catSelectHTML = getCategorySelectHtml('Bilgi', 'swal-new-cat');
    const { value: formValues } = await Swal.fire({
        title: 'Yeni İçerik Ekle',
        html: `
            <div style="margin-bottom:15px; text-align:left;">
                <label style="font-weight:bold; font-size:0.9rem;">Ne Ekleyeceksin?</label>
                <select id="swal-type-select" class="swal2-input" style="width:100%; margin-top:5px; height:35px; font-size:0.9rem;" onchange="toggleAddFields()">
                    <option value="card">📌 Bilgi Kartı</option>
                    <option value="news">📢 Duyuru</option>
                    <option value="sales">📞 Telesatış Scripti</option>
                    <option value="sport">🏆 Spor İçeriği</option>
                </select>
            </div>
            <div id="preview-card" class="card Bilgi" style="text-align:left; box-shadow:none; border:1px solid #e0e0e0; margin-top:10px;">
                <div class="card-header" style="align-items: center; gap: 10px;">
                    <input id="swal-new-title" class="swal2-input" style="margin:0; height:40px; flex-grow:1; border:none; border-bottom:2px solid #eee; padding:0 5px; font-weight:bold; color:#0e1b42;" placeholder="Başlık Giriniz...">
                    <div id="cat-container" style="width: 110px;">${catSelectHTML}</div>
                </div>
                <div class="card-content" style="margin-bottom:10px;">
                    <textarea id="swal-new-text" class="swal2-textarea" style="margin:0; width:100%; box-sizing:border-box; border:none; resize:none; font-family:inherit; min-height:100px; padding:10px; background:#f9f9f9;" placeholder="İçerik metni..."></textarea>
                </div>
                <div id="script-container" class="script-box" style="padding:0; border:1px solid #f0e68c;">
                    <textarea id="swal-new-script" class="swal2-textarea" style="margin:0; width:100%; box-sizing:border-box; border:none; background:transparent; font-style:italic; min-height:80px; font-size:0.9rem;" placeholder="Script metni (İsteğe bağlı)..."></textarea>
                </div>
                <div id="extra-container" class="card-actions" style="margin-top:15px; display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    <div style="position:relative;"><i class="fas fa-code" style="position:absolute; left:10px; top:10px; color:#aaa;"></i><input id="swal-new-code" class="swal2-input" style="margin:0; height:35px; font-size:0.85rem; padding-left:30px;" placeholder="Kod"></div>
                    <div style="position:relative;"><i class="fas fa-link" style="position:absolute; left:10px; top:10px; color:#aaa;"></i><input id="swal-new-link" class="swal2-input" style="margin:0; height:35px; font-size:0.85rem; padding-left:30px;" placeholder="Link"></div>
                </div>
                <div id="sport-extra" style="display:none; padding:10px;">
                    <label style="font-weight:bold;">Kısa Açıklama (Desc)</label><input id="swal-sport-tip" class="swal2-input" placeholder="Kısa İpucu/Tip">
                    <label style="font-weight:bold;">Detaylı Metin (Detail)</label><input id="swal-sport-detail" class="swal2-input" placeholder="Detaylı Açıklama (Alt Metin)">
                    <label style="font-weight:bold;">Okunuşu (Pronunciation)</label><input id="swal-sport-pron" class="swal2-input" placeholder="Okunuşu">
                    <label style="font-weight:bold;">İkon Sınıfı (Icon)</label><input id="swal-sport-icon" class="swal2-input" placeholder="FontAwesome İkon Sınıfı (e.g., fa-futbol)">
                </div>
                <div id="news-extra" style="display:none; padding:10px;">
                    <label style="font-weight:bold;">Duyuru Tipi</label><select id="swal-news-type" class="swal2-input"><option value="info">Bilgi</option><option value="update">Değişiklik</option><option value="fix">Çözüldü</option></select>
                    <label style="font-weight:bold;">Durum</label><select id="swal-news-status" class="swal2-input"><option value="Aktif">Aktif</option><option value="Pasif">Pasif (Gizle)</option></select>
                </div>
            </div>`,
        width: '700px', showCancelButton: true, confirmButtonText: '<i class="fas fa-plus"></i> Ekle', cancelButtonText: 'İptal', focusConfirm: false,
        didOpen: () => {
            const selectEl = document.getElementById('swal-new-cat'); const cardEl = document.getElementById('preview-card');
            selectEl.style.margin = "0"; selectEl.style.height = "30px"; selectEl.style.fontSize = "0.8rem"; selectEl.style.padding = "0 5px";
            selectEl.addEventListener('change', function() { cardEl.className = 'card ' + this.value; });
            window.toggleAddFields = function() {
                const type = document.getElementById('swal-type-select').value;
                const catCont = document.getElementById('cat-container');
                const scriptCont = document.getElementById('script-container');
                const extraCont = document.getElementById('extra-container');
                const sportExtra = document.getElementById('sport-extra');
                const newsExtra = document.getElementById('news-extra');
                const cardPreview = document.getElementById('preview-card');
                catCont.style.display = 'none'; scriptCont.style.display = 'none'; extraCont.style.display = 'none'; 
                sportExtra.style.display = 'none'; newsExtra.style.display = 'none';
                cardPreview.style.borderLeft = "5px solid var(--info)"; 
                cardPreview.className = 'card Bilgi'; 

                if (type === 'card') {
                    catCont.style.display = 'block'; scriptCont.style.display = 'block'; extraCont.style.display = 'grid';
                    cardPreview.className = 'card ' + document.getElementById('swal-new-cat').value;
                } else if (type === 'sales') {
                    scriptCont.style.display = 'block'; 
                    document.getElementById('swal-new-script').placeholder = "Satış Metni...";
                    cardPreview.style.borderLeft = "5px solid var(--sales)";
                } else if (type === 'sport') {
                    sportExtra.style.display = 'block';
                    cardPreview.style.borderLeft = "5px solid var(--primary)";
                } else if (type === 'news') {
                    newsExtra.style.display = 'block';
                    cardPreview.style.borderLeft = "5px solid var(--secondary)";
                }
            };
        },
        preConfirm: () => {
            const type = document.getElementById('swal-type-select').value;
            const today = new Date();
            const dateStr = today.getDate() + "." + (today.getMonth()+1) + "." + today.getFullYear();
            return { 
                cardType: type, 
                category: type === 'card' ? document.getElementById('swal-new-cat').value : (type === 'news' ? document.getElementById('swal-news-type').value : ''), 
                title: document.getElementById('swal-new-title').value, 
                text: document.getElementById('swal-new-text').value, 
                script: (type === 'card' || type === 'sales') ? document.getElementById('swal-new-script').value : '', 
                code: type === 'card' ? document.getElementById('swal-new-code').value : '', 
                status: type === 'news' ? document.getElementById('swal-news-status').value : '',
                link: type === 'card' ? document.getElementById('swal-new-link').value : '',
                tip: type === 'sport' ? document.getElementById('swal-sport-tip').value : '',
                detail: type === 'sport' ? document.getElementById('swal-sport-detail').value : '',
                pronunciation: type === 'sport' ? document.getElementById('swal-sport-pron').value : '',
                icon: type === 'sport' ? document.getElementById('swal-sport-icon').value : '',
                date: dateStr 
            }
        }
    });
    if (formValues) {
        if(!formValues.title) { Swal.fire('Hata', 'Başlık zorunlu!', 'error'); return; }
        Swal.fire({ title: 'Ekleniyor...', didOpen: () => { Swal.showLoading() } });
        fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: "addCard", username: currentUser, token: getToken(), ...formValues }) })
        .then(response => response.json()).then(data => {
            if (data.result === "success") { Swal.fire({icon: 'success', title: 'Başarılı', text: 'İçerik eklendi.', timer: 2000, showConfirmButton: false}); setTimeout(loadContentData, 3500); } 
            else { Swal.fire('Hata', data.message || 'Eklenemedi.', 'error'); }
        }).catch(err => Swal.fire('Hata', 'Sunucu hatası: ' + err, 'error'));
    }
}

async function editContent(index) {
    const item = activeCards[index]; 
    const catSelectHTML = getCategorySelectHtml(item.category, 'swal-cat');
    const { value: formValues } = await Swal.fire({
        title: 'Kartı Düzenle',
        html: `
            <div id="preview-card-edit" class="card ${item.category}" style="text-align:left; box-shadow:none; border:1px solid #e0e0e0; margin-top:10px;">
                <div class="card-header" style="align-items: center; gap: 10px;">
                    <input id="swal-title" class="swal2-input" style="margin:0; height:40px; flex-grow:1; border:none; border-bottom:2px solid #eee; padding:0 5px; font-weight:bold; color:#0e1b42;" value="${item.title}" placeholder="Başlık">
                    <div style="width: 110px;">${catSelectHTML}</div>
                </div>
                <div class="card-content" style="margin-bottom:10px;">
                    <textarea id="swal-text" class="swal2-textarea" style="margin:0; width:100%; box-sizing:border-box; border:none; resize:none; font-family:inherit; min-height:120px; padding:10px; background:#f9f9f9;" placeholder="İçerik metni...">${(item.text || '').toString().replace(/<br>/g,'\n')}</textarea>
                </div>
                <div class="script-box" style="padding:0; border:1px solid #f0e68c;">
                    <textarea id="swal-script" class="swal2-textarea" style="margin:0; width:100%; box-sizing:border-box; border:none; background:transparent; font-style:italic; min-height:80px; font-size:0.9rem;" placeholder="Script metni...">${(item.script || '').toString().replace(/<br>/g,'\n')}</textarea>
                </div>
                <div class="card-actions" style="margin-top:15px; display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    <div style="position:relative;"><i class="fas fa-code" style="position:absolute; left:10px; top:10px; color:#aaa;"></i><input id="swal-code" class="swal2-input" style="margin:0; height:35px; font-size:0.85rem; padding-left:30px;" value="${item.code || ''}" placeholder="Kod"></div>
                    <div style="position:relative;"><i class="fas fa-link" style="position:absolute; left:10px; top:10px; color:#aaa;"></i><input id="swal-link" class="swal2-input" style="margin:0; height:35px; font-size:0.85rem; padding-left:30px;" value="${item.link || ''}" placeholder="Link"></div>
                </div>
            </div>`,
        width: '700px', showCancelButton: true, confirmButtonText: '<i class="fas fa-save"></i> Değişiklikleri Kaydet', cancelButtonText: 'İptal', focusConfirm: false,
        preConfirm: () => {
            return { cat: document.getElementById('swal-cat').value, title: document.getElementById('swal-title').value, text: document.getElementById('swal-text').value, script: document.getElementById('swal-script').value, code: document.getElementById('swal-code').value, link: document.getElementById('swal-link').value }
        }
    });
    if (formValues) {
        if(formValues.cat !== item.category) sendUpdate(item.title, "Category", formValues.cat, 'card');
        if(formValues.text !== (item.text || '').replace(/<br>/g,'\n')) setTimeout(() => sendUpdate(item.title, "Text", formValues.text, 'card'), 500);
        if(formValues.script !== (item.script || '').replace(/<br>/g,'\n')) setTimeout(() => sendUpdate(item.title, "Script", formValues.script, 'card'), 1000);
        if(formValues.code !== (item.code || '')) setTimeout(() => sendUpdate(item.title, "Code", formValues.code, 'card'), 1500);
        if(formValues.link !== (item.link || '')) setTimeout(() => sendUpdate(item.title, "Link", formValues.link, 'card'), 2000);
        if(formValues.title !== item.title) setTimeout(() => sendUpdate(item.title, "Title", formValues.title, 'card'), 2500);
    }
}

// DÜZELTİLMİŞ: editSport, index yerine title alıyor.
async function editSport(title) {
    event.stopPropagation();
    const s = sportsData.find(item => item.title === title);
    if (!s) return Swal.fire('Hata', 'İçerik bulunamadı.', 'error');
    
    const { value: formValues } = await Swal.fire({
        title: 'Spor İçeriğini Düzenle',
        html: `
            <div class="card" style="text-align:left; border-left: 5px solid var(--primary); padding:15px; background:#f8f9fa;">
                <label style="font-weight:bold;">Başlık</label>
                <input id="swal-title" class="swal2-input" style="width:100%; margin-bottom:10px;" value="${s.title}">
                <label style="font-weight:bold;">Açıklama (Kısa Metin)</label>
                <textarea id="swal-desc" class="swal2-textarea" style="margin-bottom:10px;">${s.desc || ''}</textarea>
                <label style="font-weight:bold;">İpucu (Tip)</label>
                <input id="swal-tip" class="swal2-input" style="width:100%; margin-bottom:10px;" value="${s.tip || ''}">
                <label style="font-weight:bold;">Detay (Alt Metin)</label>
                <textarea id="swal-detail" class="swal2-textarea" style="margin-bottom:10px;">${s.detail || ''}</textarea>
                <label style="font-weight:bold;">Okunuş</label>
                <input id="swal-pron" class="swal2-input" style="width:100%; margin-bottom:10px;" value="${s.pronunciation || ''}">
                <label style="font-weight:bold;">İkon Sınıfı</label>
                <input id="swal-icon" class="swal2-input" style="width:100%;" value="${s.icon || ''}">
            </div>`,
        width: '700px', showCancelButton: true, confirmButtonText: 'Kaydet',
        preConfirm: () => [ document.getElementById('swal-title').value, document.getElementById('swal-desc').value, document.getElementById('swal-tip').value, document.getElementById('swal-detail').value, document.getElementById('swal-pron').value, document.getElementById('swal-icon').value ]
    });
    if (formValues) {
        const originalTitle = s.title;
        if(formValues[1] !== s.desc) sendUpdate(originalTitle, "Text", formValues[1], 'sport');
        if(formValues[2] !== s.tip) setTimeout(() => sendUpdate(originalTitle, "Tip", formValues[2], 'sport'), 500);
        if(formValues[3] !== s.detail) setTimeout(() => sendUpdate(originalTitle, "Detail", formValues[3], 'sport'), 1000);
        if(formValues[4] !== s.pronunciation) setTimeout(() => sendUpdate(originalTitle, "Pronunciation", formValues[4], 'sport'), 1500);
        if(formValues[5] !== s.icon) setTimeout(() => sendUpdate(originalTitle, "Icon", formValues[5], 'sport'), 2000);
        if(formValues[0] !== originalTitle) setTimeout(() => sendUpdate(originalTitle, "Title", formValues[0], 'sport'), 2500);
    }
}

// DÜZELTİLMİŞ: editSales, index yerine title alıyor.
async function editSales(title) {
    event.stopPropagation(); 
    const s = salesScripts.find(item => item.title === title);
    if (!s) return Swal.fire('Hata', 'İçerik bulunamadı.', 'error');

    const { value: formValues } = await Swal.fire({ 
        title: 'Satış Metnini Düzenle', 
        html: `<div class="card" style="text-align:left; border-left: 5px solid var(--sales); padding:15px; background:#ecfdf5;"><label style="font-weight:bold;">Başlık</label><input id="swal-title" class="swal2-input" style="width:100%; margin-bottom:10px;" value="${s.title}"><label style="font-weight:bold;">Metin</label><textarea id="swal-text" class="swal2-textarea" style="min-height:150px;">${s.text || ''}</textarea></div>`, 
        width: '700px', showCancelButton: true, confirmButtonText: 'Kaydet', 
        preConfirm: () => [ document.getElementById('swal-title').value, document.getElementById('swal-text').value ]
    });
    if (formValues) {
        const originalTitle = s.title;
        if(formValues[1] !== s.text) sendUpdate(originalTitle, "Text", formValues[1], 'sales');
        if(formValues[0] !== originalTitle) setTimeout(() => sendUpdate(originalTitle, "Title", formValues[0], 'sales'), 500);
    }
}

async function editNews(index) {
    const i = newsData[index];
    let statusOptions = `<option value="Aktif" ${i.status !== 'Pasif' ? 'selected' : ''}>Aktif</option><option value="Pasif" ${i.status === 'Pasif' ? 'selected' : ''}>Pasif (Gizle)</option>`;
    let typeOptions = `<option value="info" ${i.type === 'info' ? 'selected' : ''}>Bilgi</option><option value="update" ${i.type === 'update' ? 'selected' : ''}>Değişiklik</option><option value="fix" ${i.type === 'fix' ? 'selected' : ''}>Çözüldü</option>`;
    const { value: formValues } = await Swal.fire({
        title: 'Duyuruyu Düzenle',
        html: `<div class="card" style="text-align:left; border-left: 5px solid var(--secondary); padding:15px; background:#fff8e1;"><label style="font-weight:bold;">Başlık</label><input id="swal-title" class="swal2-input" style="width:100%; margin-bottom:10px;" value="${i.title || ''}"><div style="display:flex; gap:10px; margin-bottom:10px;"><div style="flex:1;"><label style="font-weight:bold;">Tarih</label><input id="swal-date" class="swal2-input" style="width:100%;" value="${i.date || ''}"></div><div style="flex:1;"><label style="font-weight:bold;">Tür</label><select id="swal-type" class="swal2-input" style="width:100%;">${typeOptions}</select></div></div><label style="font-weight:bold;">Metin</label><textarea id="swal-desc" class="swal2-textarea" style="margin-bottom:10px;">${i.desc || ''}</textarea><label style="font-weight:bold;">Durum</label><select id="swal-status" class="swal2-input" style="width:100%;">${statusOptions}</select></div>`,
        width: '600px', showCancelButton: true, confirmButtonText: 'Kaydet', 
        preConfirm: () => [ document.getElementById('swal-title').value, document.getElementById('swal-date').value, document.getElementById('swal-desc').value, document.getElementById('swal-type').value, document.getElementById('swal-status').value ]
    });
    if (formValues) {
        const originalTitle = i.title;
        if(formValues[1] !== i.date) sendUpdate(originalTitle, "Date", formValues[1], 'news');
        if(formValues[2] !== i.desc) setTimeout(() => sendUpdate(originalTitle, "Text", formValues[2], 'news'), 500);
        if(formValues[3] !== i.type) setTimeout(() => sendUpdate(originalTitle, "Category", formValues[3], 'news'), 1000);
        if(formValues[4] !== i.status) setTimeout(() => sendUpdate(originalTitle, "Status", formValues[4], 'news'), 1500);
        if(formValues[0] !== originalTitle) setTimeout(() => sendUpdate(originalTitle, "Title", formValues[0], 'news'), 2000);
    }
}

// --- MODAL VE GÖRÜNTÜLEME FONKSİYONLARI ---
function closeModal(id) { 
    document.getElementById(id).style.display = 'none'; 
    
    // EK GÜVENLİK KATMANI: Modallar kapandığında düzenleme modunu sıfırla (Adminlerde).
    if (id === 'quality-modal' || id === 'wizard-modal' || id === 'penalty-modal') { 
        const editBtn = document.getElementById('quickEditBtn');
        document.body.classList.remove('editing');
        // Edit butonunun durumunu güncelle
        if (editBtn && isAdminMode) {
            editBtn.classList.remove('active');
            editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i> Düzenlemeyi Aç';
        }
    }
}
let tickerIndex = 0;
function startTicker() { const t = document.getElementById('ticker-content'); const activeNews = newsData.filter(i => i.status !== 'Pasif'); if(activeNews.length === 0) { t.innerHTML = "Güncel duyuru yok."; return; } function showNext() { const i = activeNews[tickerIndex]; t.style.animation = 'none'; t.offsetHeight; t.style.animation = 'slideIn 0.5s ease-out'; t.innerHTML = `<strong>${i.date}:</strong> ${i.title} - ${i.desc}`; tickerIndex = (tickerIndex + 1) % activeNews.length; } showNext(); setInterval(showNext, 5000); }
function openNews() { 
    document.getElementById('news-modal').style.display = 'flex'; 
    const c = document.getElementById('news-container'); 
    c.innerHTML = ''; 
    newsData.forEach((i, index) => { 
        let cl = i.type === 'fix' ? 'tag-fix' : (i.type === 'update' ? 'tag-update' : 'tag-info'); 
        let tx = i.type === 'fix' ? 'Çözüldü' : (i.type === 'update' ? 'Değişiklik' : 'Bilgi'); 
        let passiveStyle = i.status === 'Pasif' ? 'opacity:0.5; background:#eee;' : ''; 
        let passiveBadge = i.status === 'Pasif' ? '<span class="news-tag" style="background:#555; color:white;">PASİF</span>' : ''; 
        
        // DÜZELTİLMİŞ: Inline stil kaldırıldı. CSS sadece body.editing varsa gösterecek.
        let editBtn = isAdminMode ? `<i class="fas fa-pencil-alt edit-icon" style="top:0; right:0; font-size:0.9rem; padding:4px;" onclick="event.stopPropagation(); editNews(${index})"></i>` : ''; 
        
        c.innerHTML += `<div class="news-item" style="${passiveStyle}">${editBtn}<span class="news-date">${i.date}</span><span class="news-title">${i.title} ${passiveBadge}</span><div class="news-desc">${i.desc}</div><span class="news-tag ${cl}">${tx}</span></div>`; 
    }); 
}
function openGuide() { 
    document.getElementById('guide-modal').style.display = 'flex'; 
    const grid = document.getElementById('guide-grid'); 
    grid.innerHTML = ''; 
    sportsData.forEach((s, index) => { 
        let pronHtml = s.pronunciation ? `<div class="pronunciation-badge">🗣️ ${s.pronunciation}</div>` : ''; 
        
        // DÜZELTİLMİŞ: Tıklama olayına title (benzersiz key) geçirildi.
        let editBtn = isAdminMode ? `<i class="fas fa-pencil-alt edit-icon" style="top:5px; right:5px; z-index:50;" onclick="event.stopPropagation(); editSport('${escapeForJsString(s.title)}')"></i>` : ''; 
        
        // showSportDetail, index'i kullanmaya devam edebilir
        grid.innerHTML += `<div class="guide-item" onclick="showSportDetail(${index})">${editBtn}<i class="fas ${s.icon} guide-icon"></i><span class="guide-title">${s.title}</span>${pronHtml}<div class="guide-desc">${s.desc}</div><div class="guide-tip"><i class="fas fa-lightbulb"></i> ${s.tip}</div><div style="font-size:0.8rem; color:#999; margin-top:5px;">(Detay için tıkla)</div></div>`; 
    }); 
}
function showSportDetail(index) { const sport = sportsData[index]; const detailText = sport.detail ? sport.detail.replace(/\n/g,'<br>') : "Bu içerik için henüz detay eklenmemiş."; const pronDetail = sport.pronunciation ? `<div style="color:#e65100; font-weight:bold; margin-bottom:15px;">🗣️ Okunuşu: ${sport.pronunciation}</div>` : ''; Swal.fire({ title: `<i class="fas ${sport.icon}" style="color:#0e1b42;"></i> ${sport.title}`, html: `${pronDetail}<div style="text-align:left; font-size:1rem; line-height:1.6;">${detailText}</div>`, showCloseButton: true, showConfirmButton: false, width: '600px', background: '#f8f9fa' }); }
function openSales() { 
    document.getElementById('sales-modal').style.display = 'flex'; 
    const c = document.getElementById('sales-grid'); 
    c.innerHTML = ''; 
    salesScripts.forEach((s, index) => { 
        // DÜZELTİLMİŞ: Tıklama olayına title (benzersiz key) geçirildi.
        let editBtn = isAdminMode ? `<i class="fas fa-pencil-alt edit-icon" style="top:10px; right:40px; z-index:50;" onclick="event.stopPropagation(); editSales('${escapeForJsString(s.title)}')"></i>` : ''; 
        
        c.innerHTML += `<div class="sales-item" id="sales-${index}" onclick="toggleSales('${index}')">${editBtn}<div class="sales-header"><span class="sales-title">${s.title}</span><i class="fas fa-chevron-down" id="icon-${index}" style="color:#10b981;"></i></div><div class="sales-text">${(s.text || '').replace(/\n/g,'<br>')}<div style="text-align:right; margin-top:15px;"><button class="btn btn-copy" onclick="event.stopPropagation(); copyText('${escapeForJsString(s.text || '')}')"><i class="fas fa-copy"></i> Kopyala</button></div></div></div>`; 
    }); 
}
function toggleSales(index) { const item = document.getElementById(`sales-${index}`); const icon = document.getElementById(`icon-${index}`); item.classList.toggle('active'); if(item.classList.contains('active')){ icon.classList.replace('fa-chevron-down', 'fa-chevron-up'); } else { icon.classList.replace('fa-chevron-up', 'fa-chevron-down'); } }

// --- KALİTE FONKSİYONLARI (GELİŞMİŞ) ---

/** Ay filtresi için seçenekleri hazırlar */
function populateMonthFilter() {
    const selectEl = document.getElementById('month-select-filter');
    selectEl.innerHTML = '';
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Geçen 6 ay ve şimdiki ay için seçenekleri oluştur
    for (let i = 0; i < 6; i++) {
        let month = (currentMonth - i + 12) % 12; // 0-11
        let year = currentYear;
        if (currentMonth - i < 0) {
            year = currentYear - 1;
        }
        const monthStr = (month + 1).toString().padStart(2, '0'); // MM formatı
        const yearStr = year.toString();
        const value = `${monthStr}.${yearStr}`;
        const text = `${MONTH_NAMES[month]} ${yearStr}`;

        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        
        if (i === 0) {
            option.selected = true; // Varsayılan olarak şimdiki ayı seç
        }
        selectEl.appendChild(option);
    }
}

// openQualityArea fonksiyonunu güncelleyin
function openQualityArea() {
    document.getElementById('quality-modal').style.display = 'flex';
    
    // ADMIN KONTROLÜ: Admin olmayanlar Yeni Değerlendirme Ekle butonunu görmez.
    document.getElementById('admin-quality-controls').style.display = isAdminMode ? 'block' : 'none';
    
    populateMonthFilter(); // Ay filtreleme seçeneklerini doldur
    
    // Metrikleri sıfırla
    document.getElementById('eval-count-span').innerText = `Dinleme Adeti: -`;
    document.getElementById('monthly-avg-span').innerText = `Ortalama: -`;

    if (isAdminMode) {
        fetchUserListForAdmin().then(users => {
            const selectEl = document.getElementById('agent-select-admin');
            selectEl.innerHTML = users.map(u => `<option value="${u.name}" data-group="${u.group}">${u.name} (${u.group})</option>`).join('');
            if(users.length > 0) selectEl.value = users[0].name;
            fetchEvaluationsForAgent(); 
        });
    } else {
        fetchEvaluationsForAgent(currentUser); // User sadece kendi çağrılarını görür
    }
}

// fetchEvaluationsForAgent fonksiyonunu güncelleyin (ROBUST YÜKLEME VE SIFIR VERİ KONTROLÜ)
async function fetchEvaluationsForAgent(forcedName) {
    const listEl = document.getElementById('evaluations-list');
    const loader = document.getElementById('quality-loader');
    listEl.innerHTML = ''; 
    loader.style.display = 'block';

    let targetAgent = forcedName || currentUser;
    
    // Admin modunda, temsilci seçim kutusundaki değeri kullan
    if (isAdminMode) {
        const selectEl = document.getElementById('agent-select-admin');
        targetAgent = selectEl.value; // Seçili temsilciyi her zaman oku
    }
    
    if (!targetAgent) {
        loader.innerHTML = '<span style="color:red;">Lütfen listeden bir temsilci seçimi yapın.</span>';
        return;
    }

    const selectedMonth = document.getElementById('month-select-filter').value;

    try {
        // Not: İlk çalıştırmada tüm veriyi çeker ve allEvaluationsData'ya kaydeder
        const response = await fetch(SCRIPT_URL, { 
            method: 'POST', 
            headers: { "Content-Type": "text/plain;charset=utf-8" }, 
            body: JSON.stringify({ action: "fetchEvaluations", targetAgent: targetAgent, username: currentUser, token: getToken() }) 
        });
        
        const data = await response.json();

        loader.style.display = 'none'; // Yükleyiciyi kapat!
        
        if (data.result === "success") {
            allEvaluationsData = data.evaluations;

            // 1. Ay bazlı filtreleme
            let filteredEvals = allEvaluationsData.filter(eval => {
                const evalDate = eval.date.substring(3);
                return evalDate === selectedMonth;
            });
            
            // 2. Metrik Hesaplama (Sıfır kayıt varsa 0 olarak hesaplanır)
            const monthlyTotal = filteredEvals.reduce((sum, eval) => sum + (parseFloat(eval.score) || 0), 0);
            const monthlyCount = filteredEvals.length;
            const monthlyAvg = monthlyCount > 0 ? Math.round(monthlyTotal / monthlyCount) : 0;

            // 3. Metrikleri Güncelle
            document.getElementById('eval-count-span').innerText = `Dinleme Adeti: ${monthlyCount}`;
            document.getElementById('monthly-avg-span').innerText = `Ortalama: ${monthlyAvg}%`;

            // 4. Liste Gösterimi
            if (filteredEvals.length === 0) { 
                listEl.innerHTML = `<p style="text-align:center; color:#666;">Seçilen **${selectedMonth}** dönemi için değerlendirme bulunamadı.</p>`;
                return; 
            }
            
            // Veri varsa listeyi render etme
            let html = '';
            // En yeni en üste
            filteredEvals.reverse().forEach((eval, index) => { 
                const scoreColor = eval.score >= 90 ? '#2e7d32' : (eval.score >= 70 ? '#ed6c02' : '#d32f2f');
                
                // KRİTİK: CallDate'in temiz formatı hesaplanır
                const displayCallDate = formatDateToDDMMYYYY(eval.callDate);
                
                
                let detailHtml = '';
                try {
                    const detailObj = JSON.parse(eval.details);
                    detailHtml = '<table style="width:100%; font-size:0.85rem; border-collapse:collapse; margin-top:10px;">';
                    detailObj.forEach(item => {
                        let rowColor = item.score < item.max ? '#ffebee' : '#f9f9f9';
                        let noteDisplay = item.note ? `<br><em style="color: #d32f2f; font-size:0.8rem;">(Kırılım Nedeni: ${item.note})</em>` : '';
                        
                        detailHtml += `<tr style="background:${rowColor}; border-bottom:1px solid #eee;">
                            <td style="padding:8px;">${item.q}${noteDisplay}</td>
                            <td style="padding:8px; font-weight:bold; text-align:right;">${item.score}/${item.max}</td>
                        </tr>`;
                    });
                    detailHtml += '</table>';
                } catch (e) { detailHtml = `<p style="white-space:pre-wrap; margin:0; font-size:0.9rem;">${eval.details}</p>`; }


                // DÜZELTİLEN HTML KISMI: Çağrı Tarihi ve Loglama Tarihi yerleri ve formatları
                let editBtn = isAdminMode ? `<div style="position:absolute; top:10px; right:40px; cursor:pointer; color:#1976d2;" onclick="event.stopPropagation(); editEvaluation('${eval.callId}')" title="Değerlendirmeyi Düzenle"><i class="fas fa-edit fa-lg"></i></div>` : '';
                
                html += `<div class="evaluation-summary" id="eval-summary-${index}" style="position:relative; border:1px solid #ddd; border-left:5px solid ${scoreColor}; padding:15px; margin-bottom:10px; border-radius:6px; background:#fff; cursor:pointer;" onclick="toggleEvaluationDetail(${index})">
    ${editBtn}
    <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="flex-direction: column; align-items: flex-start; display: flex;">
            
            <span style="font-weight:bold; color:var(--primary); font-size:1.1rem;">
                📞 ${displayCallDate} <span style="font-size:0.8rem; font-weight:normal; color:#666;">(Çağrı Tarihi)</span>
            </span>
            
            <span style="font-size:0.9rem; color:#555; margin-top:5px;">Değerlendirme Tarihi: ${eval.date || 'N/A'}</span>
            
        </div>
        <span style="font-size:0.9rem; color:#666;">Call ID: ${eval.callId || '-'}</span> 
        <span style="font-weight:bold; font-size:1.4rem; color:${scoreColor};">PUAN: ${eval.score}</span>
        <i class="fas fa-chevron-down" id="eval-icon-${index}" style="color:var(--primary); transition:transform 0.3s;"></i>
    </div>
    <div class="evaluation-details-content" id="eval-details-${index}" style="max-height:0; overflow:hidden; transition:max-height 0.4s ease-in-out; margin-top:0;">
    </div>
</div>`;
            });
            listEl.innerHTML = html;
            
        } else { 
            listEl.innerHTML = `<p style="color:red; text-align:center;">Veri çekme hatası: ${data.message || 'Bilinmeyen Hata'}</p>`; 
        }

    } catch(err) {
        loader.style.display = 'none';
        listEl.innerHTML = `<p style="color:red; text-align:center;">Bağlantı hatası veya sunucuya ulaşılamadı.</p>`;
    }
}
// ... (Diğer fonksiyonlar)
