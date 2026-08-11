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

if (errors.length > 0) {
  console.error("Desktop release contract failed:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Desktop release contract is valid for v${version}.`);
