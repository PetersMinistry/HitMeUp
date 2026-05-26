const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const aboutHtml = fs.readFileSync(path.join(root, "about.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

assert.match(
  aboutHtml,
  /https:\/\/github\.com\/PetersMinistry\/HitMeUp/,
  "About page should link to the GitHub repository for updates"
);

assert.match(
  aboutHtml,
  new RegExp(`Version\\s+${manifest.version.replaceAll(".", "\\.")}`),
  "About page version should match manifest version"
);

assert.equal(
  manifest.homepage_url,
  "https://github.com/PetersMinistry/HitMeUp",
  "Manifest should expose the GitHub repository as the add-on homepage"
);

assert.doesNotMatch(
  aboutHtml,
  /Set reminders from the right-click menu or toolbar\./,
  "About page should not claim toolbar reminder creation"
);

console.log("about page tests passed");
