const fs = require('fs');
const path = require('path');

module.exports.createFolder = async (folderPath) => {
  try {
    await fs.promises.access(folderPath);
  } catch (error) {
    await fs.promises.mkdir(folderPath, {recursive: true});
  }
}

module.exports.checkFileExists = async (filePath) => {
  try {
    await fs.promises.access(path.resolve(filePath), fs.constants.F_OK)
    return true // exists
  } catch (error) {
    return false // not exists
  }
}
