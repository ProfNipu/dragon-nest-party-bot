# Dragon Nest Party Bot — Dokumentasi Lengkap

## 📦 Setup Awal

### 1. Buat Bot Discord
1. Buka https://discord.com/developers/applications → **New Application**
2. **General Information** → salin **Application ID** → isi ke `.env` sebagai `CLIENT_ID`
3. **Bot** tab → **Reset Token** → salin token → isi ke `.env` sebagai `DISCORD_TOKEN`
4. **OAuth2 → URL Generator**:
   - Scope: `bot` + `applications.commands`
   - Permissions: `Send Messages`, `Embed Links`, `Use Slash Commands`, `Create Public Threads`, `Send Messages in Threads`, `Manage Messages`
   - Buka URL, invite ke server

### 2. Ambil Server ID
- Discord Settings → Advanced → **Developer Mode** ON
- Klik kanan server → Copy ID → isi ke `.env` sebagai `GUILD_ID`

### 3. File `.env`
```env
DISCORD_TOKEN=token-bot-kamu
CLIENT_ID=application-id-kamu
GUILD_ID=server-id-kamu

# Optional: channel buat thread rekap loot (forum/text)
LOOT_THREAD_CHANNEL_ID=
```

### 4. Install & Jalanin
```bash
npm install
npm run deploy     # daftarin command ke Discord
npm start          # jalanin bot

# Biar 24 jam pake PM2:
npm install pm2 --save-dev
npx pm2 start src/index.js --name party-bot
npx pm2 save
```

---

## 🤖 Command List

### `/character` — Manajemen Karakter

| Subcommand | Deskripsi |
|---|---|
| `add` | Daftarin karakter baru |
| `list` | Lihat daftar karakter (bisa filter by user) |
| `remove` | Hapus karakter |

**Contoh:**
```
/character add ign: Kirito class: Moonlord
/character list
/character remove ign: Kirito
```

**Class tersedia:** Moonlord, Gladiator, Dark Avenger, Destroyer, Barbarian, Guardian, Crusader, Saint, Inquisitor, Elestra, Saleana, Majesty, Smasher, Wind Walker, Tempest, Artillery, Sniper, Adept, Physician, Shooting Star, Gear Master, Spirit Dancer, Blade Dancer, Dark Summoner, Soul Eater

---

### `/party` — Manajemen Party

| Subcommand | Deskripsi |
|---|---|
| `create` | Buat party baru |
| `list` | Lihat party aktif di channel |
| `recall` | Repost party yang sudah ke-*buried* |

**Contoh:**
```
/party create activity: Green Dragon Nest [Hardcore] tanks: 1 healers: 1 swordmasters: 1 flexible: 3 time: Sabtu 20:00 WIB note: Min pt 5k
/party list
/party recall activity: Manticore Nest
```

**Daftar Dungeon/Nest:**

| Dungeon | Type | Level | Limit/minggu |
|---|---|---|---|
| 🐲 Green Dragon Nest [Hardcore] | Raid | 50 | 1× |
| 🏜️ Desert Dragon Nest [Classic] | Raid | 60 | 1× |
| 🏜️ Desert Dragon Nest [Hardcore] | Raid | 60 | 1× |

**Role yang tersedia:**
| Role | Default | Subclass |
|---|---|---|
| 🛡️ Tank | 1 | Guardian, Destroyer, Crusader |
| ❤️ Healer | 1 | Saint, Physician, Inquisitor |
| ⚔️ Swordmaster | 1 | Moonlord, Gladiator, Dark Avenger |
| 🗡️ Mercenary | 1 | Destroyer, Barbarian |
| 🔮 Sorceress | 1 | Elestra, Saleana, Majesty, Smasher |
| 🔀 Flexible (DPS) | 3 | Semua class |

---

### `/limit` — Cek Limit Mingguan

**Contoh:**
```
/limit
```

**Output:**
```
📊 Weekly Limit — PlayerName

Kirito (Moonlord)
✅ Green Dragon Nest [Hardcore] — 0/1
⛔ Desert Dragon Nest [Classic] — 1/1
✅ Desert Dragon Nest [Hardcore] — 0/1
```

---

## 🎮 Fitur Interaktif

### Tombol di Party Embed

| Tombol | Fungsi | Siapa bisa? |
|---|---|---|
| 🛡️❤️⚔️ dll | Join role | Semua |
| 📣 Ping | Panggil semua anggota | Anggota party |
| 🚪 Leave | Keluar dari party | Anggota party |
| 👢 Kick | Tendang anggota | Leader saja |
| ✅ Finish | Selesai + buat thread loot | Leader saja |
| 💥 Disband | Bubarin party | Leader saja |

### Alur Finish Party
1. Leader klik **Finish** → muncul modal
2. Isi: siapa bawa loot, loot list, tanggal clear
3. Bot bikin thread rekap + masukin semua anggota
4. Otomatis ngurangin **1 weekly clear** buat setiap IGN

### Limit System
- Track per **IGN** (bukan per Discord user)
- Data disimpan di `data/limits.json`
- **Reset setiap hari Sabtu jam 08:00 WIB**
- Join ditolak kalau udah limit:
  > ⛔ **Kirito** sudah limit **Desert Dragon Nest [Classic]** minggu ini (1/1). Tunggu reset mingguan!

---

## 🛠️ PM2 Commands

```bash
npx pm2 status                    # Cek status bot
npx pm2 logs party-bot            # Lihat log
npx pm2 restart party-bot         # Restart bot
npx pm2 stop party-bot            # Matiin bot
npx pm2 delete party-bot          # Hapus dari pm2
```

---

## 📁 File Structure

```
dragon-nest-party-bot/
├── .env                      # Config (token, client id, dll)
├── .env.example              # Template .env
├── package.json
├── DOCS.md                   # Dokumentasi ini
├── README.md                 # README asli
├── data/
│   ├── characters.json       # Data karakter (persistent)
│   └── limits.json           # Data limit mingguan (persistent)
└── src/
    ├── index.js              # Entry point bot
    ├── deploy-commands.js    # Register slash command
    ├── commands/
    │   ├── character.js      # /character
    │   ├── party.js          # /party
    │   └── limit.js          # /limit
    └── handlers/
        ├── buttonHandler.js      # All button/select/modal logic
        ├── characterManager.js   # CRUD karakter
        ├── partyManager.js       # CRUD party
        ├── uiBuilders.js         # Embed & button builder
        ├── roleClasses.js        # Mapping role → subclass
        ├── dungeons.js           # Daftar dungeon + limit
        ├── limitManager.js       # Tracker limit mingguan
        └── lootManager.js        # Tracker loot & gaji
```
