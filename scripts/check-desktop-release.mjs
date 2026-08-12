import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const desktopPackagePath = path.join(root, "electron", "package.json");
const desktopLockPath = path.join(root, "electron", "package-lock.json");

const desktopPackage = JSON.parse(fs.readFileSync(desktopPackagePath, "utf8"));
const desktopLock = JSON.parse(fs.readFileSync(desktopLockPath, "utf8"));
const errors = [];

const version = desktopPackage.version;
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version ?? "")) {
  errors.push(`electron/package.json has an invalid version: ${version ?? "missing"}`);
}

if (desktopPackage.build?.extraMetadata?.version !== version) {
  errors.push("electron/package.json version and build.extraMetadata.version must match");
}

if (desktopLock.version !== version || desktopLock.packages?.[""]?.version !== version) {
  errors.push("electron/package-lock.json root versions must match electron/package.json");
}

const publish = desktopPackage.build?.publish;
if (
  publish?.provider !== "github" ||
  publish?.owner !== "nikitapage10" ||
  publish?.repo !== "tempo-desktop-releases"
) {
  errors.push(
    "desktop builds must publish to the public nikitapage10/tempo-desktop-releases channel"
  );
}

if (desktopPackage.build?.win?.target !== "nsis") {
  errors.push("Windows desktop releases must use the NSIS updater-compatible target");
}

if (desktopPackage.build?.win?.artifactName !== "TEMPO-Setup.${ext}") {
  errors.push("the Windows installer must keep the stable TEMPO-Setup.${ext} asset name");
}

const nsis = desktopPackage.build?.nsis;
if (nsis?.oneClick !== false) {
  errors.push("Windows installer must use the assisted wizard (nsis.oneClick: false)");
}
if (nsis?.allowToChangeInstallationDirectory !== true) {
  errors.push("Windows installer must let artists choose the install folder");
}
const buildResources = path.join(root, "electron", "build");
for (const asset of ["installerSidebar.bmp", "installerHeader.bmp", "installer.nsh"]) {
  if (!fs.existsSync(path.join(buildResources, asset))) {
    errors.push(`missing electron/build/${asset} for the branded Windows wizard`);
  }
}

const mac = desktopPackage.build?.mac;
if (mac?.artifactName !== "TEMPO-Mac.${ext}") {
  errors.push("the Mac DMG must keep the stable TEMPO-Mac.${ext} asset name");
}
if (mac?.identity !== null) {
  errors.push("Mac releases stay unsigned until Apple signing is configured (identity must be null)");
}

const macTargets = Array.isArray(mac?.target) ? mac.target : mac?.target ? [mac.target] : [];
const hasDmg = macTargets.some((t) =>
  typeof t === "string" ? t === "dmg" : t?.target === "dmg"
);
if (!hasDmg) {
  errors.push("Mac desktop releases must include a dmg target");
}

if (errors.length > 0) {
  console.error("Desktop release contract failed:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Desktop release contract is valid for v${version}.`);
