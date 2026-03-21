const fs = require("node:fs");
const path = require("node:path");

let didLoad = false;

function stripOuterQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const normalized = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
  const separatorIndex = normalized.indexOf("=");
  if (separatorIndex <= 0) return null;

  const key = normalized.slice(0, separatorIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;

  const rawValue = normalized.slice(separatorIndex + 1).trim();
  return { key, value: stripOuterQuotes(rawValue) };
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    values[parsed.key] = parsed.value;
  }
  return values;
}

function loadLocalEnv(options = {}) {
  if (didLoad) return;
  didLoad = true;

  const cwd = options.cwd || process.cwd();
  const localPath = path.resolve(cwd, ".env.local");
  const envPath = path.resolve(cwd, ".env");

  const localValues = parseEnvFile(localPath);
  const envValues = parseEnvFile(envPath);

  // Prefer .env.local. Allow it to override values that were likely preloaded
  // from .env by tooling, while keeping explicit shell env precedence.
  for (const [key, localValue] of Object.entries(localValues)) {
    const existing = process.env[key];
    if (existing === undefined) {
      process.env[key] = localValue;
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(envValues, key) && existing === envValues[key]) {
      process.env[key] = localValue;
    }
  }

  // Fill remaining keys from .env as fallback only.
  for (const [key, envValue] of Object.entries(envValues)) {
    if (process.env[key] === undefined) {
      process.env[key] = envValue;
    }
  }
}

module.exports = loadLocalEnv;
module.exports.loadLocalEnv = loadLocalEnv;
