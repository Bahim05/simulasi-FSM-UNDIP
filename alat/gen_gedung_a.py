# Alat bantu penyusun data Gedung A (bukan bagian aplikasi).
# Hasilnya data/gedung-a.json: file itulah sumber kebenaran yang dibaca viewer dan nanti diedit lewat CRUD.
import json
import os

D23, KL = "denah-2023", "koreksi-lapangan"
L = 44.9          # panjang gedung (m), dari ujung A101 (sisi Gedung E)
DR = 11.0         # kedalaman ruang (dinding belakang z=0 sampai dinding depan z=11)
ZS = 14.0         # tepi luar selasar
H = 4.0           # tinggi antar lantai
SLAB = 0.15
EXT, INT = 0.2, 0.15

# Kolom terukur dari denah yang sudah diluruskan
KOLOM_X = [0, 7.0, 12.45, 17.85, 23.3, 28.3, 33.55, 39.0, 44.9]

# Blok servis (x 23,3-28,3). Susunan dari footage 21 Nov 2026:
#   tangga U di sisi barat (2 lajur), lorong servis di sisi timur, gudang di belakang tangga,
#   Toilet Pria dan Toilet Wanita di ujung lorong (pintu berdampingan menghadap selasar).
X_S0, X_S2 = 23.3, 28.3          # dinding barat (sisi A103) dan timur (sisi A104) blok servis
X_LW = 25.95                     # garis dinding/pagar antara tangga dan lorong servis
X_TG0, X_TG1 = 23.38, 25.9       # tepi tangga (lajur 1 di barat, lajur 2 di timur)
X_MID = 24.64                    # celah di antara dua lajur
X_PIER = 27.1                    # sekat Toilet Pria / Toilet Wanita
Z_KM, Z_GD = 4.6, 6.4            # dinding depan toilet, dinding belakang bordes (= dinding selatan gudang)
INJ, N_ANAK = 0.28, 24
Z_LAND = round(11.0 - (N_ANAK // 2 - 1) * INJ, 3)   # tepi depan bordes (7,92)
FT = "footage-2026"

def rect(x0, z0, x1, z1):
    return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]

def r2(v):
    return round(v, 3)

def windows_on(x0, x1, doors, sill=1.0, height=1.6, max_w=2.6, jenis="jendela", ruang=None):
    """Jendela di dinding memanjang antara x0..x1: satu jendela per celah antar kolom/pintu.
    Denah menggambar jendela sebagai garis putus-putus di tengah tiap bentang kolom."""
    blocked = [(c - 0.45, c + 0.45) for c in KOLOM_X] + [(d - w / 2 - 0.3, d + w / 2 + 0.3) for d, w in doors]
    blocked += [(-9, x0 + 0.3), (x1 - 0.3, 99)]
    blocked.sort()
    free, cur = [], x0
    for a, b in blocked:
        if a > cur:
            free.append((cur, min(a, x1)))
        cur = max(cur, b)
    out = []
    for a, b in free:
        ln = b - a
        if ln >= 1.2:
            w = min(max_w, ln - 0.5)
            o = {"jenis": jenis, "t": r2((a + b) / 2), "lebar": r2(w), "ambang": sill, "tinggi": height}
            if ruang:
                o["ruang"] = ruang
            out.append(o)
    return out

def floor(no, rooms, doors):
    """rooms: daftar (kode, x0, x1, sumber, catatan) untuk ruang kelas sepanjang gedung.
    doors: {kode: (x_pusat, sumber)}"""
    Y = (no - 1) * H
    ruang, dinding = [], []
    for kode, x0, x1, src, cat in rooms:
        r = {"kode": kode, "nama": f"Ruang Kelas {kode}", "fungsi": "kelas",
             "poligon": rect(x0, 0, x1, DR), "sumber": src}
        if cat:
            r["catatan"] = cat
        ruang.append(r)
    p = f"A{no}"

    # ---------- blok servis ----------
    ruang += [
        {"kode": f"{p}-KM1", "nama": "Toilet Pria", "fungsi": "toilet", "poligon": rect(X_S0, 0, X_PIER, Z_KM), "sumber": FT,
         "label": "Toilet Pria",
         "catatan": "Pintu kiri di ujung lorong servis (papan 'Toilet Pria / Men'). Batas ruang di dalam belum terlihat di footage, jadi diasumsikan menerus ke belakang gudang."},
        {"kode": f"{p}-KM2", "nama": "Toilet Wanita", "fungsi": "toilet", "poligon": rect(X_PIER, 0, X_S2, Z_KM), "sumber": FT,
         "label": "Toilet Wanita",
         "catatan": "Pintu kanan di ujung lorong servis (papan 'Toilet Wanita / Women'), bersebelahan dengan Toilet Pria."},
        {"kode": f"{p}-LR", "nama": "Lorong servis", "fungsi": "sirkulasi", "poligon": rect(X_LW, Z_KM, X_S2, DR), "sumber": FT,
         "catatan": "Lorong lurus dari selasar ke pintu toilet, di sebelah timur tangga. Panel listrik di dinding timur."},
    ]
    if no == 1:
        ruang += [
            {"kode": f"{p}-GD", "nama": "Gudang", "fungsi": "gudang", "sumber": FT,
             "poligon": [[X_S0, Z_KM], [X_LW, Z_KM], [X_LW, 10.4], [X_MID, 10.4], [X_MID, Z_LAND], [X_S0, Z_LAND]],
             "catatan": "Berpartisi aluminium-kaca menghadap lorong, pintunya di dekat ujung lorong. Menerus ke bawah bordes dan lajur tangga kedua."},
            {"kode": f"{p}-TG", "nama": "Tangga", "fungsi": "tangga", "poligon": rect(X_S0, Z_LAND, X_MID, DR), "sumber": FT},
        ]
    else:
        ruang += [
            {"kode": f"{p}-GD", "nama": "Gudang", "fungsi": "gudang", "poligon": rect(X_S0, Z_KM, X_LW, Z_GD), "sumber": FT,
             "catatan": "Pintu krem bertuliskan 'GUDANG / Stockroom', menghadap lorong tepat sebelum pintu Toilet Pria."},
            {"kode": f"{p}-TG", "nama": "Tangga", "fungsi": "tangga", "poligon": rect(X_S0, Z_GD, X_LW, DR), "sumber": FT, "void": True},
        ]

    # Dinding belakang (z=0): jendela kelas + jendela tinggi toilet
    back_open = []
    for kode, x0, x1, *_ in rooms:
        back_open += windows_on(x0, x1, [])
    back_open += [{"jenis": "jendela-tinggi", "t": 24.6, "lebar": 0.8, "ambang": 1.9, "tinggi": 0.6},
                  {"jenis": "jendela-tinggi", "t": 26.2, "lebar": 0.8, "ambang": 1.9, "tinggi": 0.6},
                  {"jenis": "jendela-tinggi", "t": 27.7, "lebar": 0.7, "ambang": 1.9, "tinggi": 0.6}]
    dinding.append({"id": f"{p}-belakang", "luar": True, "a": [0, 0], "b": [L, 0], "tebal": EXT, "bukaan": back_open, "sumber": D23})

    # Dinding depan (z=11) dua potong: blok servis terbuka ke selasar
    def front(x0, x1, rooms_part, extra):
        op = []
        for kode, rx0, rx1, *_ in rooms_part:
            dx, dsrc = doors[kode]
            # pintu ganda kayu dengan boven kaca gelap sampai setinggi ventilasi (footage)
            op.append({"jenis": "pintu-ganda", "t": dx, "lebar": 1.1, "tinggi": 3.0, "boven": 0.6, "bovenGelap": True,
                       "ruang": kode, "sumber": dsrc, "papanNama": True})
            # sisi selasar tidak punya jendela besar, hanya ventilasi panjang gelap di atas yang bisa dibuka-tutup
            vents = windows_on(rx0, rx1, [(dx, 1.1)], sill=2.5, height=0.6, max_w=99, jenis="ventilasi", ruang=kode)
            for v in vents:
                v["sumber"] = KL
            op += vents
        op += extra
        for o in op:
            o["t"] = r2(o["t"] - x0)   # ubah ke jarak dari titik a
        return op
    left = [r for r in rooms if r[2] <= X_S0]
    right = [r for r in rooms if r[1] >= X_S2]
    dinding.append({"id": f"{p}-depan-1", "luar": True, "a": [0, DR], "b": [X_S0, DR], "tebal": EXT,
                    "bukaan": front(0, X_S0, left, []), "sumber": D23})
    dinding.append({"id": f"{p}-depan-2", "luar": True, "a": [X_S2, DR], "b": [L, DR], "tebal": EXT,
                    "bukaan": front(X_S2, L, right, []), "sumber": D23})
    dinding.append({"id": f"{p}-ujung-barat", "luar": True, "a": [0, 0], "b": [0, DR], "tebal": EXT, "bukaan": [], "sumber": D23,
                    "catatan": "Ujung yang menghadap Gedung E."})
    dinding.append({"id": f"{p}-ujung-timur", "luar": True, "a": [L, 0], "b": [L, DR], "tebal": EXT, "bukaan": [], "sumber": D23})
    for kode, x0, x1, src, _ in rooms:
        if x1 not in (X_S0, L):
            dinding.append({"id": f"{p}-sekat-{x1:g}", "a": [x1, 0], "b": [x1, DR], "tebal": INT, "bukaan": [], "sumber": src})

    # dinding blok servis
    km_door = lambda x, kode, ang, teks: {"jenis": "pintu", "t": r2(x - X_S0), "lebar": 0.8, "tinggi": 2.75, "boven": 0.6,
                                           "ruang": kode, "sumber": FT, "sudutBuka": ang, "papanNama": True, "papanTeks": teks}
    dinding += [
        {"id": f"{p}-servis-barat", "a": [X_S0, 0], "b": [X_S0, DR], "tebal": INT, "bukaan": [], "sumber": D23},
        {"id": f"{p}-servis-timur", "a": [X_S2, 0], "b": [X_S2, DR], "tebal": INT, "bukaan": [], "sumber": D23},
        {"id": f"{p}-toilet-depan", "a": [X_S0, Z_KM], "b": [X_S2, Z_KM], "tebal": INT, "sumber": FT,
         "bukaan": [km_door(26.38, f"{p}-KM1", 8, "Toilet Pria"), km_door(27.87, f"{p}-KM2", 70, "Toilet Wanita")]},
        {"id": f"{p}-toilet-sekat", "a": [X_PIER, 0], "b": [X_PIER, Z_KM], "tebal": INT, "bukaan": [], "sumber": FT},
    ]
    gd_door = {"jenis": "pintu", "t": 0.6, "lebar": 0.85, "tinggi": 2.75, "boven": 0.55, "bovenGelap": True,
               "ruang": f"{p}-GD", "sumber": FT, "sudutBuka": 5, "papanNama": True, "papanTeks": "Gudang"}
    if no == 1:
        dinding += [
            # dinding/partisi gudang di sisi lorong, menerus sampai bawah lajur tangga kedua
            {"id": f"{p}-lorong-barat", "a": [X_LW, Z_KM], "b": [X_LW, 10.4], "tebal": 0.1, "sumber": FT,
             "catatan": "Partisi aluminium-kaca gudang (footage).",
             "bukaan": [gd_door] + [{"jenis": "jendela", "t": t, "lebar": 1.0, "ambang": 0.9, "tinggi": 1.3} for t in (2.0, 3.3, 4.6)]},
            {"id": f"{p}-gudang-selatan", "a": [X_MID, 10.4], "b": [X_LW, 10.4], "tebal": 0.1, "tinggi": 3.26, "bukaan": [], "sumber": FT},
            {"id": f"{p}-bawah-tangga", "a": [X_MID, Z_LAND], "b": [X_MID, 10.4], "tebal": 0.1, "tinggi": 1.78, "tinggiAkhir": 3.26,
             "bukaan": [], "sumber": FT, "catatan": "Penutup di bawah lajur tangga kedua, mengikuti kemiringan tangga."},
            {"id": f"{p}-bordes-belakang", "a": [X_S0, Z_GD], "b": [X_LW, Z_GD], "tebal": INT, "dasar": 1.82, "bukaan": [], "sumber": FT,
             "catatan": "Dinding di belakang bordes (di atas gudang lantai 1)."},
        ]
    else:
        dinding += [
            {"id": f"{p}-gudang-selatan", "a": [X_S0, Z_GD], "b": [X_LW, Z_GD], "tebal": INT, "bukaan": [], "sumber": FT,
             "catatan": "Dinding di belakang bordes, sekaligus dinding selatan gudang."},
            {"id": f"{p}-gudang-timur", "a": [X_LW, Z_KM], "b": [X_LW, Z_GD], "tebal": 0.1, "bukaan": [gd_door], "sumber": FT},
        ]

    # ---------- pembatas (koordinat [x, z, dy], dy = tinggi relatif lantai) ----------
    pagar = []
    if no > 1:
        dy = -0.05
        tembok = {"jenis": "tembok-handrail", "tinggi": 0.9, "sumber": FT,
                  "catatan": "Tembok polos ±90 cm dengan pegangan stainless bertiang di atasnya."}
        # lantai 2 dan 3: pojok timur terbuka untuk tangga jembatan dari Gedung B (x 42,3-44,7)
        front = [(0.0, 42.2)]
        pagar += [{"a": [x0, ZS - 0.1, dy], "b": [x1, ZS - 0.1, dy], **tembok} for x0, x1 in front]
        pagar += [
                  {"a": [L - 0.1, DR + 0.15, dy], "b": [L - 0.1, ZS - 0.1, dy], **tembok},
                  {"a": [X_LW, Z_GD + 0.08, 0], "b": [X_LW, DR - 0.05, 0], "jenis": "besi", "sumber": FT,
                   "catatan": "Railing antara lorong servis dan lubang tangga."}]
    if no == 3:
        pagar += [{"a": [X_TG0 + 0.02, DR - 0.05, 0], "b": [X_MID - 0.02, DR - 0.05, 0], "jenis": "besi", "sumber": FT,
                   "catatan": "Tepi lubang tangga di sisi selasar (lantai teratas)."}]

    return {
        "no": no, "elevasi": Y, "elevasiSelasar": r2(Y - 0.05), "tinggiPlafon": H - SLAB,
        "denah": {"gambar": f"assets/denah/A{no}.jpg", "batas": [-1.5, -1.5, 46.4, 15.5],
                  "keterangan": f"Denah 2023 lantai {no}, diluruskan ke skala 40 px per meter."},
        "ruang": ruang, "dinding": dinding,
        "selasar": {"poligon": rect(0, DR, L, ZS)},
        "pagar": pagar,
    }

F12 = lambda no: [
    (f"A{no}01", 0, 7.0, D23, None), (f"A{no}02", 7.0, 15.0, D23, None), (f"A{no}03", 15.0, 23.3, D23, None),
    (f"A{no}04", 28.3, 36.6, D23, None), (f"A{no}05", 36.6, L, D23, None)]
D12 = lambda no: {f"A{no}01": (6.25, D23), f"A{no}02": (11.65, D23), f"A{no}03": (22.45, D23),
                  f"A{no}04": (32.75, D23), f"A{no}05": (44.1, D23)}

F3 = [
    ("A301", 0, 5.0, KL, "Hasil sekat ruang A301 lama (10 m) yang dibagi dua. Lebar diasumsikan sama rata."),
    ("A302", 5.0, 10.0, KL, "Hasil sekat ruang A301 lama (10 m) yang dibagi dua. Lebar diasumsikan sama rata."),
    ("A303", 10.0, 16.65, KL, "Hasil sekat ruang A302 lama (13,3 m) yang dibagi dua. Lebar diasumsikan sama rata."),
    ("A304", 16.65, 23.3, KL, "Hasil sekat ruang A302 lama (13,3 m) yang dibagi dua. Lebar diasumsikan sama rata."),
    ("A305", 28.3, 36.6, KL, "Di denah 2023 bernomor A303."),
    ("A306", 36.6, L, KL, "Di denah 2023 bernomor A304."),
]
D3 = {"A301": (3.9, KL), "A302": (6.25, D23), "A303": (11.65, D23), "A304": (22.45, D23),
      "A305": (32.75, D23), "A306": (44.1, D23)}

data = {
    "schema": "fsm-gedung@1",
    "id": "A",
    "nama": "Gedung A",
    "kategori": "Blok akademik",
    "deskripsi": "Gedung kelas memanjang tiga lantai di sisi utara kawasan, Selasarnya tersambung ke Gedung E lewat penghubung di ujung barat. Semua ruang menghadap selasar; di tengah ada tangga, lorong servis, gudang, dan toilet pria/wanita.",
    "sumberData": {
        "denah-2023": "Denah Gedung FSM Undip (2023), skala 1:150, lembar A LT.1 sampai LT.3.",
        "koreksi-lapangan": "Keterangan lapangan November 2026: sekat dan penomoran ulang lantai 3, ventilasi atas di sisi selasar.",
        "footage-2026": "Footage video lapangan 21 November 2026 (10 klip Gedung A): susunan tangga, lorong servis, toilet, gudang di tiap lantai, pembatas selasar, atap tritisan."
    },
    "koordinat": "Meter. x sepanjang gedung dari ujung A101 (sisi Gedung E, barat) ke timur; z dari dinding belakang (utara) ke tepi selasar (selatan); y ke atas, 0 = lantai 1.",
    "ukuran": {"panjang": L, "kedalamanRuang": DR, "lebarSelasar": ZS - DR, "tinggiLantai": H, "tebalPelat": SLAB},
    "tampilan": {"dinding": "#d3d6d3", "dindingDalam": "#ecebe6", "kolom": "#c4c7c4", "lantai": "#e6e1d7",
                 "selasar": "#c9c9c3", "atap": "#4d5352", "kusen": "#3b464d", "pintu": "#8a5a3a", "pagar": "#c6cacd"},
    # footage: muka luar kolom rata dengan muka luar dinding; kolom tepi selasar di belakang muka tembok pembatas
    "kolom": {"ukuran": 0.4, "dasar": -0.2, "puncak": 3 * H + SLAB,
              "titik": [[r2(x + (0.1 if x == 0 and z < ZS else 0) - (0.1 if x == L else 0)), r2(z + (0.1 if z == 0 else -0.1 if z == DR else -0.25))]
                        for z in (0, DR, ZS) for x in KOLOM_X]},
    "lantai": [floor(1, F12(1), D12(1)), floor(2, F12(2), D12(2)), floor(3, F3, D3)],
    "tangga": [
        {"id": f"T{f}", "dariLantai": f, "keLantai": f + 1, "x0": X_TG0, "x1": X_TG1, "zDepan": DR, "zBelakang": Z_GD,
         "jumlahAnakTangga": N_ANAK, "lebarInjakan": INJ, "bentuk": "U dengan bordes",
         "pembatas": "pagar-besi", "dindingBelakang": True, "sisiLuar": "dinding" if f == 1 else "pagar",
         "catatan": "Dua lajur ±1,2 m. Naik dari selasar ke belakang, bordes menempel dinding gudang, lalu berbalik. Railing stainless di antara lajur, pegangan dinding di sisi barat.",
         "sumber": FT}
        for f in (1, 2)],
    "tritisan": [
        {"a": [x0, ZS], "b": [x1, ZS], "sisi": 1, "elevasi": e, "lantai": no, "lebar": 1.3, "turun": 0.6, "jarak": 0.12, "sumber": FT,
         "catatan": "Atap genteng miring di depan selasar (tampak depan). Berhenti sebelum tangga jembatan ke Gedung B di pojok timur."}
        for no, e in ((2, H), (3, 2 * H))
        for x0, x1 in ((0, 42.1),)],
    "atap": [{"jenis": "perisai", "asal": [0, 0], "sudut": 0, "tepiBawah": 3 * H + SLAB, "tonjolan": 0.9, "kemiringan": 30,
              "batas": [0, 0, L, ZS], "sumber": KL}],
    "mulaiJalan": {"posisi": [2.5, 12.5], "arah": -90},
}

json.dump(data, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "gedung-a.json"), "w"), ensure_ascii=False, indent=1)
n = sum(len(f["ruang"]) for f in data["lantai"])
print("ruang:", n, "| dinding:", sum(len(f["dinding"]) for f in data["lantai"]))
for f in data["lantai"]:
    print(f["no"], [r["kode"] for r in f["ruang"]])
