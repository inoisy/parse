import axios from 'axios';
import puppeteer from 'puppeteer';
import cheerio from 'cheerio';
import fs from 'fs';
if (!String.prototype.replaceAll) {
    String.prototype.replaceAll = function (str, newStr) {

        // If a regex pattern
        if (Object.prototype.toString.call(str).toLowerCase() === '[object regexp]') {
            return this.replace(str, newStr);
        }

        // If a string
        return this.replace(new RegExp(str, 'g'), newStr);

    };
}

async function launchPuppeteer(headless = false) {
    const browser = await puppeteer.launch({
        headless: headless
    });
    const page = await browser.newPage();

    return page
}

function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve()
        }, ms)
    })
}
async function getLinks() {
    console.log("🚀 ~ file: main.js ~ line 4 ~ main ~ main")
    const page = await launchPuppeteer()

    await page.goto('https://cbr.ru/cash_circulation/memorable_coins/coins_base/')
    await page.evaluate(async () => {
        document.querySelector('.filters_wrapper .filters .filter:first-child .filter_title').click()
        document.querySelector('.filter.open .filter_content .filter-select .filter-select_option:first-child input').click()
    });
    await sleep(4000)
    const items = await page.evaluate(async () => {
        return Array.from(document.querySelectorAll('.coins-tile .coins-tile_item a')).map(item => item.href)
    })

    console.log("🚀 ~ file: main.js ~ line 22 ~ awaitpage.evaluate ~ items", items.length, "-----", items[0])
    await fs.writeFileSync('outputLinks.json', JSON.stringify(items));

}
function makeAbsoluteLink(string) {
    return 'https://cbr.ru' + string
}
function cleanString(string) {
    return string.replaceAll('\n', '')
}
async function fetchItemFromHTML(html) {
    // console.log("🚀 ~ file: main.js ~ line 41 ~ fetchItemFromHTML ~ html", html)
    const $ = await cheerio.load(html, {
        decodeEntities: false
    })
    const images = $('.commemor-coin .commemor-coin_images img').get().map(item => makeAbsoluteLink(item.attribs.src))
    // console.log("🚀 ~ file: main.js ~ line 46 ~ fetchItemFromHTML ~ images", images)
    const title = $('h1').text()
    const moneyOptions = $('.commemor-coin .commemor-coin_intro:not(.d-none) .money_options .money_option').map((i, el) => {
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
    // console.log("🚀 ~ file: main.js ~ line 82 ~ fetchItemFromHTML ~ content", content)
    let splittedContent;
    try {
        splittedContent = content.split('<h2>').map(item => item.trim()).filter(item => item).map(item => '<h2>' + item)
    } catch (error) {
        console.log("🚀 ~ file: main.js ~ line 86 ~ fetchItemFromHTML ~ error", error)
    }
    return {
        title: cleanString(title),
        images,
        moneyOptions,
        characteristics,
        content,
        splittedContent
    }
}
async function main() {
    const links = JSON.parse(await fs.readFileSync('outputLinks.json'))
    console.log("🚀 ~ file: main.js ~ line 43 ~ main ~ links", links[0])
    const resultArray = []
    for (let link of links) {
        try {
            console.log("🚀 ~ file: main.js ~ line 45 ~ main ~ link", link)
            const { data: pageHTML } = await axios.get(link)
            // console.log("🚀 ~ file: main.js ~ line 47 ~ main ~ data", data)
            const itemData = await fetchItemFromHTML(pageHTML)
            // console.log("🚀 ~ file: main.js ~ line 53 ~ main ~ itemData", itemData)
            resultArray.push(itemData)
        } catch (error) {
            console.log("🚀 ~ file: main.js ~ line 114 ~ main ~ error", error)
        }
        // document.querySelectorAll(".commemor-coin .commemor-coin_images img")
    }
    console.log("🚀 ~ file: main.js ~ line 112 ~ main ~ resultArray", resultArray)
    await fs.writeFileSync('result.json', JSON.stringify(resultArray));
}

main()