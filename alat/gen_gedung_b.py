# Alat bantu penyusun data Gedung B (bukan bagian aplikasi).
# Hasilnya data/gedung-b.json. Gedung B mirip Gedung A (kelas memanjang 3 lantai, selasar di satu sisi),
# bedanya: lantai 1 sekitar 1,2 m lebih tinggi dari lantai 1 A, selasar berbentuk U (depan + kedua ujung),
# dan tangga ada di petak ujung, bukan di tengah.
#
# Koordinat lokal mengikuti denah 2023 yang dibaca tegak (tulisan terbaca normal):
#   x dari dinding ujung B106 (x=0) ke dinding ujung tangga (x=40), selasar ujung 2,8 m di luar kedua ujung;
#   z dari dinding belakang (z=0) ke tepi selasar (z=13,6).
# Di kawasan gedung diputar 180 derajat: ujung tangga di barat (dekat ujung timur A), selasar menghadap utara.
import json
import os

D23, KL, FT, UD = "denah-2023", "koreksi-lapangan", "footage-2026", "foto-udara-2026"
L = 40.0          # dinding ujung ke dinding ujung (8 bentang x 5 m)
SU = 2.8          # lebar selasar ujung
DR = 10.8         # kedalaman ruang
ZS = 13.6         # tepi luar selasar depan
H = 4.0           # tinggi antar lantai (denah: +4,00 dan +8,00 dari lantai 1 B)
Y1 = 1.2          # lantai 1 B terhadap lantai 1 A (keterangan lapangan)
PX = 82.0         # posisi x gedung di kawasan (harus sama dengan kampus.json); x kawasan = PX - x lokal
JB = (PX - 44.7, PX - 42.3)   # rentang x lokal jembatan lt 2 dan lt 3 (kawasan x 42,3-44,7, pojok timur Gedung A)
JF = (PX - 84.2, PX - 81.0)   # rentang x lokal penghubung F-B (kawasan x 81,0-84,2, pojok timur selasar depan B; footage 2026)
SLAB = 0.15
EXT, INT = 0.2, 0.15
KOLOM_X = [0, 5, 10, 15, 20, 25, 30, 35, 40]

# ---- petak ujung (x 35-40): lobi, lorong, toilet, gudang, tangga ----
# Susunan dari footage lobi B (km_b1, tangga_a) dan foto penghubung:
#   menghadap ke belakang dari lobi, lorong ada di kiri (menempel dinding B101, panel listrik di dinding itu),
#   tangga di kanan (lajur 1 menempel dinding ujung), berbalik ke kiri di bordes;
#   dua pintu toilet berdampingan di ujung lorong; gudang di belakang bordes; partisi kaca buram antara lorong dan tangga.
X_B = 35.0                 # dinding B101 / B201 / B301 (sisi barat lokal petak ujung)
X_LW = 37.4                # partisi buram lorong | tangga
X_KMP = 36.2               # sekat toilet 1 | toilet 2
Z_KM = 3.0                 # dinding depan toilet (pintu)
Z_GD = 5.0                 # dinding belakang bordes = dinding depan gudang
TG_X0, TG_X1 = 39.92, 37.48   # lajur 1 (sisi dinding ujung) -> lajur 2 (sisi lorong)
Z_TG = 9.4                 # anak tangga pertama (di belakang lobi)
INJ, N_ANAK = 0.28, 24
Z_LAND = round(Z_TG - (N_ANAK // 2 - 1) * INJ, 3)    # tepi depan bordes

def rect(x0, z0, x1, z1):
    return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]

def r2(v):
    return round(v, 3)

def windows_on(x0, x1, doors, sill=1.0, height=1.6, max_w=2.6, jenis="jendela", ruang=None):
    """Satu jendela per celah antar kolom/pintu di dinding memanjang x0..x1 (cara yang sama dengan Gedung A)."""
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
        if b - a >= 1.2:
            o = {"jenis": jenis, "t": r2((a + b) / 2), "lebar": r2(min(max_w, b - a - 0.5)), "ambang": sill, "tinggi": height}
            if ruang:
                o["ruang"] = ruang
            out.append(o)
    return out

def floor(no, rooms, doors):
    """rooms: (kode, nama, fungsi, x0, x1, sumber); doors: {kode: x_pusat}"""
    Y = Y1 + (no - 1) * H
    p = f"B{no}"
    ruang, dinding, perabot = [], [], []
    for kode, nama, fungsi, x0, x1, src in rooms:
        ruang.append({"kode": kode, "nama": nama, "fungsi": fungsi, "poligon": rect(x0, 0, x1, DR), "sumber": src})

    # ---------- petak ujung ----------
    ruang += [
        {"kode": f"{p}-KM1", "nama": "Toilet 1", "fungsi": "toilet", "poligon": rect(X_B, 0, X_KMP, Z_KM), "sumber": FT,
         "catatan": "Pintu kiri dari dua pintu kayu berdampingan di ujung lorong. Denah 2023 menulis petak ini Janitor; footage menunjukkan toilet."},
        {"kode": f"{p}-KM2", "nama": "Toilet 2", "fungsi": "toilet", "poligon": rect(X_KMP, 0, X_LW, Z_KM), "sumber": FT,
         "catatan": "Pintu kanan di ujung lorong. Kedalaman ruang perkiraan."},
        {"kode": f"{p}-GD", "nama": "Gudang", "fungsi": "gudang", "poligon": rect(X_LW, 0, L, Z_GD), "sumber": FT,
         "catatan": "Di belakang bordes, pintunya dari lorong (partisi buram berpapan nama). Ukuran perkiraan."},
    ]
    if no == 1:
        ruang += [
            {"kode": f"{p}-LR", "nama": "Lobi dan lorong", "fungsi": "sirkulasi", "poligon": rect(X_B, Z_KM, X_LW, DR), "sumber": FT,
             "catatan": "Masuk dari selasar. Panel listrik di dinding B101, mesin minuman dan banner di kaki tangga."},
            {"kode": f"{p}-TG", "nama": "Tangga", "fungsi": "tangga", "poligon": rect(X_LW, Z_GD, L, DR), "sumber": FT},
        ]
    else:
        ruang += [
            {"kode": f"{p}-LR", "nama": "Lorong", "fungsi": "sirkulasi", "sumber": FT,
             "poligon": [[X_B, Z_KM], [X_LW, Z_KM], [X_LW, Z_TG], [L, Z_TG], [L, DR], [X_B, DR]]},
            {"kode": f"{p}-TG", "nama": "Tangga", "fungsi": "tangga", "poligon": rect(X_LW, Z_GD, L, Z_TG), "sumber": FT, "void": True},
        ]

    # dinding belakang (z=0): jendela tiap bentang kelas
    back = []
    for kode, nama, fungsi, x0, x1, src in rooms:
        back += windows_on(x0, x1, [])
    back += [{"jenis": "jendela-tinggi", "t": 35.6, "lebar": 0.7, "ambang": 1.9, "tinggi": 0.6},
             {"jenis": "jendela-tinggi", "t": 36.8, "lebar": 0.7, "ambang": 1.9, "tinggi": 0.6},
             {"jenis": "jendela-tinggi", "t": 38.7, "lebar": 1.2, "ambang": 1.9, "tinggi": 0.6}]
    dinding.append({"id": f"{p}-belakang", "luar": True, "a": [0, 0], "b": [L, 0], "tebal": EXT, "bukaan": back, "sumber": D23})

    # dinding depan (z=10,8) dari ujung B106 sampai dinding B101; petak ujung terbuka ke selasar (lobi)
    fr = []
    for kode, nama, fungsi, x0, x1, src in rooms:
        dx = doors[kode]
        fr.append({"jenis": "pintu-ganda", "t": dx, "lebar": 1.1, "tinggi": 3.0, "boven": 0.6, "bovenGelap": True,
                   "ruang": kode, "sumber": D23, "papanNama": True})
        for v in windows_on(x0, x1, [(dx, 1.1)], sill=2.5, height=0.6, max_w=99, jenis="ventilasi", ruang=kode):
            v["sumber"] = KL
            fr.append(v)
    dinding.append({"id": f"{p}-depan", "luar": True, "a": [0, DR], "b": [X_B, DR], "tebal": EXT, "bukaan": fr, "sumber": D23})
    dinding.append({"id": f"{p}-ujung-b106", "luar": True, "a": [0, 0], "b": [0, DR], "tebal": EXT, "bukaan": [], "sumber": D23,
                    "catatan": "Ujung timur di kawasan."})
    dinding.append({"id": f"{p}-ujung-tangga", "luar": True, "a": [L, 0], "b": [L, DR], "tebal": EXT, "sumber": D23,
                    "catatan": "Ujung barat di kawasan, menghadap penghubung A-B.",
                    "bukaan": [{"jenis": "jendela-tinggi", "t": 2.5, "lebar": 1.4, "ambang": 1.9, "tinggi": 0.6},
                               {"jenis": "jendela", "t": 7.6, "lebar": 2.2, "ambang": 2.3, "tinggi": 1.2, "sumber": FT}]})
    for kode, nama, fungsi, x0, x1, src in rooms:
        if x1 < X_B:
            dinding.append({"id": f"{p}-sekat-{x1:g}", "a": [x1, 0], "b": [x1, DR], "tebal": INT, "bukaan": [], "sumber": src})
    dinding.append({"id": f"{p}-lobi-dinding", "a": [X_B, 0], "b": [X_B, DR], "tebal": INT, "bukaan": [], "sumber": D23,
                    "catatan": "Dinding antara kelas dan petak ujung. Panel listrik menempel di sisi lorong."})

    # toilet dan gudang
    km_door = lambda x, kode, teks: {"jenis": "pintu", "t": r2(x - X_B), "lebar": 0.75, "tinggi": 2.3, "boven": 0.45,
                                     "ruang": kode, "sumber": FT, "sudutBuka": 4, "papanNama": True, "papanTeks": teks}
    dinding += [
        {"id": f"{p}-toilet-depan", "a": [X_B, Z_KM], "b": [X_LW, Z_KM], "tebal": INT, "sumber": FT,
         "bukaan": [km_door(35.6, f"{p}-KM1", "Toilet"), km_door(36.8, f"{p}-KM2", "Toilet")]},
        {"id": f"{p}-toilet-sekat", "a": [X_KMP, 0], "b": [X_KMP, Z_KM], "tebal": 0.1, "bukaan": [], "sumber": FT},
        {"id": f"{p}-gudang-lorong", "a": [X_LW, 0], "b": [X_LW, Z_GD], "tebal": 0.1, "sumber": FT,
         "bukaan": [{"jenis": "pintu", "t": 4.0, "lebar": 0.8, "tinggi": 2.3, "boven": 0.45, "ruang": f"{p}-GD", "sumber": FT,
                     "sudutBuka": 3, "papanNama": True, "papanTeks": "Gudang"}]},
        {"id": f"{p}-bordes-belakang", "a": [X_LW, Z_GD], "b": [L, Z_GD], "tebal": INT, "bukaan": [], "sumber": FT,
         "catatan": "Bordes tangga menempel dinding ini."},
        # partisi aluminium kaca buram antara lorong dan tangga
        {"id": f"{p}-partisi-buram", "a": [X_LW, Z_GD], "b": [X_LW, Z_TG], "tebal": 0.08, "sumber": FT,
         "bukaan": [{"jenis": "jendela", "buram": True, "t": 1.1, "lebar": 2.0, "ambang": 0.15, "tinggi": 2.5},
                    {"jenis": "jendela", "buram": True, "t": 3.3, "lebar": 2.0, "ambang": 0.15, "tinggi": 2.5}]},
    ]
    if no == 1:
        # panel listrik, mesin minuman, banner (penanda dari footage)
        perabot += [{"jenis": "kotak", "posisi": [X_B + 0.16, z], "ukuran": [0.16, w, h], "dasar": 1.2, "warna": c, "sumber": FT}
                    for z, w, h, c in ((6.0, 0.45, 0.6, "#a8a99c"), (6.6, 0.4, 0.55, "#8f9189"), (7.15, 0.45, 0.65, "#6f7470"), (7.7, 0.3, 0.45, "#a8a99c"))]
        perabot += [{"jenis": "kotak", "posisi": [38.05, 9.05], "ukuran": [0.75, 0.7, 1.85], "warna": "#f2f2f0", "sumber": FT,
                     "catatan": "Mesin minuman di kaki tangga."},
                    {"jenis": "kotak", "posisi": [38.62, 9.5], "ukuran": [0.6, 0.06, 1.8], "warna": "#2b2f55", "sumber": FT,
                     "catatan": "Banner 'Etika Berbusana Mahasiswa Undip'."}]

    # ---------- pembatas selasar (lantai 2 dan 3), selasar berbentuk U ----------
    pagar = []
    if no > 1:
        dy = -0.05
        tembok = {"jenis": "tembok-handrail", "tinggi": 0.9, "sumber": FT}
        # celah di depan lobi untuk jembatan ke Gedung A, dan di pojok timur untuk penghubung ke Gedung F
        pagar += [{"a": [-SU + 0.1, ZS - 0.1, dy], "b": [JF[0] - 0.05, ZS - 0.1, dy], **tembok},
                  {"a": [JF[1] + 0.05, ZS - 0.1, dy], "b": [JB[0] - 0.05, ZS - 0.1, dy], **tembok},
                  {"a": [JB[1] + 0.05, ZS - 0.1, dy], "b": [L + SU - 0.1, ZS - 0.1, dy], **tembok},
                  {"a": [-SU + 0.1, 0.1, dy], "b": [-SU + 0.1, ZS - 0.1, dy], **tembok},
                  {"a": [L + SU - 0.1, 0.1, dy], "b": [L + SU - 0.1, ZS - 0.1, dy], **tembok},
                  {"a": [-SU + 0.1, 0.1, dy], "b": [-0.1, 0.1, dy], **tembok},
                  {"a": [L + 0.1, 0.1, dy], "b": [L + SU - 0.1, 0.1, dy], **tembok}]
    if no == 3:
        pagar += [{"a": [(TG_X0 + TG_X1) / 2 + 0.06, Z_TG - 0.05, 0], "b": [TG_X0, Z_TG - 0.05, 0], "jenis": "besi", "sumber": FT,
                   "catatan": "Tepi lubang tangga di lantai teratas."}]

    sel = [[-SU, 0], [0, 0], [0, DR], [L, DR], [L, 0], [L + SU, 0], [L + SU, ZS], [-SU, ZS]]
    return {
        "no": no, "elevasi": Y, "elevasiSelasar": r2(Y - 0.05), "tinggiPlafon": H - SLAB, "perabot": perabot,
        "denah": {"gambar": f"assets/denah/B{no}.jpg", "batas": [-3.5, -1.0, 43.5, 14.6],
                  "keterangan": f"Denah 2023 Gedung B lantai {no}, diluruskan ke skala 40 px per meter."},
        "ruang": ruang, "dinding": dinding,
        "selasar": {"poligon": sel},
        "pagar": pagar,
    }

def kelas(kode):
    return (kode, f"Ruang Kelas {kode}", "kelas")

F1 = [(*kelas("B106"), 0, 5, D23), (*kelas("B105"), 5, 10, D23), (*kelas("B104"), 10, 15, D23),
      (*kelas("B103"), 15, 20, D23), (*kelas("B102"), 20, 30, D23), (*kelas("B101"), 30, 35, D23)]
P1 = {"B106": 0.95, "B105": 9.2, "B104": 10.8, "B103": 19.1, "B102": 25.7, "B101": 34.1}
F2 = [(*kelas("B206"), 0, 5, D23), (*kelas("B205"), 5, 10, D23), (*kelas("B204"), 10, 15, D23),
      (*kelas("B203"), 15, 20, D23), (*kelas("B202"), 20, 30, D23), (*kelas("B201"), 30, 35, D23)]
P2 = {"B206": 0.9, "B205": 9.4, "B204": 11.0, "B203": 19.4, "B202": 25.95, "B201": 34.1}
F3 = [("B3-KD", "Kantor Departemen", "kantor", 0, 8.85, D23), (*kelas("B303"), 8.85, 17.45, D23),
      (*kelas("B302"), 17.45, 26.1, D23), (*kelas("B301"), 26.1, 35, D23)]
P3 = {"B3-KD": 0.9, "B303": 10.75, "B302": 19.0, "B301": 33.9}

# footage: muka luar kolom rata dengan muka luar dinding; kolom tepi selasar di belakang muka tembok pembatas
KI, KS = 0.1, 0.25
kol = [[r2(x + (KI if x == 0 else -KI if x == L else 0)), r2(z + (KI if z == 0 else -KI))] for z in (0, DR) for x in KOLOM_X]
kol += [[x, ZS - KS] for x in KOLOM_X]
kol += [[r2(x + (KS if x < 0 else -KS)), r2(KS if z == 0 else ZS - KS if z == ZS else z)] for x in (-SU, L + SU) for z in (0, 3.7, 7.4, DR, ZS)]
# mulut koridor B-G di selasar ujung barat (z lokal ±6,8-13,6): kolom tepi selasar di situ hanya ada di lantai 2 dan 3,
# supaya di lantai 1 tidak ada tiang di tengah jalan masuk koridor (koreksi pengguna 22 Nov 2026)
MULUT = [[r2(L + SU - KS), 7.4], [r2(L + SU - KS), DR]]
kol = [k for k in kol if k not in MULUT]
# mulut penghubung F-B di pojok timur selasar depan: kolom tepi selasar di x 0 jatuh di tengah jembatan, jadi dihapus
kol = [k for k in kol if k != [0, r2(ZS - KS)]]

data = {
    "schema": "fsm-gedung@1",
    "id": "B",
    "nama": "Gedung B",
    "kategori": "Blok akademik",
    "deskripsi": "Gedung kelas tiga lantai di tenggara Gedung A, sejajar dengannya. Lantai 1 lebih tinggi sekitar 1,2 m dari lantai 1 A. "
                 "Selasar berbentuk U menghadap utara ke plaza dan Gedung A. Di ujung barat ada lobi, tangga, toilet, dan gudang; "
                 "dari depan lobi penghubung beratap turun ke selasar Gedung A, dan jembatan lantai 2 dan 3 menyambung ke pojok timur selasar A.",
    "sumberData": {
        "denah-2023": "Denah Gedung FSM Undip (2023), skala 1:150, lembar B LT.1 sampai LT.3.",
        "koreksi-lapangan": "Keterangan lapangan November 2026: lantai 1 B sekitar 1,2 m di atas lantai 1 A; ventilasi atas di sisi selasar seperti Gedung A.",
        "footage-2026": "Footage dan foto lapangan November 2026 (folder Gedung B): lobi dan tangga, lorong toilet, penghubung lt 1, jembatan lt 2, tampak samping.",
        "foto-udara-2026": "Foto udara dari pengguna (22 Nov 2026): B sejajar A, bergeser ke tenggara, penghubung di celah ujung timur A dan ujung barat B."
    },
    "koordinat": "Meter. x dari dinding ujung B106 (x=0) ke dinding ujung tangga (x=40), z dari dinding belakang (z=0) ke tepi selasar (z=13,6); "
                 "y ke atas dalam sistem kawasan (0 = lantai 1 Gedung A, lantai 1 B di y=1,2). Di kawasan gedung diputar 180 derajat.",
    "ukuran": {"panjang": L, "lebarSelasarUjung": SU, "kedalamanRuang": DR, "lebarSelasar": ZS - DR, "tinggiLantai": H, "tebalPelat": SLAB},
    "tampilan": {"dinding": "#d8dad7", "dindingDalam": "#ecebe6", "kolom": "#c4c7c4", "lantai": "#e6e1d7",
                 "selasar": "#cdccc6", "atap": "#4d5352", "kusen": "#3b464d", "pintu": "#7a3f2c", "pagar": "#c6cacd"},
    "fondasi": {"dasar": -0.22, "warna": "#4a4f55", "catatan": "Alas abu-abu gelap di bawah lantai 1 dan selasar (footage)."},
    "kolom": {"ukuran": 0.4, "dasar": -0.2, "puncak": Y1 + 3 * H + SLAB, "titik": kol,
              "tambahan": [{"titik": MULUT, "lantai": [2, 3], "catatan": "Kolom tepi selasar ujung barat di atas mulut koridor B-G."}]},
    "lantai": [floor(1, F1, P1), floor(2, F2, P2), floor(3, F3, P3)],
    "tangga": [
        {"id": f"T{f}", "dariLantai": f, "keLantai": f + 1, "x0": TG_X0, "x1": TG_X1, "zDepan": Z_TG, "zBelakang": Z_GD,
         "jumlahAnakTangga": N_ANAK, "lebarInjakan": INJ, "bentuk": "U dengan bordes",
         "pembatas": "pagar-besi", "dindingBelakang": True, "sisiLuar": "dinding",
         "catatan": "Dua lajur ±1,2 m. Lajur 1 menempel dinding ujung, naik dari lobi ke belakang, bordes menempel dinding gudang, "
                    "lalu berbalik ke kiri. Railing stainless di antara lajur.",
         "sumber": FT}
        for f in (1, 2)],
    "tritisan": [
        {"a": [x0, ZS], "b": [x1, ZS], "sisi": 1, "elevasi": Y1 + (no - 1) * H, "lantai": no,
         "lebar": 1.3, "turun": 0.6, "jarak": 0.12, "sumber": FT,
         "catatan": "Atap genteng miring di depan selasar, terputus di jembatan ke Gedung A dan di penghubung ke Gedung F."}
        for no in (2, 3) for x0, x1 in ((round(JF[1] + 0.1, 2), round(JB[0] - 0.1, 2)), (round(JB[1] + 0.1, 2), L + SU))],
    "atap": [{"jenis": "perisai", "asal": [0, 0], "sudut": 0, "tepiBawah": Y1 + 3 * H + SLAB, "tonjolan": 0.9, "kemiringan": 30,
              "batas": [-SU, 0, L + SU, ZS], "sumber": UD}],
    "mulaiJalan": {"posisi": [37.6, 12.7], "arah": 0},
}

json.dump(data, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "gedung-b.json"), "w"), ensure_ascii=False, indent=1)
print("ruang:", sum(len(f["ruang"]) for f in data["lantai"]), "| dinding:", sum(len(f["dinding"]) for f in data["lantai"]))
for f in data["lantai"]:
    print(f["no"], f["elevasi"], [r["kode"] for r in f["ruang"]])
