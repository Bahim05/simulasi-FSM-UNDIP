# Jelajah 3D FSM UNDIP

Model 3D kawasan FSM yang bisa diputar dan dimasuki, dibuat dengan Three.js. Saat ini sudah ada **Gedung A**, **Gedung B**, dan **Gedung E**, ditampilkan bersama di kawasan dan tersambung lewat penghubung (A–E dan A–B). Pilih gedung dari daftar *Gedung & fasilitas* (atau klik gedungnya) untuk membuka datanya di panel. Gedung lain menyusul satu per satu.

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
src/walk.js           mode jalan kaki (first-person) + tabrakan dinding dan naik tangga
src/ui.js             panel kiri: tab Gedung, Ruang, Tampilan, Referensi
data/kampus.json      daftar gedung, posisi/rotasinya di kawasan, dan penghubung antar gedung
data/gedung-a.json    data lengkap Gedung A, ini sumber kebenarannya
data/gedung-e.json    data lengkap Gedung E
data/gedung-b.json    data lengkap Gedung B
assets/denah/         foto denah 2023 (A1-A3, B1-B3, E1-E3) yang sudah diluruskan ke skala, untuk overlay
alat/                 skrip Python penyusun awal data gedung (lihat di bawah), tidak dipakai saat situs berjalan
.nojekyll             supaya GitHub Pages menyajikan file apa adanya (tanpa Jekyll)
```

## Alat penyusun data (`alat/`)

`alat/gen_gedung_a.py`, `gen_gedung_b.py`, dan `gen_gedung_e.py` adalah skrip yang dulu dipakai untuk menyusun `data/gedung-*.json` dari denah dan footage. Isinya juga mencatat alasan tiap ukuran (komentar dan `sumber`). Menjalankannya (`python alat/gen_gedung_b.py`) menulis ulang file JSON gedung itu.

Sumber kebenarannya tetap file JSON. **Kalau JSON sudah diedit langsung, jangan jalankan skrip gedung itu lagi**, karena editan di JSON akan tertimpa. Pilih satu cara untuk tiap gedung: edit JSON-nya, atau edit skripnya lalu jalankan ulang.

## Mode tampilan

| Mode | Isi |
|---|---|
| Kawasan | Tampak luar lengkap dengan atap. Sudut kamera: Isometrik, Atas, Depan. |
| Lantai | Satu lantai dipotong setinggi dada (bisa diatur di tab Tampilan) supaya isi ruang terlihat. Klik lantai ruang untuk melihat detailnya. |
| Jalan kaki | First-person. Seret layar untuk menoleh, WASD atau panah untuk jalan, Shift lebih cepat, Esc keluar. Bisa naik tangga antar lantai. |

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
- `tempelan` tambahan: `lambang` (lencana Undip kecil); `tulisan` bisa `rata: "kiri"` dan `besarHuruf` (perbandingan tinggi huruf), dan tanpa `teks` jadi panel gelap polos (dipakai untuk portal hitam).
- Jendela `ventilasi` dengan `tertutup: true` digambar rata dengan dinding (tidak terbuka miring).

Di tingkat gedung ada `kolom`, `tangga`, `tritisan`, `atap`, `fondasi` (alas gelap di bawah lantai 1 untuk gedung yang lantainya lebih tinggi dari tanah, seperti Gedung B), dan `mulaiJalan` (titik awal mode jalan kaki). `atap` berupa daftar; tiap atap punya `asal` dan `sudut` sehingga sayap yang miring (seperti di Gedung E) bisa punya atap sendiri. Tangga boleh "terbalik" (`x0` lebih besar dari `x1`): lajur pertama selalu di sisi `x0`.

- Atap perisai bisa dipotong miring (`potong`: garis `a`–`b` dalam koordinat gedung, `simpan` = titik di sisi yang dipertahankan, `jurai: true` menggambar garis jurai di potongan). Dipakai untuk menyatukan atap dua sayap Gedung E: tiap atap diperpanjang (`batas`) lalu dipotong di garis bagi sudut, sementara plafon tetap memakai `batasPlafon`.
- Tritisan bisa disambung di sudut: `sudutA` / `sudutB` (derajat belok ke potongan sebelah) membuat ujungnya miring sampai garis bagi sudut, jadi dua potongan bertemu tanpa celah.
- **Posisi kolom (footage)**: muka luar kolom rata dengan muka luar dinding (kolom hanya menonjol ke dalam ruang), dan kolom di tepi selasar berdiri 0,25 m di dalam tepi selasar sehingga ada di belakang muka tembok pembatas. Berlaku di Gedung A, B, dan E.

Setiap gedung punya sistem koordinat sendiri (dijelaskan di field `koordinat` tiap file). `posisi` dan `rotasi` di `kampus.json` yang menaruh gedung di kawasan. Kawasan memakai sistem koordinat Gedung A (x ke timur, z ke selatan); `rotasi` dalam derajat, berlawanan arah jarum jam dilihat dari atas. Gedung E diputar 90 derajat karena sayap lurusnya membujur utara-selatan.

`kampus.json` juga berisi `penghubung[]`: lantai penghubung antar gedung dalam koordinat kawasan (poligon, elevasi tiap lantai, tembok pembatas, atap datar). Tambahan yang dipakai penghubung A–B:
- per lantai: `poligon` dan `tebal` sendiri, `area` (bidang yang dihitung "berada di penghubung", boleh lebih luas dari pelat, misalnya ikut ramp dan tangga), `kolom` sendiri (kosong = tanpa kolom).
- `anakTangga[]`: pelat anak tangga (`poligon`, `elevasi`, `tebal`); `tebal` dipakai untuk tangga yang turun di bawah elevasi lantainya.
- `landai[]`: ramp dari `a` (tinggi `dari`) ke `b` (tinggi `ke`) selebar `lebar`.
- `pagar[]`: titik boleh [x, z, y] untuk pagar miring; `jenis` `tembok-miring` untuk tembok pembatas yang ikut miring di sisi tangga.
- `warnaBaja` (warna rangka baja kanopi), `tiang[]` (tiang baja kanopi), `atapPelana[]` (atap pelana genteng atau seng; `sisiSaja` 1/-1 untuk satu sisi, `mulai` untuk atap sayap yang menempel di sisi jembatan), `bangku[]` (bangku besi berderet), `alasKolom`.

`kampus.json` juga bisa berisi `lansekap[]`: bentuk tanah di luar gedung (undakan, selokan, tembok, plaza), juga dalam koordinat kawasan.
- `jalur.a` dan `jalur.b`: garis acuan (biasanya tepi selasar). `sisi` 1 atau -1 menentukan arah keluar dari garis itu.
- `penampang[]`: urutan jalur sejajar dari garis acuan ke luar. Tiap jalur punya `nama`, `lebar`, `atas` (tinggi permukaan), `bahan` (permukaan), `muka` (muka tegak di sisi gedung), dan `ujung` (muka di ujung-ujungnya).
- Bahan yang tersedia: `granit`, `beton`, `selokan`, `batu-kali`, `paving-merah`, `bata-merah`. Teksturnya digambar di canvas dan menyambung antar blok.
- `tangga[]`: `t` (posisi sepanjang garis), `lebar`, dan jalur `dari` dan `ke` (indeks penampang). Jalur di antaranya dipotong dan diganti anak tangga. `pegangan: true` menambah pipa pegangan.
- `pot[]`: pot tanaman berjarak tetap di sebuah jalur. `perabot[]`: `bangku` atau `ayunan` di jalur terakhir, posisinya `t` dan `v` (jarak dari awal jalur itu).

Setiap ruang, pintu, dan tangga punya `sumber`:

- `denah-2023`: diambil langsung dari denah.
- `koreksi-lapangan`: hasil keterangan lapangan karena denah 2023 sudah tidak sesuai.
- `footage-2026`: diambil dari footage video lapangan. **Kalau footage dan denah berbeda, yang dipakai footage** karena lebih baru.
- `foto-udara-2026`: letak dan susunan gedung dari foto udara.

Di viewer, data koreksi ditandai titik oranye. Bisa juga diwarnai lewat *Tampilan > Warna lantai ruang > Menurut sumber data*.

## Koreksi lapangan Gedung A (November 2026)

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
- Plaza depan A sekarang berhenti di x 38,8 supaya tidak menabrak penghubung.

## Menambah gedung berikutnya

1. Buat `data/gedung-x.json` dengan struktur yang sama.
2. Ubah status gedung itu di `data/kampus.json` jadi `"dibuat"`, isi `file`, `posisi`, dan `rotasi`.
3. Kalau tersambung ke gedung lain, tambahkan entri di `penghubung[]` dan buka tembok pembatas selasar di titik sambungnya.

Viewer memuat semua gedung berstatus `dibuat` dan menaruhnya bersama di kawasan. Mode jalan kaki bisa berpindah gedung lewat penghubung.
