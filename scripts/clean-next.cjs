/**
 * Remove .next/ so the next `next build` or `next dev` recreates a full output.
 * Fixes ENOENT for routes-manifest.json and similar when .next is partial/corrupt.
 */
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", ".next");
if (fs.existsSync(dir)) {
  fs.rmSync(dir, { recursive: true, force: true });
  console.log("Removed .next/");
} else {
  console.log("No .next/ to remove.");
}
