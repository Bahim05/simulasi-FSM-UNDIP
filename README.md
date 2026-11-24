# Jelajah 3D FSM UNDIP

Model 3D kawasan FSM yang bisa diputar dan dimasuki, dibuat dengan Three.js. Saat ini sudah ada **Gedung A**, **Gedung B**, **Gedung E**, **Gedung F**, dan **Gedung G**, ditampilkan bersama di kawasan dan tersambung lewat penghubung (A–E, A–B, dan koridor B–G). Pilih gedung dari daftar *Gedung & fasilitas* (atau klik gedungnya) untuk membuka datanya di panel. Gedung lain menyusul satu per satu.

## Cara menjalankan

Buka foldernya lewat server lokal. Jangan klik dua kali `index.html`, karena browser memblokir `fetch` file JSON dari `file://`.

- **VS Code:** pasang ekstensi *Live Server*, klik kanan `index.html`, pilih *Open with Live Server*.
- **Terminal (Node):** `npx serve .` lalu buka alamat yang muncul.
- **Terminal (Python):** `python -m http.server 8000` lalu buka `http://localhost:8000`.

Three.js dimuat dari CDN (jsDelivr, versi 0.187.0), jadi perlu koneksi internet.

## Deploy ke GitHub Pages

Proyek ini situs statis murni (HTML, CSS, JavaScript, JSON, gambar), tanpa build dan tanpa server. Semua alamat file relatif, jadi hasilnya sama persis di GitHub Pages, termasuk kalau situsnya di bawah subfolder seperti `https://<username>.github.io/<nama-repo>/`.

1. Buat repository baru di GitHub, lalu unggah semua isi folder ini ke akarnya (`index.html` harus ada di akar repo, bukan di dalam subfolder). File `.nojekyll` ikut diunggah.
2. Di repository: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, pilih branch `main` dan folder `/ (root)`, lalu **Save**.
3. Tunggu 1–2 menit. Alamat situsnya muncul di halaman yang sama.

Setiap kali ada perubahan yang di-push ke `main`, situs ikut diperbarui otomatis. Kalau tampilan belum berubah, muat ulang tanpa cache (Ctrl+Shift+R).

Catatan: dengan akun GitHub gratis, GitHub Pages hanya bisa dari repository **publik**, jadi kode, data, dan foto denah di `assets/denah/` ikut terbuka untuk umum.

## Struktur folder

```
index.html            kerangka halaman + import map Three.js
css/style.css         tampilan panel dan kontrol
src/main.js           scene, kamera, tiga mode tampilan, klik pilih ruang
src/builder.js        mengubah JSON gedung jadi objek 3D (dinding, pintu, jendela, tangga, atap)
src/walk.js           mode jalan kaki (first-person): tabrakan, naik tangga, lompat, terbang, kunci kamera
src/ui.js             panel kiri: tab Gedung, Ruang, Tampilan, Referensi
data/kampus.json      daftar gedung, posisi/rotasinya di kawasan, dan penghubung antar gedung
data/gedung-a.json    data lengkap Gedung A, ini sumber kebenarannya
data/gedung-e.json    data lengkap Gedung E
data/gedung-b.json    data lengkap Gedung B
data/gedung-f.json    data lengkap Gedung F
data/gedung-g.json    data lengkap Gedung G
assets/denah/         foto denah (A1-A3, B1-B3, E1-E3, F1-F3, G1-G3) yang sudah diluruskan ke skala, untuk overlay
alat/                 skrip Python penyusun awal data gedung (lihat di bawah), tidak dipakai saat situs berjalan
.nojekyll             supaya GitHub Pages menyajikan file apa adanya (tanpa Jekyll)
```

## Lansekap: jalur dan bidang

Lansekap di `kampus.json` bisa berupa `jalur` (beberapa `penampang` sejajar sebuah garis, seperti undakan dan plaza depan A; `belakang` mengatur bahan muka tepi terluar jalur terakhir) atau `bidang` (poligon datar bebas dengan `atas`, `bahan`, `muka`), dipakai untuk lahan terbuka di depan Gedung A (paving bata merah, undakan, bedeng, rumput, parkir). Bidang boleh bertumpuk asal tingginya beda: yang lebih tinggi menutup yang lebih rendah (bidang dasar rumput sengaja dibuat paling rendah dan diletakkan paling akhir supaya nama tempat di mode jalan kaki mengambil bidang yang lebih spesifik). Bahan yang tersedia: `paving-merah`, `bata-merah`, `beton`, `granit`, `selokan`, `batu-kali`, `batu-hitam`, `tanah`, `rumput`, `aspal`.

Lansekap yang hanya berisi bidang tetapi permukaannya lebih rendah dari tanah dasar (-0,22) perlu `tapak` (poligon kawasan): tanah dasar dilubangi di situ supaya bidang yang lebih rendah terlihat. Dipakai di halaman Gedung F (lantai 1 F di -0,8). Tapak dua lansekap tidak boleh bertumpuk.

## Alat penyusun data (`alat/`)

`alat/gen_gedung_a.py`, `gen_gedung_b.py`, `gen_gedung_e.py`, `gen_gedung_f.py`, dan `gen_gedung_g.py` adalah skrip yang dulu dipakai untuk menyusun `data/gedung-*.json` dari denah dan footage. Isinya juga mencatat alasan tiap ukuran (komentar dan `sumber`). Menjalankannya (`python alat/gen_gedung_b.py`) menulis ulang file JSON gedung itu.

Per 23 Nov 2026 kelima skrip menghasilkan JSON yang persis sama dengan yang ada di `data/`, jadi revisi gedung dilakukan dengan mengedit skripnya lalu menjalankannya ulang. Sumber kebenarannya tetap file JSON. **Kalau JSON sudah diedit langsung, jangan jalankan skrip gedung itu lagi**, karena editan di JSON akan tertimpa. Pilih satu cara untuk tiap gedung: edit JSON-nya, atau edit skripnya lalu jalankan ulang.

## Mode tampilan

| Mode | Isi |
|---|---|
| Kawasan | Tampak luar lengkap dengan atap. Sudut kamera: Isometrik, Atas, Depan. |
| Lantai | Satu lantai dipotong setinggi dada (bisa diatur di tab Tampilan) supaya isi ruang terlihat. Klik lantai ruang untuk melihat detailnya. |
| Jalan kaki | First-person. Seret layar untuk menoleh, WASD atau panah untuk jalan, Shift lari, Esc keluar. Bisa naik tangga antar lantai. **Space** lompat (pagar tetap menahan walau sedang melompat). **Space dua kali** mulai/berhenti terbang: tahan Space naik, tahan Shift turun, **W dua kali** (lalu tahan) terbang cepat; begitu kaki menyentuh lantai, tanah, atau atap, otomatis kembali berjalan. Dinding, lantai, plafon, dan atap tetap menahan saat terbang; atap bisa dipijak. **Q** kunci kamera (kursor hilang, geser mouse langsung menoleh tanpa klik); Esc pertama melepas kunci, Esc berikutnya keluar. Kalau browser menolak pointer lock (mis. di dalam iframe), Q memakai cadangan: menoleh mengikuti gerak mouse tanpa klik. Space yang ditekan saat masih melayang (bukan sesaat setelah melompat) tidak dihitung sebagai ketukan pertama, supaya tidak terbang tanpa sengaja. |

Opsi **Overlay denah asli** menempelkan garis denah 2023 di lantai. Pakai ini untuk mengecek apakah model sudah sesuai blueprint.

## Data gedung (`data/gedung-a.json`)

Semua ukuran dalam meter. Sistem koordinat:

- `x` sepanjang gedung, mulai dari ujung A101 (sisi Gedung E, barat) ke timur.
- `z` dari dinding belakang (utara, z = 0) ke tepi selasar (selatan).
- `y` ke atas, 0 = lantai 1.

Bagian penting per lantai:

- `ruang[]`: `kode`, `nama`, `fungsi` (kelas, toilet, gudang, sirkulasi, tangga), `poligon` titik [x, z], `sumber`, `catatan`. Ruang dengan `void: true` tidak punya pelat lantai (lubang tangga).
- `dinding[]`: garis tengah dinding dari `a` ke `b`, `tebal`, `luar` (dinding luar diberi warna lain), dan `bukaan[]`.
- `bukaan[]`: `jenis` (pintu, pintu-ganda, jendela, jendela-tinggi, ventilasi), `t` = jarak pusat bukaan dari titik `a` dinding, `lebar`, `tinggi`, `ambang` (tinggi bawah jendela), `ruang` (bukaan milik ruang mana). Pintu dengan `papanNama: true` diberi papan kode ruang di atasnya.
- `pagar[]`: pembatas dari `a` ke `b`, format [x, z, dy] dengan dy = tinggi relatif lantai. `jenis`: `besi` (railing) atau `tembok-roster` (tembok berlubang).
- `tempelan[]` (di dalam dinding): papan tipis di muka dinding. `jenis`: `papan-pengumuman`, `poster`, `logo`, `plakat`, `papan-tulis`, `papan-dart`, `tulisan` (huruf besar di bidang gelap), `panel-kisi`, `panel-kayu`, atau `rambu` (papan kecil bertulisan). Posisi memakai `t`, `ambang`, `lebar`, `tinggi` seperti bukaan; `teks` untuk tulisan (baris dipisah `|`); muncul di sisi luar ruang yang disebut di `ruang` (atau paksa lewat `sisi`: 1 kiri, -1 kanan dari arah a ke b).
- `perabot[]`: benda kecil penanda dari footage, `jenis` `tempat-sampah` atau `kotak` (pakai `ukuran` [lebar, dalam, tinggi] dan `arah`), `posisi` [x, z], `warna`. `dasar` mengangkat kotak dari lantai (misalnya panel listrik di dinding).
- Jendela dengan `buram: true` digambar sebagai kaca buram (partisi aluminium kaca susu).
- Pintu boleh punya gaya sendiri: `warnaDaun` (warna daun pintu), `lisKaca: true` (lis putih berkaca sempit di tepi tengah daun), `pegangan: true` (pegangan batang hitam panjang). Dipakai di pintu Departemen Informatika.
- `tempelan` tambahan: `dinding-departemen` (dinding nama departemen: bilah kayu merah tua, panel marmer, huruf biru, nama tegak di sisi kanan; baris kedua `teks` jadi nama besar), `papan-putih` (papan putih bertulisan hitam); `lambang` (lencana Undip kecil); `tulisan` bisa `rata: "kiri"` dan `besarHuruf` (perbandingan tinggi huruf), dan tanpa `teks` jadi panel gelap polos (dipakai untuk portal hitam).
- Jendela `ventilasi` dengan `tertutup: true` digambar rata dengan dinding (tidak terbuka miring).

Di tingkat gedung ada `kolom`, `tangga`, `tritisan`, `atap`, `fondasi` (alas gelap di bawah lantai 1 untuk gedung yang lantainya lebih tinggi dari tanah, seperti Gedung B), dan `mulaiJalan` (titik awal mode jalan kaki). `atap` berupa daftar; tiap atap punya `asal` dan `sudut` sehingga sayap yang miring (seperti di Gedung E) bisa punya atap sendiri. Tangga boleh "terbalik" (`x0` lebih besar dari `x1`): lajur pertama selalu di sisi `x0`.

- Atap perisai bisa dipotong miring (`potong`: garis `a`–`b` dalam koordinat gedung, `simpan` = titik di sisi yang dipertahankan, `jurai: true` menggambar garis jurai di potongan). Dipakai untuk menyatukan atap dua sayap Gedung E: tiap atap diperpanjang (`batas`) lalu dipotong di garis bagi sudut, sementara plafon tetap memakai `batasPlafon`.
- Atap juga bisa dilubangi: `buang` = daftar poligon cembung (koordinat gedung) yang dikeluarkan dari atap. Dipakai di sayap Gedung G yang atapnya masuk ke dinding petak ujung lantai 3. `plafonPoligon` = daftar poligon plafon (koordinat gedung) pengganti kotak `batasPlafon`, untuk plafon yang tidak persegi atau atap yang bertumpuk.
- `atap[].gablet` = { `ujung`: [0] dan/atau [1], `lebar` }: ujung atap perisai diberi gevel segitiga tegak berkisi (atap limasan bergevel), seperti Gedung F. `tritisan[].sudutA/sudutB` memotong miring ujung tritisan supaya dua potongan bertemu rapi di sudut (positif = sudut luar, negatif = sudut dalam).
- `kolom.tambahan`: kelompok kolom yang hanya ada di lantai tertentu (`lantai`: [dari, sampai]) dengan `dasar`/`puncak` sendiri. Dipakai untuk gedung yang jumlah lantainya tidak sama di semua bagian (sayap dua lantai, kolom kanopi).
- `selasar.tambahan`: pelat selasar lain di lantai yang sama, boleh dengan `elevasi` sendiri (selasar sayap, area drop-off).
- Tangga bisa diputar: `putar` (derajat, kelipatan 90) memutar tangga yang disusun di bingkai bawaan (lajur sejajar sumbu z, bordes di z kecil) terhadap titik (0,0) gedung. Dengan `putar: 180` bordesnya ada di z besar.
- Tritisan bisa disambung di sudut: `sudutA` / `sudutB` (derajat belok ke potongan sebelah) membuat ujungnya miring sampai garis bagi sudut, jadi dua potongan bertemu tanpa celah.
- **Posisi kolom (footage)**: muka luar kolom rata dengan muka luar dinding (kolom hanya menonjol ke dalam ruang), dan kolom di tepi selasar berdiri 0,25 m di dalam tepi selasar sehingga ada di belakang muka tembok pembatas. Berlaku di Gedung A, B, dan E.

Setiap gedung punya sistem koordinat sendiri (dijelaskan di field `koordinat` tiap file). `posisi` dan `rotasi` di `kampus.json` yang menaruh gedung di kawasan. Kawasan memakai sistem koordinat Gedung A (x ke timur, z ke selatan); `rotasi` dalam derajat, berlawanan arah jarum jam dilihat dari atas. Gedung E diputar 90 derajat karena sayap lurusnya membujur utara-selatan.

`kampus.json` juga berisi `penghubung[]`: lantai penghubung antar gedung dalam koordinat kawasan (poligon, elevasi tiap lantai, tembok pembatas, atap datar). Tambahan yang dipakai penghubung A–B:
- per lantai: `poligon` dan `tebal` sendiri, `area` (bidang yang dihitung "berada di penghubung", boleh lebih luas dari pelat, misalnya ikut ramp dan tangga), `kolom` sendiri (kosong = tanpa kolom).
- `anakTangga[]`: pelat anak tangga (`poligon`, `elevasi`, `tebal`); `tebal` dipakai untuk tangga yang turun di bawah elevasi lantainya.
- `landai[]`: ramp dari `a` (tinggi `dari`) ke `b` (tinggi `ke`) selebar `lebar`.
- `pagar[]`: titik boleh [x, z, y] untuk pagar miring; `jenis` `tembok-miring` untuk tembok pembatas yang ikut miring di sisi tangga.
- `tampilan` (warna khusus penghubung, menimpa warna Gedung A: `atap`, `kolom`, `dinding`, `pagar`), `papan[]` (papan bertulisan di sisi jembatan: `a`, `b`, `y`, `tinggi`, `sisi`, `jenis` tempelan, `teks`).
- titik `kolom` per lantai dan titik `tiang` boleh [x, z, bawah, atas] (tinggi mutlak per titik) untuk penghubung yang lantainya berundak; `landai[].dinding: false` untuk ramp jembatan di lantai atas (tanpa dinding penutup sampai bawah), `landai[].dasar` untuk mengatur tepi bawah dinding itu, `landai[].tebal` untuk tebal pelat ramp; pagar `tembok-celah` dengan titik [x, z, y] yang beda tinggi digambar ikut miring; `atapPelana[].naik` membuat ujung `b` atap lebih tinggi (kanopi di atas jalan menanjak).
- `warnaBaja` (warna rangka baja kanopi), `tiang[]` (tiang baja kanopi), `alasKolom.lebar` (alas lebih lebar dari kolom), `atapPelana[]` (tambahan: `kudaKuda` jarak kuda-kuda putih, `kudaMulai`, `lebarKolom`, `gording` jumlah gording kayu per bidang, `plafonMiring` papan plafon putih di bawah atap) (atap pelana genteng atau seng; `sisiSaja` 1/-1 untuk satu sisi, `mulai` untuk atap sayap yang menempel di sisi jembatan), `bangku[]` (bangku besi berderet), `alasKolom`.

`kampus.json` juga bisa berisi `lansekap[]`: bentuk tanah di luar gedung (undakan, selokan, tembok, plaza), juga dalam koordinat kawasan.
- `jalur.a` dan `jalur.b`: garis acuan (biasanya tepi selasar). `sisi` 1 atau -1 menentukan arah keluar dari garis itu.
- `penampang[]`: urutan jalur sejajar dari garis acuan ke luar. Tiap jalur punya `nama`, `lebar`, `atas` (tinggi permukaan), `bahan` (permukaan), `muka` (muka tegak di sisi gedung), dan `ujung` (muka di ujung-ujungnya).
- Bahan yang tersedia: `granit`, `beton`, `selokan`, `batu-kali`, `paving-merah`, `bata-merah`. Teksturnya digambar di canvas dan menyambung antar blok.
- `tangga[]`: `t` (posisi sepanjang garis), `lebar`, dan jalur `dari` dan `ke` (indeks penampang). Jalur di antaranya dipotong dan diganti anak tangga. `pegangan: true` menambah pipa pegangan.
- `benda[]`: benda di koordinat kawasan, tidak terikat jalur: `jenis` `paviliun` (atap datar, 4 kolom, meja bar), `pendopo` (alas beton, tiang kayu, atap datar tipis, plafon bilah kayu, kisi kayu di `sisiKisi`, bangku L; `panjang`, `lebar`, `alas`, `tinggi`), `tugu`, `rumah-kecil`, `bangku-segienam`, `pot-bundar`, `ayunan`; posisi `x`, `z`, tinggi alas `y`, `arah` (derajat). Kolom paviliun, tugu, rumah kecil, bangku, dan bak tanaman menahan pejalan; atap paviliun bisa dipijak saat terbang.
- `pot[]`: pot tanaman berjarak tetap di sebuah jalur. `perabot[]`: `bangku` atau `ayunan` di jalur terakhir, posisinya `t` dan `v` (jarak dari awal jalur itu).

Setiap ruang, pintu, dan tangga punya `sumber`:

- `denah-2023`: diambil langsung dari denah.
- `koreksi-lapangan`: hasil keterangan lapangan karena denah 2023 sudah tidak sesuai.
- `footage-2026`: diambil dari footage video lapangan. **Kalau footage dan denah berbeda, yang dipakai footage** karena lebih baru.
- `foto-udara-2026`: letak dan susunan gedung dari foto udara.

Di viewer, data koreksi ditandai titik oranye. Bisa juga diwarnai lewat *Tampilan > Warna lantai ruang > Menurut sumber data*.

## Koreksi lapangan Gedung A (November 2026)

- **Atap pinggiran di semua sisi** (keterangan pengguna, 24 Nov 2026): selain di depan selasar, tritisan genteng setinggi lantai 2 dan lantai 3 juga ada di sisi belakang, ujung timur, dan ujung barat (ujung barat berhenti di penghubung ke Gedung E). Jalur beratap dari Gedung F bersambung ke atap pinggiran belakang di pojok timur laut.

- Lantai 3: A301 lama (10 m) dan A302 lama (13,3 m) masing-masing disekat dua, jadi A301 sampai A304. A303 dan A304 lama sekarang A305 dan A306. Lebar sekat **diasumsikan sama rata**.
- Pintu A301 baru posisinya **diasumsikan** (x = 3,9 m).
- Kamar mandi 1 dan 2 berdampingan di belakang blok servis, ukurannya sama, pintunya menghadap lorong terbuka ke selasar. Di denah 2023 area kamar mandi 2 tergambar kosong.
- Gudang hanya ada di lantai 1. Di lantai 2 dan 3 bekas area gudang menjadi bagian lorong.
- Tangga bentuk U dengan bordes di sisi belakang, hanya dibatasi pagar besi (tanpa dinding).
- Sisi selasar ruang kelas tidak punya jendela besar, hanya jendela ventilasi panjang di atas (daun kaca engsel atas, bisa dibuka-tutup). Jendela besar hanya di dinding belakang.
- Tiap pintu kelas punya papan kode ruang di tembok tepat di atasnya.
- Pembatas selasar lantai 2 dan 3 berupa tembok setinggi sekitar 1 m dengan lubang-lubang (roster), bukan pagar besi.
- Atap perisai abu-abu gelap, dinding luar abu-abu muda.
- Papan nama di atas pintu gudang, Toilet Pria, dan Toilet Wanita.

### Depan Gedung A (footage November 2026)

Lantai 1 Gedung A lebih rendah dari plaza di depannya. Dari selasar ke luar urutannya:
1. Satu anak tangga granit hitam.
2. Jalur beton.
3. Selokan.
4. Tiga undakan beton berpot tanaman.
5. Tembok batu kali hitam bernat putih. Atasnya sedada sampai seleher kalau berdiri di jalur beton.
6. Jalur paving merah, satu anak tangga, lalu plaza paving merah dengan bangku dan ayunan.

Bentuk ini juga menerus di sisi selatan penghubung A–E lantai 1. Tangga turun ke selasar ada di tengah gedung dan di ujung barat ke arah penghubung (yang ini berpipa pegangan). Plaza berdiri sendiri. Kedalaman 10 m, ujung timurnya, dan letak bangku/ayunan masih perkiraan. Pohon tidak dibuat.

## Gedung E: koreksi lapangan dan footage (November 2026)

Sumber utama: footage video 21 November 2026 (7 klip + 3 foto). Data dari footage diberi `sumber: "footage-2026"`.

- **Penghubung A–E** tiba di hall di depan blok R. BEM / Kantor Dosen / R. HMIF (di antara kolom selasar E x 2,43 dan 5,43). Lantai penghubung satu anak tangga lebih rendah dari selasar A di lt 2 dan 3; di ujung sisi E naik 1 anak tangga (lt 2) dan 2 anak tangga (lt 3).
- **Blok R. BEM / Kantor Dosen / R. HMIF mengikuti footage, bukan denah 2023.** Dilihat dari hall, urutannya: dinding lorong toilet berjendela tinggi gelap (menghadap timur), sudut di mulut lorong, dinding poster pendek (menghadap selatan), pilaster abu-abu, lalu dinding pintu yang tegak lurus sayap miring dan menghadap tenggara ke penghubung. Di lt 3 dinding itu berisi pintu HMIF dengan pelat logo hmif di atasnya, papan pengumuman biru, dan dua tempat sampah (hitam dan kuning). Di balik sudutnya ada plakat **Departemen Informatika / FSM / Undip** berbingkai kayu oranye, lalu papan tulis. Blok ini jauh lebih kecil dari gambar denah (yang memanjang sampai garis depan sayap lurus dengan "moncong" kecil), dan pintu kedua di dinding depan sayap miring tidak ada. Supaya dinding depan ruang sudut bertemu sudut pintu HMIF, garisnya dibelokkan sekitar 11 derajat mulai dari sekat R. Senat. Ukuran dari footage ini perkiraan (sekitar 0,5 m).
- **Tangga tengah dan mulut lorong toilet** digeser 0,9 m ke arah selasar (anak tangga pertama z 8,0) supaya cocok dengan panjang lorong di footage. Ceruk di depan tangga jadi sekitar 2,5 m.
- **Beda tinggi A–E (footage penghubung lt 2 dan lt 3, dibetulkan 22 Nov)**: di lt 2 lantai penghubung rata dengan selasar A lalu naik 1 anak tangga ke E; di lt 3 dari selasar A naik 1 anak tangga ke penghubung lalu naik 2 anak tangga ke E. Dengan anak tangga ±16 cm, lantai 2 E di +4,16 dan lantai 3 E di +8,48 (A: +4,00 dan +8,00). Sebelumnya penghubung tergambar turun dulu, itu salah arah.
- **Penghubung A–E lantai 3 beratap** seng dengan rangka besi gelap (sebelumnya terbuka). Kolom penghubung di lt 3 jadi pilaster pendek di tengah tembok pembatas.
- **Atap E menyatu** seperti di foto satelit (jurai lembah di sisi belakang, jurai di sisi selasar), dan **tritisan di sudut balkon** menyambung tanpa celah.
- **Balkon INFORMATIKA**: tulisan tidak lagi tertutup kolom karena kolom selasar sekarang di belakang muka tembok.
- **Pintu Departemen Informatika** (footage tour lt 3): portal hitam mengilap menonjol, tulisan putih di kepala portal dengan lencana Undip kecil, pintu ganda merah marun berlis putih berkaca sempit dan pegangan batang hitam, kisi kayu vertikal di kiri, di atas, dan panel lebar di kanan.
- **Plakat Departemen** di dinding depan dekat sudut blok HMIF, urutan dari sudut: panel kayu polos dengan lis merah tua, plakat berbingkai krem (kayu gelap di atas dan bawah, panel kayu merah dengan lambang dan huruf baja), panel kayu sempit, papan tulis besar berbingkai aluminium, lalu pintu Ruang Sidang (digeser sedikit).
- **Lorong toilet** lurus ke utara di antara blok R. BEM dan tangga. Di ujungnya: **KM Disabilitas (lt 1)** atau **Gudang (lt 2 dan 3)**, pintu menghadap selasar. Toilet wanita (pintu kiri) dan toilet pria (pintu kanan, papan bergambar pria) saling berhadapan di dekat ujung lorong. Pria/wanita untuk pintu kiri ditebak.
- **Gudang di bawah tangga** (lt 1), pintu menghadap selasar di samping anak tangga pertama.
- **Tangga tengah**: bentuk U, lajur pertama menempel dinding E101, di antara lajur ada tembok setengah badan berpipa pegangan, tiang hias di anak tangga pertama, anak tangga keramik krem dengan list gelap.
- **Tangga samping** di luar ujung utara (dekat parkiran motor): bentuk U, tembok pembatas, pipa pegangan.
- **Pembatas selasar lt 2–3**: tembok dengan celah-celah vertikal dan pipa di atasnya. Balkon di pertemuan dua sayap bertembok penuh; di lt 3 bertuliskan **INFORMATIKA**.
- **Urutan ruang lt 3 sayap lurus** dari tangga ke ujung utara: Ruang STI, Ruang Rapat, Departemen Informatika, Ruang RPL (terbalik dari denah 2023). Garis sekat tetap mengikuti denah. Pintu Departemen Informatika berbingkai hitam dengan tulisan besar dan panel kisi kayu di sisi timurnya.
- **Sayap miring lt 3** dari footage: R. Skripsi sekarang **Ruang Sidang** (papan di pintu dan di dinding, ada pintu kedua), R. Siscer sekarang **Coworking Space** (pintu ganda berpapan).
- **Papan nama lt 2** dari footage: "Laboratorium Komputer D" di pintu selatan Lab Komputer, "Ruang Dosen KG / Ruang Dosen RPL" di pintu utara R. KAVI, "Lab Layanan Komputasi B/C" di pintu sayap miring.
- Atap tritisan genteng di depan selasar lt 2 dan 3 seperti Gedung A.

## Gedung B (November 2026)

Sumber: denah 2023 lembar B, folder footage Gedung B (lobi, lorong toilet, tangga, penghubung lt 1, jembatan lt 2, tampak samping), dan foto udara dari pengguna (22 Nov 2026).

- **Letak dari foto udara**: B sejajar A, bergeser ke tenggara. Ujung barat atap B kira-kira 7 m di barat ujung timur atap A, dan tepi utara selasar B sekitar 9,4 m di selatan tepi selasar A. Di kawasan B diputar 180 derajat (`posisi` [82, 37], `rotasi` 180). Angka ini perkiraan dari foto, gampang digeser di `kampus.json` (kalau digeser, samakan juga `PX` di alat penyusun B supaya celah pembatas jembatan ikut pindah).
- **Denah B sempat terbalik (cermin)** saat diluruskan pertama kali; sudah dibetulkan. Dengan denah yang benar, denah, footage lobi, dan foto udara cocok: tangga di ujung barat, selasar menghadap utara ke plaza dan Gedung A.
- **Lantai 1 B sekitar 1,2 m di atas lantai 1 A** (keterangan lapangan). Di bawah lantai 1 dan selasar ada alas abu-abu gelap (`fondasi`).
- **Selasar berbentuk U** (depan + kedua ujung, lebar 2,8 m) mengikuti denah. Pembatas lt 2–3 tembok berpipa seperti Gedung A, tritisan genteng di depan selasar.
- **Petak ujung barat mengikuti footage, bukan denah** (denah menulis Janitor): dari selasar masuk lobi; menghadap ke belakang, lorong di kiri menempel dinding B101 (panel listrik di dinding itu), dua pintu toilet berdampingan di ujung lorong, gudang di belakang bordes dengan pintu dari lorong, partisi kaca buram antara lorong dan tangga, mesin minuman dan banner di kaki tangga. Tangga U, lajur 1 menempel dinding ujung lalu berbalik ke kiri. Ukuran toilet dan gudang perkiraan.
- **Lantai 3**: Kantor Departemen di ujung timur, lalu B303, B302, B301.
- **Penghubung A–B** di pojok timur selasar Gedung A (x 42,3–44,7, menempel kolom sudut A) dan tiba di depan lobi Gedung B:
  - Lt 1: jalan beratap dari selasar A (naik satu anak tangga) ke selasar B. Di ujung B naik lewat ramp (sisi barat) dan tangga (sisi timur). Atap sayap genteng berkasau kayu, kolom putih beralas batu hitam.
  - Lt 2 dan lt 3: jembatan bertembok putih dengan bangku besi di sisi barat. Di ujung A masing-masing turun 7 anak tangga ke selasar A (lantai B 1,2 m lebih tinggi). Jembatan lt 2 beratap pelat jembatan lt 3; jembatan lt 3 beratap seng berangka besi merah bata.
  - Tembok pembatas dan tritisan lt 2 dan lt 3 di Gedung A dan B dibuka/dipotong di titik sambungan.
  - Panjang, lebar, tinggi anak tangga, dan bangku di lt 3 masih perkiraan.
- Koridor dari ujung barat B sekarang menuju Gedung G (penghubung `BG`), lihat bagian Gedung G.
- **Pojok timur selasar depan** dibuka untuk penghubung F-B (FIX FOOTAGE, 24 Nov 2026): tembok pembatas dan tritisan lt 2-3 terputus di kawasan x 81,0-84,2, kolom tepi selasar di x lokal 0 dihapus karena jatuh di tengah jembatan (`JF` di alat penyusun B).

## Gedung G (November 2026)

Sumber: denah Gedung G LT.1 sampai LT.3 dan foto udara dari pengguna dengan tempelan denah (22 Nov 2026). **Belum ada footage**, jadi tampak luar (jendela, pintu kecil, tangga) masih perkiraan.

- **Letak**: di barat daya Gedung B, diputar -45 derajat (`posisi` [15,8, 24,6]). Arah dan letaknya dari tempelan denah di foto udara, diikat ke Gedung B: blok tengah membentuk sudut 45 derajat dengan B, pintu tengah Area Resepsionis kira-kira 12 m di barat daya ujung barat B. Dengan sudut ini sayap Perpustakaan lurus ke barat dan sayap R. PD3 lurus ke selatan, sama seperti di foto. Ukuran denah ternyata cocok dengan tempelan (selisih ±3%), jadi ukuran denah dipakai apa adanya.
- **Bentuk**: badan 42 m dengan blok tengah 18 x 21 m yang menonjol ke dua sisi (Area Resepsionis menghadap B, lobi dan drop-off menghadap parkiran), dua sayap 12 x 8,5 m yang miring 45 derajat di kedua ujung. Sayap hanya dua lantai; lantai 3 hanya badan (petak ujung 12 x 12 m) dan blok tengah.
- **Tinggi**: lantai 1 G rata dengan koridor dari Gedung B (tanpa anak tangga), jadi sama dengan lantai 1 B (+1,2 m dari lantai 1 A). Lantai 2 dan 3 di +4,00 dan +8,00 dari lantai 1 G (denah).
- **Atap genteng cokelat tua** (foto udara): atap perisai badan dan atap perisai blok tengah yang bersilang, sehingga puncaknya di tengah seperti di foto. Atap sayap lebih rendah dan masuk ke dinding petak ujung lantai 3.
- **Lantai 1**: Perpustakaan (petak ujung barat laut + sayap), Area Resepsionis, Pojok Statistik, lobi dua kali tinggi lantai (void di lantai 2 dan 3), toilet, gudang, R. Dosen, R. Pembantu Dekan 3. Separuh sayap R. PD3 berupa selasar terbuka berkolom (denah: SELASAR -0,05). Teras dan **drop-off beratap kanopi** (keterangan pengguna) di depan lobi.
- **Lantai 2**: G201–G208, Women Area, Unit Bisnis, Dapur, toilet, R. Departemen Biologi (petak tenggara + sayap). Nomor G207 tidak terbaca di denah.
- **Lantai 3**: G305, G307 (denah menulis G305 untuk dua ruang), Meeting Room, G304, G306, gudang, toilet.
- Dua tangga U: tangga utara di samping lobi (letak dari denah, bordes menempel dinding luar) dan tangga selatan di sebelah R. Dosen.
- Pintu kaca di dinding Area Resepsionis menghadap B (x 22,6, ujung koridor B–G), dan pintu utama kaca dari lobi ke teras.

### Koridor B–G dan lahan terbuka depan Gedung A (22 Nov 2026)

- **Koridor B–G** (penghubung `BG`, menggantikan koridor `BL` yang arahnya salah): dari **pojok barat laut selasar Gedung B** (di samping ramp penghubung A–B) lurus ke pintu kaca Area Resepsionis G, mengikuti garis biru pengguna (22 Nov 2026). Koridor membentuk sudut ±17 derajat dari tegak lurus dinding G, mulutnya di selasar ujung B selebar ±6,8 m (z 23,4–30,2), panjang sumbu ±15,6 m. Lantai keramik rata dengan selasar B (1,15), **tanpa anak tangga** (keterangan pengguna), lantai 1 G 5 cm lebih tinggi. Gaya dari footage: kolom putih ramping beralas batu kali hitam ±80 cm, atap pelana genteng berkuda-kuda putih tiap pasang kolom, gording kayu gelap, plafon putih. Kedua ujung atap dipotong miring mengikuti muka dinding G dan tepi selasar B (`miringA` / `miringB` di `atapPelana`). Kolom tepi selasar B yang jatuh di mulut koridor hanya ada di lantai 2 dan 3 (`kolom.tambahan` di Gedung B), jadi di lantai 1 tidak ada tiang di tengah jalan masuk. Lebar pelat 3,2 m (perkiraan).
- **Lahan terbuka depan Gedung A** (lansekap `halaman-selatan-A`, menggantikan `bata-merah-B`). Tidak ada lagi lubang ke tanah dasar:
  - **Paving bata merah rata 1,05** dari plaza A sampai ujung barat selasar B, koridor B–G, dan Gedung G; di barat menerus sampai garis sisi utara sayap Perpustakaan (garis merah pengguna). Plaza A ikut diturunkan ke 1,05 sehingga plaza dan lahan paving satu bidang tanpa undakan (keterangan pengguna; naik-turun kecil di lapangan sengaja diabaikan). Paving 10 cm di bawah lantai koridor, seperti di footage.
  - bedeng tanaman 1,12 selebar 2 m di sisi tenggara koridor (kiri kalau berjalan dari B), sisanya sampai B dan G rumput;
  - rumput 0,88 sebagai permukaan dasar di sekitar B dan G, tepinya tembok batu kali (di sisi Gedung E sekitar 2 m dari selasar E);
  - parkir aspal 0,95 di sisi drop-off G.
  - Jalur depan A diperpanjang sampai sisi penghubung A–B (x 41,85); ujungnya jadi tembok batu kali. Tembok batu kali di depan selasar A sekarang setinggi ±1,2 m dari jalur beton.
  - Batas parkir dan batas rumput perkiraan. Pohon tidak dibuat.
- **Isi lahan terbuka dari video pengguna (23 Nov 2026, direkam dari selasar lt 3 Gedung A)**, `benda[]` dan dua `bidang` baru di `halaman-selatan-A`: paviliun beratap datar gelap di atas pelataran beton (0,30 m di atas paving) di depan Gedung E dan sayap Perpustakaan G, ayunan di bak tanaman bertepi beton di depan E (ayunan lama di plaza A dipindah ke sini), tugu persegi merah muda, dua rumah kecil merah muda, bak bundar, dan dua bangku segi enam. **Letaknya masih perkiraan** (posisi kamera tidak bisa dipastikan); di video paviliun tampak lebih jauh dari A daripada yang muat di model, jadi letak sayap Perpustakaan G perlu dicek. Undakan kecil di lahan sengaja tidak dibuat (lahan tetap rata).

## Gedung F (November 2026)

Sumber: denah Gedung F LT.1 sampai LT.3, foto udara dari pengguna (22 Nov 2026), foto ujung barat (23 Nov 2026), dan **FIX FOOTAGE (24 Nov 2026)**: lobby lt 1 dekat tangga dalam, tangga lt 1-2 dan lt 2-3, koridor lt 1-3, KM dan gudang lt 2-3, serta video penghubung F-B.

- **Orientasi: denah dipakai apa adanya lalu diputar 30 derajat** (`rotasi` -30). Sayap R. Dosen (yang miring di denah) jadi sejajar Gedung A dan B di barat, dengan tangga luar di ujung baratnya, dan sayap R. Seminar / Lab (yang lurus di denah) belok 30 derajat ke tenggara, sesuai foto udara. Versi pertama mencerminkan denah; ditinggalkan karena letak tangganya jadi terbalik. Di foto udara sayap barat terlihat lebih panjang dari 25,6 m; panjang sayap sementara tetap mengikuti denah.
- **Letak**: di timur Gedung A dan utara Gedung B, `posisi` [93,8, -12,6]. Mula-mula [93,8, -5,7] dari foto udara; 24 Nov 2026 dimundurkan 6,9 m ke utara karena ukuran pengguna di Google Earth (panjang penghubung F-B 23,19 m; A-B 9,3 m cocok dengan model, jadi B tetap). Dengan letak ini pojok selasar F di dekat tangga luar segaris dengan dinding belakang A, sesuai keterangan pengguna. Ujung barat sekitar 20 m di timur ujung A.
- **Tinggi: lantai 1 F di -0,80** (lt 2 di 3,20, lt 3 di 7,20), paling rendah di antara A dan B. Angkanya dari footage penghubung F-B: di tiap lantai jalan dari F ke B naik dua kelompok ±6 anak tangga (bersama ramp), sekitar 2 m, jadi lantai 1 F ±2 m di bawah lantai 1 B (+1,2). Jalur beratap ke A juga menanjak.
- **Bentuk**: sayap R. Seminar 30,28 x 10 m dan sayap R. Dosen 30 derajat terhadapnya (dinding belakang 25,6 m, dinding depan 28,8 m, dalam 10 m), selasar 2,8 m di sisi dalam sudut. Tangga luar 2,8 m di ujung barat. Koordinat data gedung = koordinat denah.
- **Pertemuan dua sayap (footage, menggantikan denah)**:
  - Tangga U: lajur 1 menempel dinding R. Kerja, naik dari lobi ke belakang; bordes menempel dinding belakang dengan jendela memanjang berteralis di atasnya (dari bordes terlihat kanopi di belakang gedung); lajur 2 berbalik ke depan. Tembok setengah badan bertutup abu di antara lajur dan tiang hias putih di anak tangga pertama.
  - Lt 1: lobi terbuka ke selasar; gudang berpintu aluminium di bawah lajur 2; di sebelah baratnya lorong lurus ke **pintu belakang berteralis** menuju paving dan parkir motor di belakang F; Toilet Difabel di pojok belakang lorong (pintu menghadap depan); pintu Toilet Pria dan Toilet Wanita berdampingan di dinding barat lorong; ruang kecil berpintu kayu menghadap lobi (lt 1: R. Kegiatan Mahasiswa Departemen Matematika; lt 2: F205; lt 3 belum terbaca). Papan Informasi Departemen Matematika di dinding lobi, kolom di antara lorong dan sumur tangga.
  - Lt 2-3: lorong servis yang sama (toilet pria/wanita/difabel, gudang di samping Toilet Difabel; gudang lt 3 berpintu kaca), lobi di depan sumur tangga.
  - Toilet dan ruang kecil masuk ke ujung timur sayap R. Dosen (x 4,6-8,28), ukurannya perkiraan dari video.
- **Ruang**: sayap barat satu ruang dosen tiap lantai (R. Dosen 1-3; lt 3 ada R. Himpunan Mahasiswa Statistika di pojok ujung barat). Sayap tenggara: lt 1 R. Kerja / R. Hukum S2 Matematika dan R. Seminar / R. Sidang; lt 2 R. Terapan & Analisis dan Lab Komputasi; lt 3 R. Teknisi Lab Komputasi dan R. Baca.
- **Selasar (footage)**: lt 1 kursi tunggu besi; lt 2 meja belajar bersekat menempel dinding di kedua sayap, papan nama kayu "Program Studi Sarjana Departemen Matematika" tepat di ujung penghubung F-B; lt 3 papan nama Departemen Statistika di dekat ujung penghubung, **dinding nama Departemen Statistika** (bilah kayu merah, panel marmer) tepat di depan anak tangga teratas, dan sekat setengah tinggi "Ruang Kerja Mahasiswa 2 / Student Working Space 2" di ujung tenggara.
- **Atap bertingkat** (foto ujung barat, 23 Nov 2026): atap utama genteng merah bata, dua atap perisai dipotong di garis bagi sudut, kedua ujungnya bergevel berkisi (`gablet`). Atap tingkat bawah setinggi plafon lt 3 (3,7 m di atas selasar, membungkus ujung barat sampai menaungi tangga luar; 1,5 m di sisi belakang dan ujung tenggara, perkiraan). Tritisan genteng di tepi luar selasar lt 2 dan lt 3, terputus di mulut penghubung F-B.
- **Tangga luar ujung barat** terbuka, bertembok pembatas, anak tangga terang. **Tembok pembatas selasar putih bercelah tegak**, kolom dan lis abu kebiruan, dinding putih (foto). Celah tembok pembatas lt 2-3 untuk penghubung F-B ada di antara dua kolom tepi selasar (a 9,6-12,8 di sayap R. Dosen).

### Penghubung F-B, jalur F-A, dan halaman F-B (FIX FOOTAGE, 24 Nov 2026)

- **Penghubung F-B** (`FB` di `kampus.json`): lurus dari selasar sayap R. Dosen F (kawasan x 81,0-84,2, di antara dua kolom tepi selasar) ke pojok timur selasar depan B, sesuai atap putih panjang di foto udara. **Panjang 23,2 m** (ukuran pengguna 23,19 m). Tiga lantai, tiap lantai naik 2 m dari F ke B (lt 1 -0,85 ke 1,15; lt 2 3,15 ke 5,15; lt 3 7,15 ke 9,15). Lajur barat ramp, lajur timur dua kelompok 6 anak tangga, bordes bersama di tengah (video dari B lt 2, dari F lt 3, lt 1, lt 3). Di lt 2-3 bagian bawah lajur tangga diisi pejal sampai bawah ramp dan ramp berpelat 0,4 m, supaya bawah jembatan tidak bolong.
  - Lt 1: jalan terbuka berkolom dengan railing stainless, beratap genteng di kedua sisi menempel di bawah pelat lt 2, berundak mengikuti lajur.
  - Lt 2: jembatan bertembok putih bercelah (ikut miring di bagian ramp dan tangga) dan sekat tengah, beratap pelat lt 3; papan putih "Departemen Matematika / Program Studi S1 dan S2 Matematika" di sisi barat, di antara dua kolom pertama dari F (foto samping).
  - Lt 3: terbuka bertembok sama, beratap seng berangka besi merah bata, berundak tiga.
  - Lebar 3,2 m; panjang bagian datar, ramp, dan tangga perkiraan dari video.
- **Jalur beratap F-A** (`FA`): dari ujung barat selasar F (di samping tangga luar) turun satu anak tangga, lalu jalan paving block ±1,8 m menanjak landai **lurus ke barat** sampai pojok belakang Gedung A (keterangan pengguna dan 4 foto ke arah barat-barat laut). Kanopi seng berangka besi biru bertiang ramping berhenti di pojok A dan bersambung, dengan celah, ke atap pinggiran belakang A. Bedeng semak di sisi selatan, parkir motor berpaving di sisi utara. Dari pojok A jalan beton menyusur ujung timur A ke selasar depan A (perkiraan, supaya jalur tersambung).
- **Halaman F-B** (lansekap `halaman-F`, dengan `tapak`): tanah di sekitar F diturunkan. Di tepi tapak ada tembok penahan batu kali (setinggi tanah di luar tapak, -0,2), supaya beda tinggi dengan tanah dasar tidak terlihat bolong. Halaman selebar ±23 m berundak naik dari depan selasar F (-0,93) ke undakan tengah (-0,25) dan undakan atas (0,45), bertembok batu kali, dengan anak tangga beton di x ±69,5; jalan beton 0,55 di kaki selasar B (selasar B 0,6 m lebih tinggi, video pendopo malam). Di belakang F paving dan parkir motor (footage pintu belakang). Batas undakan dan tingginya perkiraan.
- **Tiga pendopo depan B** (`benda` jenis `pendopo`) berderet sejajar B di undakan atas, di tengah antara selasar F dan selasar B (z 12,8): alas beton merah muda keabuan ±0,3 m, tiang kayu, atap datar tipis gelap, plafon bilah kayu, kisi kayu, bangku L (foto dan video). Lebih rendah dari lantai B. **Letaknya perkiraan dari video**.

## Menambah gedung berikutnya

1. Buat `data/gedung-x.json` dengan struktur yang sama.
2. Ubah status gedung itu di `data/kampus.json` jadi `"dibuat"`, isi `file`, `posisi`, dan `rotasi`.
3. Kalau tersambung ke gedung lain, tambahkan entri di `penghubung[]` dan buka tembok pembatas selasar di titik sambungnya.

Viewer memuat semua gedung berstatus `dibuat` dan menaruhnya bersama di kawasan. Mode jalan kaki bisa berpindah gedung lewat penghubung.
