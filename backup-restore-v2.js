/**
 * BIST Terminal - Improved Backup/Restore System
 * Sorunlar: UTF-8 encoding, error handling, validation
 */

// ============================================
// BACKUP FONKSIYONU
// ============================================
function backup(){
  try {
    // Veri topla
    const backupData = {
      wl: WL,
      alarms: S.alarms,
      tx: S.tx,
      jr: S.jr,
      tdkey: S.key,
      src: S.src,
      cap: S.cap,
      rskp: S.rskp,
      sym: S.sym,
      tf: S.tf,
      ind: S.ind,
      v: 7,
      timestamp: new Date().toISOString()
    };

    // Validasyon
    if (!backupData.wl || !Array.isArray(backupData.alarms)) {
      throw new Error('Yedek veri eksik');
    }

    // JSON'a çevir
    const jsonString = JSON.stringify(backupData);
    
    // Base64 encode (Türkçe karakterler için UTF-8 safe)
    const encoded = btoa(unescape(encodeURIComponent(jsonString)));
    const backupCode = 'BISTT:' + encoded;

    // Textarea'ya yaz
    $('#bktext').value = backupCode;

    // Clipboard'a kopyala
    if (navigator.clipboard) {
      navigator.clipboard.writeText(backupCode)
        .then(() => {
          alert('✓ Yedek başarıyla panoya kopyalandı!\n\nUzunluk: ' + backupCode.length + ' karakter');
          console.log('Backup created at:', new Date().toISOString());
        })
        .catch((err) => {
          console.error('Clipboard error:', err);
          alert('⚠ Clipboard hatası.\nKutudaki metni manuel kopyala: Ctrl+A, Ctrl+C');
        });
    } else {
      alert('⚠ Clipboard desteklenmiyor.\nKutudaki metni manuel kopyala: Ctrl+A, Ctrl+C');
    }

  } catch (error) {
    console.error('Backup error:', error);
    alert('❌ Yedek oluşturma hatası:\n' + error.message);
  }
}

// ============================================
// RESTORE FONKSIYONU
// ============================================
function restore(){
  try {
    const backupText = $('#bktext').value.trim();

    // 1. KONTROL: Metin boş mu?
    if (!backupText) {
      throw new Error('Lütfen yedek metnini yapıştır');
    }

    // 2. KONTROL: Format doğru mu?
    if (!backupText.startsWith('BISTT:')) {
      throw new Error('Geçersiz format! BISTT: ile başlamalı');
    }

    // 3. DECODE: Base64'ten çıkar
    let decodedJson;
    try {
      const encoded = backupText.slice(6); // BISTT: kısmını kaldır
      decodedJson = decodeURIComponent(escape(atob(encoded)));
    } catch (decodeError) {
      throw new Error('Yedek kodu bozulmuş: ' + decodeError.message);
    }

    // 4. PARSE: JSON'a çevir
    let backupData;
    try {
      backupData = JSON.parse(decodedJson);
    } catch (parseError) {
      throw new Error('JSON hata: ' + parseError.message);
    }

    // 5. VALIDATE: Kritik verileri kontrol et
    if (!backupData.wl || !backupData.alarms) {
      throw new Error('Yedekte kritik veri eksik (wl veya alarms)');
    }

    if (backupData.v !== 7) {
      console.warn('Yedek versiyonu uyumsuz:', backupData.v);
      // Eski versiyon desteği eklenebilir
    }

    // 6. RESTORE: LocalStorage'a yaz
    const keysToRestore = [
      'wl', 'alarms', 'tx', 'jr', 'sym', 'tf', 
      'ind', 'cap', 'rskp', 'tdkey', 'src'
    ];

    let restoredCount = 0;
    keysToRestore.forEach(key => {
      if (backupData[key] !== undefined) {
        LS.set(key, backupData[key]);
        restoredCount++;
      }
    });

    console.log('Restored keys:', restoredCount, 'Timestamp:', backupData.timestamp);

    // 7. TAMAMLA
    alert('✓ Geri yükleme başarılı!\n' + 
          'Kurtarılan: ' + restoredCount + ' parametre\n' +
          'Yedek tarihi: ' + (backupData.timestamp || 'bilinmiyor') + '\n\n' +
          'Sayfa yeniden yüklenecek...');

    // Biraz bekle sonra sayfayı yenile
    setTimeout(() => {
      location.reload();
    }, 800);

  } catch (error) {
    console.error('Restore error:', error);
    alert('❌ Geri yükleme hatası:\n' + error.message + 
          '\n\nLütfen yedek kodunu kontrol et ve tekrar dene.');
  }
}

// ============================================
// UTILITY: Yedek doğrulama
// ============================================
function validateBackup(backupText) {
  try {
    if (!backupText.startsWith('BISTT:')) return false;
    const encoded = backupText.slice(6);
    const json = decodeURIComponent(escape(atob(encoded)));
    const data = JSON.parse(json);
    return data.wl && data.alarms ? true : false;
  } catch (e) {
    return false;
  }
}

// ============================================
// UTILITY: Yedek boyutu göster
// ============================================
function showBackupSize() {
  const text = $('#bktext').value;
  const sizeKB = (text.length / 1024).toFixed(2);
  console.log('Backup size: ' + sizeKB + ' KB');
}

// ============================================
// IMPORT: Local File'dan yükle
// ============================================
function importBackupFromFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt,.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      $('#bktext').value = event.target.result.trim();
      alert('Dosya yüklendi. "Geri Yükle" butonuna bas.');
    };
    reader.readAsText(file);
  };
  input.click();
}

// ============================================
// EXPORT: Dosya olarak indir
// ============================================
function exportBackupToFile() {
  const backupText = $('#bktext').value;
  if (!backupText) {
    alert('Önce yedek oluştur');
    return;
  }

  const element = document.createElement('a');
  const file = new Blob([backupText], {type: 'text/plain'});
  element.href = URL.createObjectURL(file);
  element.download = 'bist-terminal-backup-' + new Date().toISOString().slice(0, 10) + '.txt';
  element.click();
  URL.revokeObjectURL(element.href);
}
