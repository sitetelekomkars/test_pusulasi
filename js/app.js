// =======================================================
// === app.js İÇİNDEKİ fetchEvaluationsForAgent FONKSİYONUNDA DEĞİŞECEK KISIM ===
// =======================================================

// Listeyi ters çevirip ekrana basıyoruz
filteredEvals.reverse().forEach((eval, index) => { 
    // Puan rengini belirle
    const scoreColor = eval.score >= 90 ? '#2e7d32' : (eval.score >= 70 ? '#ed6c02' : '#d32f2f');
    // Puan arka planı (daha yumuşak bir görünüm için opsiyonel)
    const scoreBg = eval.score >= 90 ? '#e8f5e9' : (eval.score >= 70 ? '#fff3e0' : '#ffebee');

    let detailHtml = '';
    try {
        const detailObj = JSON.parse(eval.details);
        detailHtml = '<table style="width:100%; font-size:0.85rem; border-collapse:collapse; margin-top:10px;">';
        detailObj.forEach(item => {
            let rowColor = item.score < item.max ? '#ffebee' : '#f9f9f9';
            let noteDisplay = item.note ? `<br><em style="color:#d32f2f; font-size:0.8rem;">(Not: ${item.note})</em>` : '';
            detailHtml += `<tr style="background:${rowColor}; border-bottom:1px solid #eee;">
                <td style="padding:8px;">${item.q}${noteDisplay}</td>
                <td style="padding:8px; font-weight:bold; text-align:right;">${item.score}/${item.max}</td>
            </tr>`;
        });
        detailHtml += '</table>';
    } catch (e) { 
        detailHtml = `<p style="white-space:pre-wrap; margin:0; font-size:0.9rem;">${eval.details}</p>`; 
    }

    // Düzenleme butonu (Admin ise görünür)
    let editBtn = isAdminMode ? `<div style="position:absolute; top:5px; right:5px; cursor:pointer; color:#1976d2; padding:5px; z-index:10;" onclick="event.stopPropagation(); editEvaluation('${eval.callId}')" title="Düzenle"><i class="fas fa-pencil-alt"></i></div>` : '';

    // --- YENİ TASARIM HTML YAPISI ---
    html += `
    <div class="evaluation-summary" id="eval-summary-${index}" 
         style="position:relative; border:1px solid #e0e0e0; border-left:5px solid ${scoreColor}; 
                border-radius:8px; background:#fff; margin-bottom:12px; cursor:pointer; 
                box-shadow: 0 2px 5px rgba(0,0,0,0.05); transition: transform 0.2s;"
         onclick="toggleEvaluationDetail(${index})"
         onmouseover="this.style.transform='translateY(-2px)'" 
         onmouseout="this.style.transform='translateY(0)'">
        
        ${editBtn}

        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 15px;">
            
            <div style="display:flex; flex-direction: column; gap: 4px; min-width: 100px;">
                <div style="font-weight:bold; color:#0e1b42; font-size:1rem; display:flex; align-items:center; gap:6px;">
                    <i class="far fa-calendar-alt" style="color:#1976d2; font-size:0.9rem;"></i>
                    ${eval.callDate || 'Tarih Yok'}
                </div>
                <div style="font-size:0.75rem; color:#888; display:flex; align-items:center; gap:6px;">
                    <i class="fas fa-check-double" style="font-size:0.7rem;"></i>
                    Log: ${eval.date}
                </div>
            </div>

            <div style="flex:1; text-align:center;">
                <span style="background:#f1f5f9; border:1px solid #cbd5e1; padding:4px 12px; border-radius:20px; 
                             font-size:0.9rem; color:#475569; font-family:'Segoe UI', monospace; font-weight:600; letter-spacing:0.5px;">
                    🆔 ${eval.callId || '-'}
                </span>
            </div>

            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:42px; height:42px; border-radius:50%; background:${scoreColor}; color:#fff; 
                            display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:1.1rem;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                    ${eval.score}
                </div>
                <i class="fas fa-chevron-down" id="eval-icon-${index}" style="color:#94a3b8; transition:transform 0.3s;"></i>
            </div>

        </div>

        <div class="evaluation-details-content" id="eval-details-${index}" 
             style="max-height:0; overflow:hidden; transition:max-height 0.4s ease-in-out; background:#f8fafc; border-top:1px dashed #e2e8f0;">
            <div style="padding:15px;">
                <h4 style="color:#334155; font-size:0.9rem; margin:0 0 5px 0;">📋 Değerlendirme Detayları:</h4>
                ${detailHtml}
                
                <div style="margin-top:15px; background:#fff; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
                    <h4 style="color:#1976d2; font-size:0.85rem; margin:0 0 5px 0;">💬 Geri Bildirim:</h4>
                    <p style="white-space:pre-wrap; margin:0; font-size:0.9rem; color:#333;">${eval.feedback || 'Geri bildirim girilmedi.'}</p>
                </div>
            </div>
        </div>
    </div>`;
});
