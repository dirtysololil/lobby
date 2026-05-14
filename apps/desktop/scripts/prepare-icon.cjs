const fs = require("node:fs");
const path = require("node:path");

const sourcePngPath = path.resolve(__dirname, "..", "..", "..", "icons", "512x512.png");
const outputDir = path.resolve(__dirname, "..", "build");
const outputIconPath = path.join(outputDir, "icon.ico");

function createIcoFromPng(pngBuffer) {
  const header = Buffer.alloc(22);

  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt8(0, 6);
  header.writeUInt8(0, 7);
  header.writeUInt8(0, 8);
  header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(pngBuffer.length, 14);
  header.writeUInt32LE(header.length, 18);

  return Buffer.concat([header, pngBuffer]);
}

if (!fs.existsSync(sourcePngPath)) {
  throw new Error(`Desktop icon source is missing: ${sourcePngPath}`);
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputIconPath, createIcoFromPng(fs.readFileSync(sourcePngPath)));
console.log(`[desktop] prepared ${path.relative(process.cwd(), outputIconPath)}`);
