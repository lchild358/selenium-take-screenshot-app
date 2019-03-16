const fs = require('fs');
const Webdriver = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const firefox = require('selenium-webdriver/firefox');
const concat = require('concat-image');
const combine = require('combine-image');
const jimp = require('jimp');
const args = require('command-line-args');
const looksSame = require('looks-same');
const moment = require('moment');
const Validator = require('node-obj-validator');
const sleep = require('system-sleep');

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

let initDriver = function(){
  // setting chrome options 
  var chromeCapabilities = Webdriver.Capabilities.chrome();
  var chromeOptions = require(`${__dirname}/chrome-options.json`);
  chromeCapabilities.set('chromeOptions', chromeOptions);

  let driver = new Webdriver.Builder()
//  .forBrowser('firefox')
  .forBrowser('chrome')
//  .setChromeOptions(/* ... */)
//  .setFirefoxOptions(/* ... */)
  .withCapabilities(chromeCapabilities)
  .build();

  return driver;
};

let takeN = async function(webdriver, inputData, dir) {
  webdriver.manage().window().maximize();

  // expect .urls is array and not an empty array
  if(!!inputData.urls && inputData.urls.constructor === Array && inputData.urls.length > 0){
    for(var i = 0; i < inputData.urls.length; i++){
      /* */ console.log("");
      let urlData = inputData.urls[i];

      // Pro processing
      if(typeof(urlData.pre) === 'object' && urlData.pre !== null){
        // go to url
        webdriver.get(urlData.pre.url);
        /* */ console.log(`url: ${urlData.pre.url}`);
        // Perform actions
        for(var i = 0; i < urlData.pre.actions.length; i++){
          try{
            var action = urlData.pre.actions[i];
            // Get target element
            var target = action.target;
            /* */ console.log(`Find element: ${target.type}: ${target.id}`);
            var element;
            switch(target.type){
              case 'id':
                element = webdriver.findElement(Webdriver.By.id(target.id));
              break;
              case 'className':
                element = webdriver.findElement(Webdriver.By.className(target.id));
              break;
              case 'css':
                element = webdriver.findElement(Webdriver.By.css(target.id));
              break;
              case 'js':
                element = webdriver.findElement(Webdriver.By.js(target.id));
              break;
              case 'linkText':
                element = webdriver.findElement(Webdriver.By.linkText(target.id));
              break;
              case 'name':
                element = webdriver.findElement(Webdriver.By.name(target.id));
              break;
              case 'partialLinkText':
                element = webdriver.findElement(Webdriver.By.partialLinkText(target.id));
              break;
              case 'xpath':
                element = webdriver.findElement(Webdriver.By.xpath(target.id));
              break;
            }

            // Do action
            if(!!element){
              /* */ console.log(`Do action: ${action.command}: ${action.value}`);
              switch (action.command){
                // Clear
                case 'clear':
                  element.clear();
                break;
                // Input
                case 'input':
                  element.clear();
                  element.sendKeys(action.value);
                break;
                // Click
                case 'click':
                  element.click();
                break;
                // Submit
                case 'submit':
                  element.submit();
                break;
              }
            }
          }catch(e){
            console.error(`Error: ${e}`);
          }
        }
      }
    
      let file = urlData.file;
      // go to url
      let url = urlData.url;
      if(typeof(url) === 'string' && url !== ''){
        webdriver.get(url);
        /* */ console.log(`url: ${url}`);
      }

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
        let img64 = await webdriver.takeScreenshot();
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

      // Check for old file (if exists)
      var name = `${dir}/${file}.png`;
      var renamedName = '';
      if(fs.existsSync(name)) {
        // Rename old file
        var time = moment().format('YYYYMMDDHHmmssSSS');
        renamedName = `${dir}/${file}_${time}.png`;
        fs.renameSync(name, renamedName);
      }
      // Merge images and write into file
      /* */ console.log('Combining...');
      let img = await combine(files, {direction:'row'});
      img.write(name);

      // Compare image
      if(renamedName !== ''){
        /* */ console.log('Comparing...');
        sleep(5000);
        looksSame(renamedName, name, require(`${__dirname}/looksame.json`), (error, equal) => {
          /* */ if(error) console.log(error);
          if(!!equal && ! equal.equal){
            /* */ console.log('Diff!');
            var diffopt = require(`${__dirname}/looksamediff.json`);
            diffopt['reference'] = renamedName;
            diffopt['current'] = name,
            diffopt['diff'] = `${dir}/${file}_${time}_diff.png`;

            looksSame.createDiff(diffopt, (error)=>{
              /* */ console.log(error);
            });
          }else{
            /* */ console.log('Same!')
          }
        });
      }

      // Delete temporary files
      /* */ console.log('Deleting temporary files...');
      files.forEach((file)=>{
        fs.unlinkSync(file.src);
      });

    } // end of input.urls.forEach
    
    /* */ console.log('Done');
    webdriver.quit();
  }
};

if(!!opts.url && !!opts.output){

  let driver = initDriver();

  let inputData = {
    urls: [
      {
        url: opts.url,
        file: opts.output
      }
    ]
  };
  // Execute
  takeN(driver, inputData, '.');
}else if(!!opts.input && !!opts.dir){
  // Read input file
  const inputData = require(`${__dirname}/${opts.input}`);
  // Create validator for input file 
  let validator = new Validator(require(`${__dirname}/input_validate.json`));
  // Validate input file
  let rs = validator.validate(inputData, (errors)=>{
    // Input file is not valid, print out errors
    errors.forEach((error)=>{
      console.log(`${error.id}:${error.value}:${error.message}`);
    })
    //
  }, ()=>{

    let driver = initDriver();
    // Execute
    takeN(driver, inputData, opts.dir);
  });
};



