const fs = require("fs");
const path = require("path");
const { photoDir } = require("./config");

function getPhotoFiles(directory = photoDir) {
  try {
    return fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(jpe?g|png)$/i.test(entry.name))
      .map((entry) => path.join(directory, entry.name));
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

function selectRandomPhotos(directory = photoDir, random = Math.random) {
  const photos = getPhotoFiles(directory);
  if (photos.length < 2) {
    throw new Error(`At least two JPG or PNG photos are required in ${directory}`);
  }
  const selected = [];
  for (let i = 0; i < 2; i++) {
    selected.push(photos.splice(Math.floor(random() * photos.length), 1)[0]);
  }
  return selected;
}

module.exports = { getPhotoFiles, selectRandomPhotos };
