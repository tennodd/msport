// ========================= Custom MobileMenu.js (Lightbox) =========================
import wixData from 'wix-data';
import wixLocation from 'wix-location';
import wixSite from 'wix-site';
import wixWindow from 'wix-window';
import { products } from 'wix-stores.v2';

const DEBUG = true;
function logDebug(context, ...args) {
  if (DEBUG) console.log(`[DEBUG:${context}]`, ...args);
}
function logError(context, err) {
  console.error(`[ERROR:${context}]`, err.message, err.stack);
}

const LIST_MAIN = '#mainMenuRepeater';
const LIST_SUB  = '#subMenuRepeater';
const BTN_BACK  = '#backBtn';
const CLOSE_X   = '#menuCloseIcon';

let _cats  = [];
let _pages = [];

$w.onReady(async function () {
  logDebug('MobileMenu onReady', 'start');
  try {
    await loadData();
    renderMain();
    bindClose();
    logDebug('MobileMenu onReady', 'completed');
  } catch (e) {
    logError('MobileMenu onReady', e);
    debugger;
  }
});

async function loadData() {
  // STUB: two fake menu items
  _cats = [
    { kind: 'cat', id: 'stub1', name: 'Категорія 1', url: '/stub1' },
    { kind: 'page', id: null, name: 'Сторінка 2', url: '/stub2' }
  ];
  // No pages for this test
  _pages = [];
}


function renderMain() {
  logDebug('renderMain', 'cats+pages:', _cats.length + _pages.length);
  $w(LIST_MAIN).data = _cats.concat(_pages);
  $w(LIST_MAIN).show();
  $w(LIST_SUB).hide();
  $w(BTN_BACK).hide();
}

async function renderSub(cat) {
  logDebug('renderSub', 'cat:', cat);
  try {
    const res = await products.queryProducts()
      .hasSome('collectionIds', [cat.id])
      .find();
    logDebug('renderSub:Products', 'items:', res.items.length);

    const types = Array.from(
      new Set(
        res.items.flatMap(p => {
          const opt = p.productOptions && p.productOptions.find(o => o.name === 'Type');
          return opt && opt.choices
            ? opt.choices.map(c => c.description)
            : [];
        })
      )
    ).filter(Boolean);

    if (!types.length) {
      if (cat.url) {
        wixLocation.to(cat.url);
      }
      wixWindow.lightbox.close();
      return;
    }

    $w(LIST_SUB).data = types.map(t => ({
      kind: 'type',
      name: t,
      url: `${cat.url}?type=${encodeURIComponent(t)}`
    }));
    $w(LIST_MAIN).hide();
    $w(LIST_SUB).show();
    $w(BTN_BACK).show();
  } catch (e) {
    logError(`renderSub:queryProducts(${cat.id})`, e);
  }
}

function bindClose() {
  logDebug('bindClose');
  $w(CLOSE_X).onClick(() => wixWindow.lightbox.close());
}

export function mainMenuRepeater_itemReady($item, itemData) {
  try {
    logDebug('mainRepeater_itemReady', itemData);
    $item('#menuTextMain').text = itemData.name;
    $item('#menuItemBoxMain').onClick(() => {
      if (itemData.kind === 'cat') {
        renderSub(itemData);
      } else if (itemData.url) {
        wixLocation.to(itemData.url);
        wixWindow.lightbox.close();
      }
    });
  } catch (e) {
    logError('mainMenuRepeater_itemReady', e);
  }
}

export function subMenuRepeater_itemReady($item, itemData) {
  try {
    logDebug('subRepeater_itemReady', itemData);
    $item('#menuTextSub').text = itemData.name;
    $item('#menuItemBoxSub').onClick(() => {
      if (itemData.url) wixLocation.to(itemData.url);
      wixWindow.lightbox.close();
    });
  } catch (e) {
    logError('subMenuRepeater_itemReady', e);
  }
}

export function backBtn_click() {
  logDebug('backBtn_click');
  renderMain();
}