import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { gzipSync } from "zlib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist");
const bundleBudgetKb = Number(process.env.BUNDLE_BUDGET_KB || 200);

if (!fs.existsSync(distDir)) {
  console.error("❌ Bundle output not found. Run `npm run build` first.");
  process.exit(1);
}

function collectFiles(dir, predicate) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(collectFiles(fullPath, predicate));
    } else if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

const assetFiles = collectFiles(distDir, (filePath) =>
  [".js", ".mjs", ".css", ".qwik"].some((ext) => filePath.endsWith(ext)),
);

if (assetFiles.length === 0) {
  console.warn("⚠️ No bundle assets detected for size check.");
  process.exit(0);
}

const totalGzipBytes = assetFiles.reduce((sum, filePath) => {
  const content = fs.readFileSync(filePath);
  return sum + gzipSync(content).length;
}, 0);

const totalKb = totalGzipBytes / 1024;

if (totalKb > bundleBudgetKb) {
  console.error(
    `❌ Bundle too large: ${totalKb.toFixed(1)} KB (budget ${bundleBudgetKb} KB).`,
  );
  process.exit(1);
}

console.log(
  `✅ Bundle size within budget: ${totalKb.toFixed(1)} KB (budget ${bundleBudgetKb} KB).`,
);

