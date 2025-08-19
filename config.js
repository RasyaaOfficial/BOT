

const moment= require("moment-timezone")
const { execSync } = require('child_process')

global.dana = '085727264161';       // isi jika aktif, kosong jika nonaktif
global.ovo = '';
global.gopay = '';
global.qris = 'gada';       // link gambar QR, bisa kosong kalau belum ada

// setting by forestapiii
global.base_url = 'https://m.forestapi.web.id' // Do not change this URL.
global.secret_key = 'sk-x1za091t5xds1t'
global.bank_code = 'DANA'
global.owner_name = 'Rasyaa Official'
global.destination_number = '6285602489033'
global.email = 'rasyaanaufall@gmail.com'
global.profit = 10

const config = {
    AutoUpdate          : 'off', // on atau off
    API_KEY             : '05501b702e2deb881646ba79', // APIKEY ANDA AMBIL DI autoresbot.com
    GEMINI_API_KEY      : 'AIzaSyC2x25azDmKxB42kORMznWoebrTwKLcwkc', // https://youtu.be/02oGg3-3a-s?si=9WhaVsLyfc6B-YYI
    phone_number_bot    : '6285602489033', // Nomor BOT
    imgbb_api_key       : 'fe81f7e350e126dbb8897d7dd4670a99',
    PTERO_DOMAIN        : '',
    PTERO_API_KEY       : '',
    PTERO_EGG_ID        : '',
    PTERO_LOCATION_ID  : '',
    type_connection     : 'pairing', // qr atau pairing
    bot_destination     : 'private', // group , private, both
    name_bot            : 'Resbot Ai',
    owner_name          : 'Autoresbot',
    owner_number        : '6285602489033',
    owner_website       : 'autoresbot.com',
    version             : global.version,
    rate_limit          : 3000, // 3 detik
    total_limit         : 100, // limit perhari -  user biasa || kalo premium unlimited
    sticker_packname    : 'resbot',
    sticker_author      : `Date: ${moment.tz('Asia/Jakarta').format('DD/MM/YY')}\nYouTube: Rasyaa Creative`,
    notification        : {
        limit           : 'Hai kak, Limit harian anda sudah habis silakan tunggu besok ya atau berlangganan premium untuk menikmati fitur tanpa limit',
        reset           : 'Dialog berhasil dihapus. Semua percakapan kita telah di-reset dan siap memulai dari awal!',
        ig              : 'kirimkan link instagramnya ya kak',
        fb              : 'kirimkan link facebooknya ya kak',
        tt              : 'kirimkan link tiktoknya ya kak',
        waiting         : 'Hai kak mohon tunggu beberapa saat lagi ya, proses sebelumnya belum selesai',
        qc_help         : 'Tulis textnya ya kak, misal *qc halo*',
        only_owner      : '_❗Perintah Ini Hanya Bisa Digunakan Oleh Owner !_'
        
    },
    success             : {
        hd : 'Ini kak hasil gambarnya, Maaf kalau masih blur',
    },
    error               : {
       FILE_TOO_LARGE : `File terlalu besar. Maksimal ukuran file adalah 99 Mb`,
       THROW          : '_Ada masalah saat terhubung ke server_',
       PLAY_ERROR     : 'Yahh Gagal, Sepertinya ada masalah saat mendowload audio',
       HD_ERROR       : 'Yahh Gagal, Mohon maaf kak, tidak bisa hd in gambar',
       IMAGE_ERROR    : 'Yahh Gagal, Mohon maaf kak, tidak bisa carikan kamu gambar',
       qc             : 'Yah gagal bikin qc nya kak'
    }
}; 

module.exports = config;
