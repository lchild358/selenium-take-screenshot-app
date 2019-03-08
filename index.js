const fs = require('fs');
const webdriver = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const firefox = require('selenium-webdriver/firefox');
const concat = require('concat-image');
const combine = require('combine-image');
const jimp = require('jimp');
const args = require('command-line-args');

const optsdef = [
  {name: 'url', alias: 'u', type: String},
  {name: 'output', alias: 'o', type: String}
];

const opts = args(optsdef);
if(! opts.url || ! opts.output){
  /* */ console.log('Usage: node index.js --url <url> --output <image file>');
  process.exit(1);
}

let take = async function(webdriver, url, file) {
  webdriver.manage().window().maximize();
  webdriver.get(url);
  /* */ console.log(`url: ${url}`);

  let totalHeight = await webdriver.executeScript('return document.body.offsetHeight');
  let totalWidth = await webdriver.executeScript('return document.body.offsetWidth');

  let windowHeight = await webdriver.executeScript('return window.innerHeight');

  /* */ console.log(`width: ${totalWidth}, height: ${totalHeight}, window-height: ${windowHeight}`);

  webdriver.manage().window().setSize(totalWidth, totalHeight);

  var offset = 0;
  var offY = 0;
  var files = [];
  while(offset < totalHeight){

    let img64 = await driver.takeScreenshot();
    let tmpfile = `${file}_${offset}.png`;
    fs.writeFileSync(tmpfile, img64, 'base64');
    /* */ console.log(`Take screenshot ${tmpfile}`);
    if(offY > 0) {
      let img = await jimp.read(tmpfile);
      img.crop(0, offY, totalWidth, windowHeight - offY);
      img.write(tmpfile);
    }
    files.push({src: tmpfile, offsetX: 0, offsetY: 0});

    offset += windowHeight;
    if(offset + windowHeight > totalHeight){
      offY = offset + windowHeight - totalHeight;
      /* */ console.log(`offset Y: ${offY}`);
    }
    await webdriver.executeScript('window.scrollTo(0,'+offset+')');
  }

  /* */ console.log('Combining...');
  let img = await combine(files, {direction:'row'});
  img.write(`${file}.png`);

  /* */ console.log('Deleting temporary files...');
  files.forEach((file)=>{
    fs.unlinkSync(file.src);
  });

  /* */ console.log('Done');
  webdriver.quit();

};

let driver = new webdriver.Builder()
    .forBrowser('firefox')
//    .forBrowser('chrome')
//    .setChromeOptions(/* ... */)
//    .setFirefoxOptions(/* ... */)
    .build();

take(driver, opts.url, opts.output);

