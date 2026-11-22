# Alat bantu penyusun data Gedung E (bukan bagian aplikasi). Hasil: data/gedung-e.json.
# Koordinat E: (0,0) = sudut belakang-kiri sayap lurus, tempat dua sayap bertemu. x ke timur, z ke selatan (selasar).
# Sayap miring diputar 30 derajat; titiknya dihitung lewat W(a, b):
#   a = jarak sepanjang sayap dari ujung kiri (barat laut), b = jarak dari dinding belakang ke arah selasar.
import json, math, os

D23, KL, FT, UD = "denah-2023", "koreksi-lapangan", "footage-2026", "foto-udara-2026"
H, SLAB, EXT, INT = 4.0, 0.15, 0.2, 0.15
DR, ZS = 10.5, 13.3                 # kedalaman ruang, tepi luar selasar
XE = 32.0                           # ujung timur sayap lurus
XS = 34.9                           # tepi luar tangga samping di ujung utara (denah + footage)
# Footage penghubung A-E: lt 2 dari lantai penghubung (rata dengan selasar A) naik 1 anak tangga ke E;
# lt 3 dari selasar A naik 1 anak tangga ke penghubung lalu naik 2 anak tangga ke E. Tinggi anak tangga ±16 cm.
STEP = 0.16
ELEV = {1: 0.0, 2: round(4.0 + STEP, 3), 3: round(8.0 + 3 * STEP, 3)}
TOP = ELEV[3] + H + SLAB            # tepi bawah atap
ANG = math.radians(30)
E_ = (math.cos(ANG), math.sin(ANG))         # arah sepanjang sayap miring
N_ = (-math.sin(ANG), math.cos(ANG))        # arah ke selasar sayap miring
A_J = 14.3                                  # posisi titik siku (0,0) di garis belakang sayap miring
BL = (-A_J * E_[0], -A_J * E_[1])           # sudut belakang-kiri sayap miring

def r2(v): return round(v, 3)
def W(a, b): return [r2(BL[0] + a * E_[0] + b * N_[0]), r2(BL[1] + a * E_[1] + b * N_[1])]
def rect(x0, z0, x1, z1): return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]

# titik penting sayap miring dan blok tengah (terukur dari denah yang diluruskan)
A_BR, A_PART, A_BEM, A_N = 13.4, 6.7, 16.96, 19.84
Z_KM = 5.33                         # dinding selatan toilet 1 (= dinding utara R. BEM)
X_BEM = 3.55                        # dinding timur R. BEM dan toilet 1 = dinding barat lorong toilet
X_CW = 5.75                         # dinding timur lorong toilet = dinding barat tangga
X_E101 = 8.4
Z_END = 1.6                         # dinding ujung lorong toilet (pintu KM disabilitas / gudang)
Z_K2 = 3.58                         # dinding selatan toilet 2 = dinding belakang bordes tangga
Z_TGD = 8.0                         # anak tangga pertama (depan tangga) = ujung selatan dinding timur lorong toilet (footage)
Z_LAND = round(Z_TGD - 11 * 0.28, 3)   # tepi depan bordes (4,02)
X_KNEE = 7.07                       # tembok setengah badan di antara dua lajur tangga
Z_GDD = 6.5                         # pintu gudang di bawah tangga (lt 1)
SS_X0, SS_ZD, SS_ZB = 32.08, 10.85, 6.83   # tangga samping: sisi gedung, anak tangga pertama, belakang bordes
PX0, PX1 = 2.43, 5.43               # lebar penghubung ke Gedung A (di antara kolom selasar)
COL_ANG = [0, 4.35, 7.4, 10.4, 13.4]        # kolom sayap miring (dalam a)
COL_STR = [0, 2.4, 5.4] + [r2(8.4 + 2.95 * k) for k in range(9)]

# ---------- blok HMIF / R. BEM di pertemuan dua sayap (footage 2026, menggantikan bentuk "moncong" di denah 2023) ----------
# Urutan dari footage, dilihat dari hall: dinding lorong toilet berjendela gelap (menghadap timur) -> sudut Q di mulut lorong ->
# dinding poster pendek (menghadap selatan) -> pilaster abu-abu P -> dinding pintu HMIF (tegak lurus sayap miring, menghadap
# tenggara ke penghubung) -> sudut C -> dinding depan sayap miring dengan plakat Departemen Informatika.
Q_Z = round(Z_TGD + 0.45, 3)        # sudut Q: 45 cm di selatan ujung dinding timur lorong (footage lorong toilet lt 3)
L_POSTER, L_HMIF = 0.95, 2.8        # panjang dinding poster dan dinding pintu HMIF
P_ = [r2(X_BEM - L_POSTER), Q_Z]                                      # pilaster
C_ = [r2(P_[0] + L_HMIF * N_[0]), r2(Q_Z + L_HMIF * N_[1])]           # sudut dinding HMIF dengan dinding depan sayap miring
K_ = W(A_BR, DR)                    # kolom sekat R. Senat; dari sini dinding depan berbelok sedikit menuju C
L_KC = math.dist(K_, C_)

def cross_pt(p0, d0, p1, d1):
    """Titik potong garis p0 + s*d0 dan p1 + t*d1, dikembalikan sebagai (titik, t pada garis kedua)."""
    den = d0[0] * d1[1] - d0[1] * d1[0]
    t = ((p1[0] - p0[0]) * d0[1] - (p1[1] - p0[1]) * d0[0]) / den
    return [r2(p1[0] + t * d1[0]), r2(p1[1] + t * d1[1])], t

_bk = W(A_BEM, DR)
S_, _tS = cross_pt([0, Z_KM], [_bk[0], _bk[1] - Z_KM], K_, [(C_[0] - K_[0]) / L_KC, (C_[1] - K_[1]) / L_KC])
T_S = r2(_tS)                       # jarak sekat R. Senat | blok HMIF pada dinding K -> C

def windows(t0, t1, blocked_t, sill=1.0, height=1.6, max_w=2.6, jenis="jendela", ruang=None, src=None):
    """Satu jendela per celah bebas di antara kolom/pintu/sekat (dalam t = jarak dari titik a dinding)."""
    bl = sorted([(-99, t0 + 0.3), (t1 - 0.3, 999)] + blocked_t)
    out, cur = [], t0
    for a, b in bl:
        if a > cur and min(a, t1) - cur >= 1.2:
            w = min(max_w, min(a, t1) - cur - 0.5)
            o = {"jenis": jenis, "t": r2((cur + min(a, t1)) / 2), "lebar": r2(w), "ambang": sill, "tinggi": height}
            if ruang: o["ruang"] = ruang
            if src: o["sumber"] = src
            out.append(o)
        cur = max(cur, b)
    return out

col_block = lambda ts: [(t - 0.45, t + 0.45) for t in ts]
door_block = lambda ds: [(t - w / 2 - 0.3, t + w / 2 + 0.3) for t, w in ds]

def kelas_or(nama):
    n = nama.lower()
    if "lab" in n: return "lab"
    if "bem" in n or "hmif" in n: return "organisasi"
    if any(k in n for k in ("senat", "kantor", "departemen", "rapat", "dosen")): return "kantor"
    return "ruang"

def room(kode, nama, poly, fungsi=None, src=D23, label=None, catatan=None, void=False):
    r = {"kode": kode, "nama": nama, "fungsi": fungsi or kelas_or(nama), "poligon": poly, "sumber": src}
    if label: r["label"] = label
    if catatan: r["catatan"] = catatan
    if void: r["void"] = True
    return r

# pintu Departemen Informatika (footage tour lt 3): daun ±0,8 m, merah marun, lis putih + kaca sempit di tepi tengah, pegangan batang hitam
DEPT_DOOR = {"lebar": 1.6, "tinggi": 2.5, "boven": 0, "sudutBuka": 2, "warnaDaun": "#7a2c22", "lisKaca": True, "pegangan": True}
DEPT_X = 21.7                       # pusat pintu
DEPT_ZONE = (20.3, 25.0)            # rentang kisi kayu (tanpa ventilasi atas)

def floor(no):
    Y = ELEV[no]
    p = f"E{no}"
    ruang, dinding, pagar = [], [], []

    # ---------- sayap miring ----------
    if no == 1:
        ang_rooms = [("E103", "E103", 0, A_PART, 2.5), ("E102", "E102", A_PART, A_BR, 12.1)]
    elif no == 2:
        ang_rooms = [(f"{p}-LABKOMC", "Lab Komputer C", 0, A_BR, None)]
    else:
        ang_rooms = [(f"{p}-COWORK", "Coworking Space", 0, A_BR, None)]
    for kode, nama, a0, a1, _ in ang_rooms:
        f = "kelas" if no == 1 else None
        src_r = FT if no == 3 else D23
        ruang.append(room(kode, nama, [W(a0, 0), W(a1, 0), W(a1, DR), W(a0, DR)], fungsi=f, src=src_r,
                          label=None if no == 1 else ("Lab Kom C" if no == 2 else "Coworking"),
                          catatan="Denah 2023: R. Siscer. Pintu ganda berpapan 'Coworking Space' (footage)." if no == 3 else None))
    senat = {1: ("SENAT", "R. Senat", "Senat"), 2: ("KD1", "Kantor Dosen", "Kantor Dosen"), 3: ("SIDANG", "Ruang Sidang", "Sidang")}[no]
    bem = {1: ("BEM", "R. BEM", "BEM"), 2: ("KD2", "Kantor Dosen", "Kantor Dosen"), 3: ("HMIF", "R. HMIF", "HMIF")}[no]
    ruang.append(room(f"{p}-{senat[0]}", senat[1], [W(A_BR, 0), [0, 0], [0, Z_KM], S_, K_], label=senat[2],
                      fungsi="kantor" if no < 3 else "ruang", src=FT if no == 3 else D23,
                      catatan="Denah 2023: R. Skripsi. Papan 'Ruang Sidang' di pintu dan di dinding (footage)." if no == 3 else None))
    ruang.append(room(f"{p}-{bem[0]}", bem[1], [[0, Z_KM], [X_BEM, Z_KM], [X_BEM, Q_Z], P_, C_, S_], label=bem[2],
                      fungsi="kantor" if no == 2 else "organisasi", src=FT,
                      catatan="Bentuk mengikuti footage 2026: pintu di dinding yang menghadap penghubung, ujung timur berhenti di mulut lorong toilet."))

    # ---------- blok toilet (footage): lorong lurus dari selasar ke utara di antara R. BEM dan tangga ----------
    ruang += [
        room(f"{p}-KM1", "Toilet Wanita", rect(0, 0, X_BEM, Z_KM), "toilet", FT, label="Toilet Wanita",
             catatan="Pintu di dinding kiri lorong, berhadapan dengan toilet pria. Pria/wanita ditebak dari papan pintu kanan (gambar pria) di lt 2."),
        room(f"{p}-KM2", "Toilet Pria", rect(X_CW, 0, X_E101, Z_K2), "toilet", FT, label="Toilet Pria",
             catatan="Pintu di dinding kanan lorong dekat ujung, berhadapan dengan toilet wanita (papan 'Toilet' bergambar pria)."),
        room(f"{p}-LKM", "Lorong toilet", rect(X_BEM, Z_END, X_CW, Z_TGD), "sirkulasi", FT, label="Lorong",
             catatan="Lorong lurus dari selasar ke utara, dinding kiri berjendela tinggi (R. BEM / Kantor Dosen)."),
    ]
    if no == 1:
        ruang += [
            room(f"{p}-KMD", "Kamar Mandi Disabilitas", rect(X_BEM, 0, X_CW, Z_END), "toilet", FT, label="KM Difabel",
                 catatan="Di ujung lorong, pintu menghadap selasar."),
            room(f"{p}-GD", "Gudang", [[X_CW, Z_K2], [X_E101, Z_K2], [X_E101, Z_LAND], [X_KNEE, Z_LAND], [X_KNEE, Z_GDD], [X_CW, Z_GDD]],
                 "gudang", FT, catatan="Di bawah tangga. Pintu (papan 'Gudang / Stockroom') menghadap selasar, di samping anak tangga pertama."),
            room(f"{p}-TG", "Tangga", [[X_KNEE, Z_LAND], [X_E101, Z_LAND], [X_E101, Z_TGD], [X_CW, Z_TGD], [X_CW, Z_GDD], [X_KNEE, Z_GDD]],
                 "tangga", FT),
        ]
    else:
        ruang += [
            room(f"{p}-GD", "Gudang", rect(X_BEM, 0, X_CW, Z_END), "gudang", FT,
                 catatan="Di ujung lorong toilet, pintu menghadap selasar (papan 'Gudang / Stockroom')."),
            room(f"{p}-TG", "Tangga", rect(X_CW, Z_K2, X_E101, Z_TGD), "tangga", FT, void=True),
        ]

    # ---------- sayap lurus ----------
    # (kode, nama, x0, x1, [(x pintu, jenis, teks papan)], sumber, catatan)
    if no == 1:
        sr = [("E101", "E101", X_E101, XE, [(9.9, "pintu-ganda", "E101"), (30.6, "pintu-ganda", "E101")], D23, None)]
    elif no == 2:
        sr = [(f"{p}-KAVI", "R. KAVI", X_E101, 18.1, [(9.9, "pintu-ganda", "R. KAVI"), (17.2, "pintu", "Ruang Dosen KG & RPL")], D23,
               "Pintu utara diberi papan 'Ruang Dosen KG' dan 'Ruang Dosen RPL' (footage). Pembagian di dalam belum terlihat."),
              (f"{p}-LABKOM", "Lab Komputer", 18.1, XE, [(20.0, "pintu-ganda", "Lab Komputer D"), (30.6, "pintu-ganda", "Lab Komputer")], D23,
               "Pintu selatan berpapan 'Laboratorium Komputer D / Computer Lab D' (footage).")]
    else:
        sr = [(f"{p}-STI", "Ruang STI", X_E101, 13.63, [(9.9, "pintu-ganda", "Ruang STI")], FT,
               "Urutan ruang lt 3 di footage terbalik dari denah 2023: Ruang STI paling dekat tangga."),
              (f"{p}-RAPAT", "Ruang Rapat", 13.63, 18.75, [(15.75, "pintu-ganda", "Ruang Rapat")], FT, None),
              (f"{p}-DEPT", "Departemen Informatika", 18.75, 22.63, [(21.7, "pintu-ganda", None, DEPT_DOOR)], FT,
               "Pintu ganda merah marun berlis putih berkaca sempit di dalam portal hitam bertulisan 'DEPARTEMEN INFORMATIKA'; dinding sekelilingnya berlapis kisi kayu (footage)."),
              (f"{p}-RPL", "Ruang RPL", 22.63, XE, [(30.6, "pintu-ganda", "Ruang RPL")], FT, None)]
    labels = {"R. KAVI": "KAVI", "Lab Komputer": "Lab Kom", "Ruang RPL": "RPL", "Departemen Informatika": "Departemen",
              "Ruang Rapat": "Rapat", "Ruang STI": "STI"}
    for kode, nama, x0, x1, _, src, cat in sr:
        ruang.append(room(kode, nama, rect(x0, 0, x1, DR), fungsi="kelas" if no == 1 else None, label=labels.get(nama), src=src, catatan=cat))


    names = {r["kode"]: r["nama"] for r in ruang}
    papan = lambda kode: kode if no == 1 and kode.startswith("E1") and len(kode) == 4 else names[kode]

    # ---------- dinding sayap miring ----------
    # garis depan (selasar): pintu + ventilasi atas, dari ujung kiri sampai kolom sekat R. Senat (K)
    doors_ang = [(r[4], r[0]) for r in ang_rooms if r[4] is not None] if no == 1 else [(2.5, ang_rooms[0][0]), (12.1, ang_rooms[0][0])]
    teks_miring = {(2, 2.5): "Lab Komputasi B", (2, 12.1): "Lab Komputasi C", (3, 12.1): "Coworking Space"}   # papan di footage
    front_op = [{"jenis": "pintu-ganda", "t": t, "lebar": 1.1, "tinggi": 3.0, "boven": 0.6, "bovenGelap": True, "ruang": k,
                 "papanNama": True, "papanTeks": teks_miring.get((no, t), papan(k)), "sumber": FT if (no, t) in teks_miring else D23}
                for t, k in doors_ang]
    seg_rooms = [(0, A_PART if no == 1 else A_BR, ang_rooms[0][0])] + ([(A_PART, A_BR, ang_rooms[1][0])] if no == 1 else [])
    all_doors = [(o["t"], o["lebar"]) for o in front_op]
    for a0, a1, k in seg_rooms:
        front_op += windows(a0, a1, col_block(COL_ANG) + door_block(all_doors), sill=2.6, height=0.5, max_w=99,
                            jenis="ventilasi", ruang=k, src=KL)
    dinding.append({"id": f"{p}-miring-depan", "luar": True, "a": W(0, DR), "b": K_, "tebal": EXT, "bukaan": front_op, "sumber": D23})
    # belakang: jendela besar
    back_op = []
    for a0, a1, k in ([(0, A_PART, None), (A_PART, A_BR, None)] if no == 1 else [(0, A_BR, None)]):
        back_op += windows(a0, a1, col_block(COL_ANG))
    dinding.append({"id": f"{p}-miring-belakang", "luar": True, "a": W(0, 0), "b": [0, 0], "tebal": EXT, "bukaan": back_op, "sumber": D23})
    dinding.append({"id": f"{p}-miring-ujung", "luar": True, "a": W(0, 0), "b": W(0, DR), "tebal": EXT, "bukaan": [], "sumber": D23})
    if no == 1:
        dinding.append({"id": f"{p}-sekat-E102-E103", "a": W(A_PART, 0), "b": W(A_PART, DR), "tebal": INT, "bukaan": [], "sumber": D23})
    dinding.append({"id": f"{p}-sekat-senat", "a": W(A_BR, 0), "b": W(A_BR, DR), "tebal": INT, "bukaan": [], "sumber": D23})
    dinding.append({"id": f"{p}-bem-kiri", "a": [0, Z_KM], "b": S_, "tebal": INT, "bukaan": [], "sumber": D23})

    # dinding depan ruang sudut, K -> C (t diukur dari K). Ruang Sidang/R. Senat di K..S, blok HMIF di S..C.
    kS, kH = f"{p}-{senat[0]}", f"{p}-{bem[0]}"
    sudut_op, sudut_tp = [], []
    if no == 3:
        d1, d2 = r2(L_KC - 5.05), 0.85         # pintu Ruang Sidang (papan di pintu) dan pintu kedua (rambu merah)
        sudut_op += [{"jenis": "pintu", "t": d1, "lebar": 0.95, "tinggi": 3.0, "boven": 0.6, "bovenGelap": True, "ruang": kS,
                      "papanNama": True, "papanTeks": "Ruang Sidang", "sumber": FT},
                     {"jenis": "pintu", "t": d2, "lebar": 0.95, "tinggi": 3.0, "boven": 0.6, "bovenGelap": True, "ruang": kS, "sumber": FT}]
        sudut_tp += [
            {"jenis": "rambu", "t": r2(d1 - 1.0), "ambang": 1.65, "lebar": 0.5, "tinggi": 0.34, "teks": "RUANG|SIDANG", "ruang": kS, "sumber": FT},
            # urutan dari sudut C (footage tour lt 3 dan penghubung lt 3): panel kayu polos + lis merah tua, plakat berbingkai krem,
            # panel kayu sempit, papan tulis besar berbingkai aluminium, lalu pintu Ruang Sidang
            {"jenis": "papan-tulis", "t": r2(L_KC - 3.4), "ambang": 0.85, "lebar": 1.55, "tinggi": 1.35, "ruang": kH, "tebal": 0.03, "sumber": FT},
            {"jenis": "panel-kayu", "t": r2(L_KC - 2.4), "ambang": 0.0, "lebar": 0.42, "tinggi": 3.35, "ruang": kH, "tebal": 0.04, "sumber": FT},
            {"jenis": "plakat", "t": r2(L_KC - 1.42), "ambang": 0.03, "lebar": 1.54, "tinggi": 3.32, "ruang": kH, "tebal": 0.07,
             "teks": "DEPARTEMEN INFORMATIKA|FAKULTAS SAINS DAN MATEMATIKA|UNIVERSITAS DIPONEGORO", "sumber": FT},
            {"jenis": "panel-kayu", "warna": "#6a2a1f", "t": r2(L_KC - 0.63), "ambang": 0.25, "lebar": 0.05, "tinggi": 2.7, "ruang": kH, "tebal": 0.08, "sumber": FT},
            {"jenis": "panel-kayu", "t": r2(L_KC - 0.33), "ambang": 0.0, "lebar": 0.55, "tinggi": 3.35, "ruang": kH, "tebal": 0.05, "sumber": FT},
        ]
        blocked = door_block([(d1, 0.95), (d2, 0.95)]) + [(L_KC - 2.65, L_KC + 1)]
    else:
        sudut_op.append({"jenis": "pintu", "t": 1.6, "lebar": 0.95, "tinggi": 2.75, "boven": 0.6, "bovenGelap": True, "ruang": kS,
                         "papanNama": True, "papanTeks": papan(kS), "sumber": D23})
        # di depan blok BEM/Kantor Dosen: jendela berbingkai (lt 1) atau lemari kaca (lt 2) di bawah ventilasi gelap
        sudut_op.append({"jenis": "jendela", "t": r2(L_KC - 1.45), "lebar": 1.0, "ambang": 1.0, "tinggi": 1.15, "ruang": kH, "sumber": FT})
        blocked = door_block([(1.6, 0.95)]) + [(L_KC - 2.1, L_KC - 0.8), (L_KC - 0.45, L_KC + 1)]
    sudut_op += windows(0, T_S, blocked + [(T_S - 0.3, T_S + 0.3)], sill=2.6, height=0.5, max_w=99, jenis="ventilasi", ruang=kS, src=KL)
    sudut_op += windows(T_S, L_KC, blocked + [(T_S - 0.3, T_S + 0.3)], sill=2.5, height=0.6, max_w=99, jenis="ventilasi", ruang=kH, src=FT)
    dinding.append({"id": f"{p}-sudut-depan", "luar": True, "a": K_, "b": C_, "tebal": EXT, "bukaan": sudut_op, "tempelan": sudut_tp,
                    "sumber": FT, "catatan": "Dinding depan ruang sudut. Di footage ujungnya berhenti di sudut pintu HMIF, jadi garisnya "
                                             "berbelok sedikit dari garis depan sayap miring di denah 2023."})

    # dinding pintu HMIF / R. BEM / Kantor Dosen: C -> P, menghadap tenggara (ke penghubung dari Gedung A)
    pintu_h = {"jenis": "pintu", "t": 0.72, "lebar": 0.95, "tinggi": 2.75, "boven": 0.6, "bovenGelap": True, "ruang": kH,
               "papanNama": no < 3, "papanTeks": papan(kH), "sudutBuka": 3, "sumber": FT}
    hm_tp = []
    if no == 3:
        hm_tp = [{"jenis": "logo", "t": 0.72, "ambang": 2.92, "lebar": 0.6, "tinggi": 0.62, "teks": "hmif", "ruang": kH, "tebal": 0.04, "sumber": FT},
                 {"jenis": "papan-pengumuman", "t": 1.78, "ambang": 0.95, "lebar": 1.05, "tinggi": 1.3, "ruang": kH, "sumber": FT}]
    elif no == 2:
        hm_tp = [{"jenis": "poster", "t": 1.9, "ambang": 1.1, "lebar": 0.55, "tinggi": 0.75, "warna": "#1d2a44", "ruang": kH, "sumber": FT}]
    dinding.append({"id": f"{p}-hmif-depan", "luar": True, "a": C_, "b": P_, "tebal": EXT, "bukaan": [pintu_h], "tempelan": hm_tp,
                    "sumber": FT, "catatan": "Dinding tegak lurus sayap miring. Pintu di dekat sudut C, pilaster abu-abu di ujung P."})
    # dinding poster: P -> Q, menghadap selatan
    ps_tp = [{"jenis": "papan-dart", "t": 0.55, "ambang": 1.45, "lebar": 0.45, "tinggi": 0.45, "ruang": kH, "sumber": FT}] if no == 1 else \
            [{"jenis": "poster", "t": 0.56, "ambang": 1.0, "lebar": 0.62, "tinggi": 0.92, "ruang": kH, "sumber": FT}]
    dinding.append({"id": f"{p}-hmif-poster", "luar": True, "a": P_, "b": [X_BEM, Q_Z], "tebal": EXT, "bukaan": [], "tempelan": ps_tp, "sumber": FT})
    # dinding barat lorong toilet bagian selatan (= dinding timur blok HMIF): jendela tinggi gelap
    dinding.append({"id": f"{p}-bem-timur", "a": [X_BEM, Z_KM], "b": [X_BEM, Q_Z], "tebal": EXT, "sumber": FT,
                    "bukaan": [{"jenis": "ventilasi", "t": r2(Q_Z - Z_KM - 1.8), "lebar": 1.8, "ambang": 2.1, "tinggi": 0.8, "tertutup": True, "ruang": kH, "sumber": FT}],
                    "tempelan": [{"jenis": "rambu", "t": r2(Q_Z - Z_KM - 0.4), "ambang": 1.75, "lebar": 0.2, "tinggi": 0.06, "warna": "#202020",
                                  "ruang": kH, "sumber": FT}]})

    # ---------- dinding blok toilet ----------
    km_door = lambda t, kode, teks, w=0.8, ang=10: {"jenis": "pintu", "t": t, "lebar": w, "tinggi": 2.75, "boven": 0.6, "ruang": kode,
                                                  "papanNama": True, "papanTeks": teks, "sumber": FT, "sudutBuka": ang}
    ujung_kode, ujung_teks = (f"{p}-KMD", "KM Disabilitas") if no == 1 else (f"{p}-GD", "Gudang")
    dinding += [
        {"id": f"{p}-km-barat", "a": [0, 0], "b": [0, Z_KM], "tebal": INT, "bukaan": [], "sumber": D23},
        {"id": f"{p}-km-selatan", "a": [0, Z_KM], "b": [X_BEM, Z_KM], "tebal": INT, "bukaan": [], "sumber": D23},
        {"id": f"{p}-lorong-barat", "a": [X_BEM, 0], "b": [X_BEM, Z_KM], "tebal": INT, "sumber": FT,
         "bukaan": [km_door(2.3, f"{p}-KM1", "Toilet Wanita")]},
        {"id": f"{p}-lorong-ujung", "a": [X_BEM, Z_END], "b": [X_CW, Z_END], "tebal": INT, "sumber": FT,
         "bukaan": [km_door(1.45, ujung_kode, ujung_teks, 0.9 if no == 1 else 0.8, 5)]},
        {"id": f"{p}-lorong-timur", "a": [X_CW, 0], "b": [X_CW, Z_TGD], "tebal": INT, "sumber": FT,
         "bukaan": [km_door(2.15, f"{p}-KM2", "Toilet Pria", 0.8, 70)],
         "catatan": "Dinding antara lorong toilet dan tangga."},
        {"id": f"{p}-toilet2-selatan", "a": [X_CW, Z_K2], "b": [X_E101, Z_K2], "tebal": INT, "bukaan": [], "sumber": FT,
         "catatan": "Dinding belakang bordes tangga."},
    ]
    if no == 1:
        dinding += [
            {"id": f"{p}-gudang-selatan", "a": [X_CW, Z_GDD], "b": [X_KNEE, Z_GDD], "tebal": INT, "tinggi": 2.75, "sumber": FT,
             "bukaan": [{"jenis": "pintu", "t": 0.62, "lebar": 0.8, "tinggi": 2.1, "ruang": f"{p}-GD", "papanNama": True,
                         "papanTeks": "Gudang", "sumber": FT, "sudutBuka": 4}]},
            {"id": f"{p}-gudang-timur", "a": [X_KNEE, Z_LAND], "b": [X_KNEE, Z_GDD], "tebal": INT, "tinggi": 2.0, "bukaan": [], "sumber": FT},
        ]

    # ---------- dinding sayap lurus ----------
    back = [{"jenis": "jendela-tinggi", "t": 2.3, "lebar": 0.8, "ambang": 1.9, "tinggi": 0.6}]
    parts = [x1 for _, _, x0, x1, *_ in sr if x1 < XE]
    for kode, nama, x0, x1, *_ in sr:
        back += windows(x0, x1, col_block(COL_STR))
    dinding.append({"id": f"{p}-lurus-belakang", "luar": True, "a": [0, 0], "b": [XE, 0], "tebal": EXT, "bukaan": back, "sumber": D23})
    fr = []
    extra_block = [DEPT_ZONE] if no == 3 else []
    for kode, nama, x0, x1, ds, src, _ in sr:
        for dx, jenis, teks, *opt in ds:
            w = 1.1 if jenis == "pintu-ganda" else 0.95
            o = {"jenis": jenis, "t": r2(dx - X_E101), "lebar": w, "tinggi": 3.0, "boven": 0.6, "bovenGelap": True, "ruang": kode,
                 "papanNama": teks is not None, "papanTeks": teks, "sumber": src}
            if opt:
                o.update(opt[0])
            fr.append(o)
        for v in windows(x0, x1, col_block(COL_STR) + door_block([(d, 1.1) for d, *_ in ds]) + extra_block, sill=2.5, height=0.6, max_w=99,
                         jenis="ventilasi", ruang=kode, src=KL):
            v["t"] = r2(v["t"] - X_E101)
            fr.append(v)
    lurus_tp = []
    if no == 3:
        # Pintu Departemen Informatika (footage tour lt 3): portal hitam mengilap menonjol ±20 cm, kusen kiri tipis, panel lebar di kanan pintu,
        # kepala portal bertulisan 'DEPARTEMEN INFORMATIKA' dengan lencana Undip kecil di atas huruf pertama.
        # Di sekelilingnya kisi kayu vertikal: lajur sempit di kiri, pita di atas portal sampai plafon, panel lebar di kanan.
        k = f"{p}-DEPT"
        T = lambda x: r2(x - X_E101)
        d0, d1 = DEPT_X - 0.8, DEPT_X + 0.8         # tepi lubang pintu
        pl, pr, ph = d0 - 0.18, d1 + 1.05, 2.55     # tepi portal dan tinggi lubang
        z0, z1, ht = DEPT_ZONE[0], DEPT_ZONE[1], 3.75
        hitam = {"jenis": "tulisan", "warna": "#1b1c1f", "ruang": k, "tebal": 0.2, "sumber": FT}
        kisi = {"jenis": "panel-kisi", "ruang": k, "tebal": 0.05, "sumber": FT}
        lurus_tp = [
            {**kisi, "t": T((z0 + pl) / 2), "lebar": r2(pl - z0), "ambang": 0.0, "tinggi": ht},
            {**kisi, "t": T((pr + z1) / 2), "lebar": r2(z1 - pr), "ambang": 0.0, "tinggi": ht},
            {**kisi, "t": T((z0 + z1) / 2), "lebar": r2(z1 - z0), "ambang": 3.35, "tinggi": r2(ht - 3.35)},
            {**hitam, "t": T((pl + d0) / 2), "lebar": r2(d0 - pl), "ambang": 0.0, "tinggi": ph},
            {**hitam, "t": T((d1 + pr) / 2), "lebar": r2(pr - d1), "ambang": 0.0, "tinggi": ph},
            {**hitam, "t": T((pl + pr) / 2), "lebar": r2(pr - pl), "ambang": ph, "tinggi": 0.8, "teks": "DEPARTEMEN INFORMATIKA",
             "rata": "kiri", "besarHuruf": 0.3},
            {"jenis": "lambang", "t": T(pl + 0.33), "lebar": 0.17, "tinggi": 0.17, "ambang": 3.14, "ruang": k, "tebal": 0.22, "sumber": FT},
        ]
    dinding.append({"id": f"{p}-lurus-depan", "luar": True, "a": [X_E101, DR], "b": [XE, DR], "tebal": EXT, "bukaan": fr, "tempelan": lurus_tp, "sumber": D23})
    dinding.append({"id": f"{p}-e101-barat", "a": [X_E101, 0], "b": [X_E101, DR], "tebal": EXT, "bukaan": [], "sumber": D23})
    dinding.append({"id": f"{p}-lurus-timur", "luar": True, "a": [XE, 0], "b": [XE, DR], "tebal": EXT, "bukaan": [], "sumber": D23})
    for x in parts:
        dinding.append({"id": f"{p}-sekat-{x:g}", "a": [x, 0], "b": [x, DR], "tebal": INT, "bukaan": [], "sumber": D23})

    # ---------- pembatas lantai atas: tembok bercelah vertikal + pipa (footage) ----------
    if no > 1:
        dy = -0.05
        celah = {"jenis": "tembok-celah", "tinggi": 0.9, "sumber": FT,
                 "catatan": "Tembok pembatas selasar dengan celah-celah vertikal dan pipa di atasnya."}
        a_c = (ZS - 0.1 - (BL[1] + (ZS - 0.1) * N_[1])) / E_[1]     # sudut pertemuan garis luar selasar
        corner = W(a_c, ZS - 0.1)
        balkon = {"jenis": "tembok-polos", "tinggi": 1.05, "sumber": FT,
                  "catatan": "Balkon di pertemuan dua sayap, tembok penuh" + (" bertuliskan INFORMATIKA." if no == 3 else ".")}
        if no == 3:
            balkon["tulisan"] = {"teks": "INFORMATIKA", "t": 2.6, "tinggi": 0.4}
        pagar += [
            {"a": W(0.1, DR + 0.15) + [dy], "b": W(0.1, ZS - 0.1) + [dy], **celah},
            {"a": W(0.1, ZS - 0.1) + [dy], "b": corner + [dy], **celah},
            {"a": corner + [dy], "b": [PX0 - 0.2, ZS - 0.1, dy], **balkon},
            # celah di antara kolom x 2,43 dan 5,43: penghubung ke selasar Gedung A
            {"a": [PX1 + 0.2, ZS - 0.1, dy], "b": [XS - 0.1, ZS - 0.1, dy], **celah},
            {"a": [XS - 0.1, SS_ZD + 0.1, dy], "b": [XS - 0.1, ZS - 0.1, dy], **celah},
        ]
    if no == 3:
        pagar += [{"a": [X_KNEE + 0.08, Z_TGD, 0], "b": [X_E101 - 0.08, Z_TGD, 0], "jenis": "tembok-polos", "tinggi": 1.0, "sumber": FT,
                   "catatan": "Tembok setengah badan di tepi lubang tangga."},
                  {"a": [SS_X0, SS_ZD, dy], "b": [33.38, SS_ZD, dy], "jenis": "tembok-polos", "tinggi": 1.0, "sumber": FT}]

    # selasar: satu poligon dari ujung sayap miring sampai sayap lurus, tidak termasuk tangga
    selasar = [W(0, DR), K_, C_, P_, [X_BEM, Q_Z], [X_BEM, Z_TGD], [X_E101, Z_TGD], [X_E101, DR], [XE, DR], [XE, SS_ZD],
               [XS, SS_ZD], [XS, ZS], W((ZS - (BL[1] + ZS * N_[1])) / E_[1], ZS), W(0, ZS)]

    # perabot penanda dari footage, berdiri di depan dinding pintu HMIF (sisi hall)
    uh = [(P_[0] - C_[0]) / L_HMIF, (P_[1] - C_[1]) / L_HMIF]
    nh = [-uh[1], uh[0]]
    di_depan = lambda t, off=0.3: [r2(C_[0] + uh[0] * t + nh[0] * off), r2(C_[1] + uh[1] * t + nh[1] * off)]
    perabot = []
    if no == 3:
        perabot = [{"jenis": "tempat-sampah", "posisi": di_depan(1.55), "warna": "#2c3136", "sumber": FT},
                   {"jenis": "tempat-sampah", "posisi": di_depan(2.08), "warna": "#d9a21b", "sumber": FT}]
    elif no == 1:
        perabot = [{"jenis": "kotak", "posisi": di_depan(1.6, 0.35), "ukuran": [0.5, 0.42, 1.25], "arah": 60, "warna": "#d23a2c",
                    "sumber": FT, "catatan": "Kotak merah berdiri di samping pintu R. BEM."}]

    nxt = ELEV.get(no + 1)
    return {"no": no, "elevasi": Y, "elevasiSelasar": r2(Y - 0.05), "tinggiPlafon": r2((nxt - Y if nxt else H) - SLAB), "perabot": perabot,
            "denah": {"gambar": f"assets/denah/E{no}.jpg", "batas": [-26.0, -13.0, 35.5, 16.0],
                      "keterangan": f"Denah 2023 lantai {no}, diluruskan ke skala 40 px per meter."},
            "ruang": ruang, "dinding": dinding, "selasar": {"poligon": selasar}, "pagar": pagar}

# kolom. Footage: muka luar kolom rata dengan muka luar dinding (kolom hanya menonjol ke dalam ruang),
# dan kolom di tepi selasar berdiri di belakang muka tembok pembatas (tulisan INFORMATIKA di balkon tidak tertutup).
KI, KS = 0.1, 0.25                  # geser kolom ke dalam: dari garis dinding (tebal 0,2) dan dari tepi selasar
ZK = ZS - KS
a_k = (ZK - (BL[1] + ZK * N_[1])) / E_[1]       # sudut pertemuan garis kolom selasar dua sayap
a_c = (ZS - (BL[1] + ZS * N_[1])) / E_[1]       # sudut pertemuan tepi selasar dua sayap
kol = [W(a, b) for a in COL_ANG for b in (KI, DR - KI)] + [W(a, ZK) for a in COL_ANG[1:] + [16.3]] + [W(KS, ZK)]
kol += [W(KI, 3.0), W(KI, 6.55)]
_u = [(C_[0] - K_[0]) / L_KC, (C_[1] - K_[1]) / L_KC]
_n = [_u[1], -_u[0]]                # normal dinding K->C ke arah dalam ruang (ke belakang)
_h = [(P_[0] - C_[0]) / L_HMIF, (P_[1] - C_[1]) / L_HMIF]
_hn = [-_h[1], _h[0]]               # normal dinding pintu HMIF ke arah dalam ruang
kol += [[r2(K_[0] + _u[0] * T_S + _n[0] * KI), r2(K_[1] + _u[1] * T_S + _n[1] * KI)],
        [r2(C_[0] + (_n[0] + _hn[0]) * KI), r2(C_[1] + (_n[1] + _hn[1]) * KI)], P_]   # kolom sekat S, sudut C, pilaster abu-abu P (footage)
kol += [W(a_k, ZK)]
kol += [[x, KI] for x in COL_STR[:-1]] + [[XE - KI, KI]]
kol += [[x, DR - KI] for x in COL_STR if X_E101 <= x < XE] + [[XE - KI, DR - KI]]
kol += [[x, ZK] for x in [-0.55, 2.43, 5.43] + COL_STR[3:]]
kol += [[X_E101, 3.0], [X_E101, 6.6], [XE - KI, 3.0], [XE - KI, 6.6], [X_CW, Z_TGD], [XS - KS, SS_ZD], [XS - KS, ZK], [XS - KS, SS_ZB]]

data = {
    "schema": "fsm-gedung@1",
    "id": "E",
    "nama": "Gedung E",
    "kategori": "Blok akademik dan kantor",
    "deskripsi": "Gedung tiga lantai dengan dua sayap: sayap lurus berisi E101 dan ruang di atasnya, sayap miring 30 derajat di barat. Di tengah ada R. Senat, R. BEM, lorong toilet, dan tangga; tangga kedua ada di luar ujung utara. Selasarnya tersambung ke selasar Gedung A lewat penghubung yang tiba di hall depan pintu R. BEM / HMIF.",
    "sumberData": {
        "denah-2023": "Denah Gedung FSM Undip (2023), skala 1:150, lembar E LT.1 sampai LT.3.",
        "koreksi-lapangan": "Keterangan lapangan November 2026: tangga tengah di kiri E101, ventilasi atas di sisi selasar.",
        "footage-2026": "Footage video lapangan 21 November 2026 (7 klip + 3 foto Gedung E): blok toilet dan gudang, tangga bertembok, tangga samping, pembatas bercelah, urutan ruang lt 3, papan nama, beda tinggi lt 2 dan lt 3, bentuk blok HMIF/BEM di pertemuan sayap, plakat dan papan.",
        "foto-udara-2026": "Foto udara dari pengguna (22 Nov 2026): atap dua sayap menyatu."
    },
    "koordinat": "Meter. (0,0) = sudut belakang-kiri sayap lurus (titik pertemuan dua sayap); x ke timur, z dari dinding belakang (utara) ke selasar (selatan); y ke atas. Sayap miring diputar 30 derajat. Di kawasan, sayap lurus E membujur utara-selatan (lihat posisi dan rotasi di kampus.json), jadi 'timur' di sini berarti utara di peta.",
    "mulaiJalan": {"posisi": [3.9, 12.6], "arah": 0},
    "tampilan": {"dinding": "#d3d6d3", "dindingDalam": "#ecebe6", "kolom": "#c4c7c4", "lantai": "#e6e1d7",
                 "selasar": "#c9c9c3", "atap": "#4d5352", "kusen": "#3b464d", "pintu": "#8a5a3a", "pagar": "#c6cacd"},
    "kolom": {"ukuran": 0.4, "dasar": -0.2, "puncak": TOP, "titik": kol},
    "lantai": [floor(1), floor(2), floor(3)],
    "tangga": [{"id": f"T{f}", "dariLantai": f, "keLantai": f + 1, "x0": 8.32, "x1": X_CW + 0.08, "zDepan": Z_TGD, "zBelakang": Z_K2 + 0.07,
                "jumlahAnakTangga": 24, "lebarInjakan": 0.28, "celah": 0.15, "bentuk": "U dengan bordes", "pembatas": "tembok",
                "dindingSisiX0": False, "sisiLuar": "polos", "tiangAwal": f == 1, "gaya": "krem", "sumber": FT,
                "catatan": "Lajur pertama menempel dinding E101, naik ke utara; bordes menempel dinding toilet pria; lajur kedua kembali ke selasar. Di antara lajur ada tembok setengah badan berpipa pegangan."}
               for f in (1, 2)] +
              [{"id": f"S{f}", "dariLantai": f, "keLantai": f + 1, "x0": SS_X0, "x1": XS - 0.08, "zDepan": SS_ZD, "zBelakang": SS_ZB,
                "jumlahAnakTangga": 24, "lebarInjakan": 0.28, "celah": 0.15, "bentuk": "U dengan bordes (luar gedung)", "pembatas": "tembok",
                "dindingSisiX0": False, "sisiLuar": "tembok", "belakang": "tembok", "gaya": "krem", "sumber": FT,
                "catatan": "Tangga samping di ujung utara, di luar gedung dekat parkiran motor. Tembok pembatas dengan pipa pegangan abu-abu."}
               for f in (1, 2)],
    "tritisan": [t for no in (2, 3) for t in [
        {"a": W(0, ZS), "b": W((ZS - (BL[1] + ZS * N_[1])) / E_[1], ZS), "sisi": 1, "elevasi": ELEV[no], "lantai": no, "lebar": 1.3, "turun": 0.6, "jarak": 0.12,
         "sudutB": 30, "sumber": FT, "catatan": "Menyambung miring dengan tritisan sayap lurus di sudut balkon (tanpa celah)."},
        {"a": W((ZS - (BL[1] + ZS * N_[1])) / E_[1], ZS), "b": [PX0, ZS], "sisi": 1, "elevasi": ELEV[no], "lantai": no, "lebar": 1.3, "turun": 0.6, "jarak": 0.12,
         "sudutA": 30, "sumber": FT},
        {"a": [PX1, ZS], "b": [XS, ZS], "sisi": 1, "elevasi": ELEV[no], "lantai": no, "lebar": 1.3, "turun": 0.6, "jarak": 0.12, "sumber": FT,
         "catatan": "Atap genteng miring di depan selasar (foto tampak gedung E)."}]],
    # Atap dua sayap menyatu seperti di foto satelit: tiap atap diperpanjang lalu dipotong di garis bagi sudut
    # (dari pertemuan dinding belakang ke pertemuan tepi selasar), jadi bertemu dengan jurai lembah di belakang dan jurai di depan.
    "atap": [
        {"jenis": "perisai", "asal": [0, 0], "sudut": 0, "batas": [-12.0, 0, XS, ZS], "batasPlafon": [-3.6, 0, XS, ZS], "tepiBawah": TOP,
         "tonjolan": 0.9, "kemiringan": 30, "potong": [{"a": [0, 0], "b": W(a_c, ZS), "simpan": [10, 5], "jurai": True}],
         "sumber": UD, "catatan": "Sayap lurus"},
        {"jenis": "perisai", "asal": [r2(BL[0]), r2(BL[1])], "sudut": 30, "batas": [0, 0, 26.0, ZS], "batasPlafon": [0, 0, 15.3, ZS], "tepiBawah": TOP,
         "tonjolan": 0.9, "kemiringan": 30, "potong": [{"a": [0, 0], "b": W(a_c, ZS), "simpan": W(5, 5)}],
         "sumber": UD, "catatan": "Sayap miring"},
    ],
}

json.dump(data, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "gedung-e.json"), "w"), ensure_ascii=False, indent=1)
for f in data["lantai"]:
    print(f["no"], [r["kode"] for r in f["ruang"]])
print("dinding:", sum(len(f["dinding"]) for f in data["lantai"]), "kolom:", len(kol))
