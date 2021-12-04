import axios from 'axios';
import puppeteer from 'puppeteer';
import cheerio from 'cheerio';
import fs from 'fs';
import csvWriter from 'csv-writer'
import cliProgress from 'cli-progress'
class Logger {
    constructor(name, folderName) {
        return new Promise(async (resolve, reject) => {
            if (!(await fs.existsSync(folderName))) {
                await fs.mkdirSync(folderName)
            }
            const fullPath = `./${folderName}/${name}.log`
            if (await fs.existsSync(fullPath)) {
                await fs.unlinkSync(fullPath)
            }
            const stream = fs.createWriteStream(fullPath, {
                flags: 'a'
            })
            this.logger = (new console.Console(stream))
            resolve(this.logger)
        });
    }
}
if (!String.prototype.replaceAll) {
    String.prototype.replaceAll = function (str, newStr) {
        if (Object.prototype.toString.call(str).toLowerCase() === '[object regexp]') {
            return this.replace(str, newStr);
        }
        return this.replace(new RegExp(str, 'g'), newStr);
    };
}

async function launchPuppeteer(headless = false) {
    const browser = await puppeteer.launch({
        headless: headless
    });
    const page = await browser.newPage();

    return { page, browser }
}

function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve()
        }, ms)
    })
}


function makeAbsoluteLink(string) {
    return 'https://cbr.ru' + string
}

function cleanString(string) {
    return string.replaceAll('\n', '')
}

async function fetchItemFromHTML(html) {
    const $ = await cheerio.load(html, {
        decodeEntities: false
    })
    // $('.commemor-coin .commemor-coin_intro.d-none').remove()
    const images = $('.commemor-coin .commemor-coin_images img').get().map(item => makeAbsoluteLink(item.attribs.src))
    const title = $('h1').text()
    const moneyOptions = $('.commemor-coin .commemor-coin_intro .money_options .money_option').map((i, el) => {
        const key = $(el).find(".money_option_title").text().trim()
        const val = $(el).find(".money_option_value").text().trim()
        return {
            key,
            val
        }
    }).get()
    const characteristics = $('.commemor-coin_info_characteristics .commemor-coin_info_characteristic').map((i, el) => {
        const key = $(el).find(".characteristic_denomenation").text().trim()
        const val = $(el).find(".characteristic_value").text().trim()
        return {
            key,
            val
        }
    }).get()
    $(`.commemor-coin .commemor-coin_content div[class^="commemor-coin"]`).remove()
    const content = $('.commemor-coin_content').html().trim()
    // let splittedContent;
    // try {
    //     splittedContent = content.split('<h2>').map(item => item.trim()).filter(item => item).map(item => '<h2>' + item)
    // } catch (error) {
    //     console.log("🚀 ~ file: main.js ~ line 86 ~ fetchItemFromHTML ~ error", error)
    // }
    // const content = $('.commemor-coin_content').html().trim()
    const serie = $('.commemor-coin .commemor-coin_intro.d-none .commemor-coin_intro_text').text().trim()
    return {
        title: cleanString(title),
        images,
        moneyOptions,
        characteristics,
        content,
        serie
        // splittedContent
    }
}

function flatFromKeyValue(payload) {
    return payload.reduce((acc, { key, val }) => {
        acc[key] = val
        return acc
    }, {})
}

function remakeItem({ item, logger }) {
    const {
        moneyOptions,
        images,
        serie,
        characteristics,
        splittedContent,
        ...otherProperties
    } = item
    const imagesJoined = images.reduce((acc, val, index) => {
        acc[`image${index}`] = val
        return acc
    }, {})
    const serieTransformed = serie.replaceAll("  ", '').trim()
    logger.log(serieTransformed)
    return {
        ...otherProperties,
        serie:serieTransformed,
        ...imagesJoined,
        ...flatFromKeyValue(characteristics),
        ...flatFromKeyValue(moneyOptions)
    }
}
function getAllKeys(payload) {
    const keysSet = new Set()
    for (let item of payload) {
        Object.keys(item).forEach(it => keysSet.add(it))
    }

    return Array.from(keysSet)
}

async function getLinks() {
    const { page, browser } = await launchPuppeteer()
    await page.goto('https://cbr.ru/cash_circulation/memorable_coins/coins_base/')
    await page.evaluate(async () => {
        document.querySelector('.filters_wrapper .filters .filter:first-child .filter_title').click()
        document.querySelector('.filter.open .filter_content .filter-select .filter-select_option:first-child input').click()
    });
    await sleep(4000)
    const items = await page.evaluate(async () => {
        return Array.from(document.querySelectorAll('.coins-tile .coins-tile_item a')).map(item => item.href)
    })
    await fs.writeFileSync('outputLinks1.json', JSON.stringify(items));
    await page.close();
    await browser.close()
}

async function downloadItems() {
    const progress = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    const links = JSON.parse(await fs.readFileSync('outputLinks1.json'))
    const resultArray = []
    const itemsLength = links.length
    progress.start(itemsLength, 0);
    for (let i = 0; i < itemsLength; i++) {
        const link = links[i]
        try {
            const { data: pageHTML } = await axios.get(link)
            const itemData = await fetchItemFromHTML(pageHTML)
            resultArray.push(itemData)
            progress.update(i);
        } catch (error) {
            progress.update(i);
            console.log("🚀 ~ file: main.js ~ line 114 ~ main ~ error", error)
        }
    }
    progress.update(itemsLength);
    progress.stop();
    await fs.writeFileSync('result1.json', JSON.stringify(resultArray));
}

async function remake({ logger }) {
    // const progress = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    const createCsvWriter = csvWriter.createObjectCsvWriter;

    const items = JSON.parse(await fs.readFileSync("./result1.json"))
    // const itemsLength = links.length
    // for (let i = 0; i < itemsLength; i++ ) {

    // }
    const transformedItems = items.map(item => remakeItem({ item, logger }))
    const headers = getAllKeys(transformedItems)
    const csvWriterInstance = createCsvWriter({
        path: 'output6.csv',
        header: headers.map(item => {
            return {
                id: item,
                title: item
            }
        })
    });
    await csvWriterInstance.writeRecords(transformedItems)
}
// remake()
async function main() {
    const logger = await new Logger("remake", "logs")
    console.log("Process start")
    // await getLinks()
    // await downloadItems()
    await remake({ logger })
    console.log("Process end")
}
main()