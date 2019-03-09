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
  {name: 'output', alias: 'o', type: String},
  {name: 'input', alias: 'i', type: String},
  {name: 'dir', alias: 'd', type: String}
];

const opts = args(optsdef);
if(! (!!opts.url   && !!opts.output) &&
   ! (!!opts.input && !!opts.dir   )
){
  /* */ console.log('Usage: node index.js --url <url> --output <image file>');
  /* */ console.log('       node index.js --input <json file> --dir <output directory>');
  process.exit(1);
}

let takeN = async function(webdriver, inputData, dir) {
  webdriver.manage().window().maximize();

  // expect .urls is array and not an empty array
  if(!!inputData.urls && inputData.urls.constructor === Array && inputData.urls.length > 0){
    for(var i = 0; i < inputData.urls.length; i++){
      let urlData = inputData.urls[i];
      // expect .url is string
      // expect .file is string
      if(!!urlData.url  && typeof(urlData.url)  === 'string' && urlData.url  !== '' &&
         !!urlData.file && typeof(urlData.file) === 'string' && urlData.file !== ''){
        let url = urlData.url;
        let file = urlData.file;
        // go to url
        webdriver.get(url);
        /* */ console.log(`url: ${url}`);
        // calculate website toal height and width
        let totalHeight = await webdriver.executeScript('return document.body.offsetHeight');
        let totalWidth = await webdriver.executeScript('return document.body.offsetWidth');
        // calculate browser window height
        let windowHeight = await webdriver.executeScript('return window.innerHeight');
        /* */ console.log(`width: ${totalWidth}, height: ${totalHeight}, window-height: ${windowHeight}`);
        
        // scroll and take screenshot
        await webdriver.executeScript('window.scrollTo(0,0)');
        var offset = 0;
        var offY = 0;
        var files = [];
        while(offset < totalHeight){
          // take single screenshot
          let img64 = await driver.takeScreenshot();
          // write image into temporary file
          let tmpfile = `${file}_${offset}.png`; // temporary file name
          fs.writeFileSync(tmpfile, img64, 'base64');
          /* */ console.log(`Take screenshot ${tmpfile}`);
          // crop last image file
          if(offY > 0) {
            /* */ console.log(`crop at ${offY}`);
            let img = await jimp.read(tmpfile);
            img.crop(0, offY, totalWidth, windowHeight - offY);
            img.write(tmpfile);
          }
          // Add image file into list for merging
          files.push({src: tmpfile, offsetX: 0, offsetY: 0});
          // scroll browser window down
          offset += windowHeight;
          await webdriver.executeScript('window.scrollTo(0,'+offset+')');
          // calculate y offset for cropping
          if(offset + windowHeight > totalHeight){
            offY = offset + windowHeight - totalHeight;
          }
        }

        // Merge images and write into file
        /* */ console.log('Combining...');
        let img = await combine(files, {direction:'row'});
        img.write(`${dir}/${file}.png`);

        // Delete temporary files
        /* */ console.log('Deleting temporary files...');
        files.forEach((file)=>{
          fs.unlinkSync(file.src);
        });

      }
    } // end of input.urls.forEach
    
    /* */ console.log('Done');
    webdriver.quit();
  }
};

let driver = new webdriver.Builder()
    .forBrowser('firefox')
//    .forBrowser('chrome')
//    .setChromeOptions(/* ... */)
//    .setFirefoxOptions(/* ... */)
    .build();

if(!!opts.url && !!opts.output){
  let inputData = {
    urls: [
      {
        url: opts.url,
        file: opts.output
      }
    ]
  };
  takeN(driver, inputData, '.');
}else if(!!opts.input && !!opts.dir){
  const inputData = require(`${__dirname}/${opts.input}`);
  takeN(driver, inputData, opts.dir);
}

