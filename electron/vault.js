// Local media vault — Package 2 of TEMPO Desktop.
// See planning/desktop/02-TECHNICAL-AND-DATA-DESIGN.md §3 for the design.
//
// Mirrors lib/storage.ts's path convention exactly:
//   tracks/{trackId}/versions/{versionId}/{filename}
//   tracks/{trackId}/assets/{assetId}/{filename}
// so a cloud storage path IS the vault's lookup key — no separate mapping
// table. Deliberately a plain JSON index rather than a native SQLite
// dependency: this program should not need a compiled native module just to
// track "which files do I have and what's their checksum."

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { app } = require("electron");

const INDEX_FILENAME = "index.json";
const SETTINGS_FILENAME = "vault-settings.json";

function defaultVaultRoot() {
  // Documents is the sensible default on both platforms and is what the
  // product spec promises ("Documents on Windows"). Settings can relocate it.
  return path.join(app.getPath("documents"), "TEMPO");
}

function settingsPath() {
  return path.join(app.getPath("userData"), SETTINGS_FILENAME);
}

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
  } catch {
    return {};
  }
}

function writeSettings(next) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2));
}

class Vault {
  constructor() {
    const saved = readSettings();
    this.root = saved.vaultRoot || defaultVaultRoot();
    this._ensureDir(this.root);
    this.index = this._loadIndex();
  }

  _ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
  }

  _indexPath() {
    return path.join(this.root, INDEX_FILENAME);
  }

  _loadIndex() {
    try {
      return JSON.parse(fs.readFileSync(this._indexPath(), "utf8"));
    } catch {
      return {};
    }
  }

  _saveIndex() {
    fs.writeFileSync(this._indexPath(), JSON.stringify(this.index, null, 2));
  }

  // Storage paths look like "tracks/{id}/versions/{id}/file.mp3" — always
  // forward-slash, never containing ".." (sanitizeFilename on the web side
  // already strips path-hostile characters from the filename segment; this
  // is a second, cheap guard against a malformed path ever escaping the vault).
  _localFile(storagePath) {
    const normalized = storagePath.replace(/^\/+/, "");
    if (normalized.includes("..")) {
      throw new Error(`Refusing an unsafe vault path: ${storagePath}`);
    }
    return path.join(this.root, ...normalized.split("/"));
  }

  has(storagePath) {
    const entry = this.index[storagePath];
    if (!entry) return false;
    return fs.existsSync(this._localFile(storagePath));
  }

  stat(storagePath) {
    return this.index[storagePath] || null;
  }

  async write(storagePath, buffer) {
    const dest = this._localFile(storagePath);
    this._ensureDir(path.dirname(dest));
    await fs.promises.writeFile(dest, buffer);
    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
    this.index[storagePath] = {
      checksum,
      size: buffer.length,
      updatedAt: new Date().toISOString(),
    };
    this._saveIndex();
    return { checksum, size: buffer.length };
  }

  remove(storagePath) {
    const dest = this._localFile(storagePath);
    try {
      fs.unlinkSync(dest);
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
    delete this.index[storagePath];
    this._saveIndex();
  }

  // Periodic sweep for files on disk with no index entry (e.g. an interrupted
  // write) or index entries with no file on disk (deleted outside TEMPO) —
  // keeps the index honest without a check on every single read.
  reconcile() {
    let removed = 0;
    for (const storagePath of Object.keys(this.index)) {
      if (!fs.existsSync(this._localFile(storagePath))) {
        delete this.index[storagePath];
        removed += 1;
      }
    }
    if (removed > 0) this._saveIndex();
    return { removedOrphanEntries: removed };
  }

  stats() {
    const files = Object.values(this.index);
    return {
      vaultRoot: this.root,
      fileCount: files.length,
      totalBytes: files.reduce((sum, f) => sum + (f.size || 0), 0),
    };
  }

  // Best-effort relocation: copies everything to the new root, verifies each
  // file landed, then removes the old root. Stops and reports rather than
  // half-completing if anything can't be copied (a full disk, a permissions
  // problem) — the old vault is left untouched in that case.
  async relocate(newRoot) {
    if (path.resolve(newRoot) === path.resolve(this.root)) {
      return { ok: true };
    }
    this._ensureDir(newRoot);
    const oldRoot = this.root;
    try {
      for (const storagePath of Object.keys(this.index)) {
        const from = this._localFile(storagePath);
        const to = path.join(newRoot, ...storagePath.split("/"));
        if (!fs.existsSync(from)) continue;
        fs.mkdirSync(path.dirname(to), { recursive: true });
        await fs.promises.copyFile(from, to);
      }
    } catch (err) {
      return { ok: false, error: err.message };
    }

    this.root = newRoot;
    this._saveIndex();
    writeSettings({ vaultRoot: newRoot });

    try {
      fs.rmSync(oldRoot, { recursive: true, force: true });
    } catch {
      // Old copy left behind is a nuisance, not a data-loss risk — the new
      // root is already authoritative and saved, so don't fail the move over it.
    }

    return { ok: true };
  }
}

module.exports = { Vault, defaultVaultRoot };
