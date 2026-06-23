// ========================= homepage.js =========================
import wixWindow from 'wix-window';
import wixData   from 'wix-data';

const DEBUG = true;

function logDebug(context, ...args) {
  if (DEBUG) console.log(`[DEBUG:${context}]`, ...args);
}

function logError(context, err) {
  console.error(`[ERROR:${context}]`, err.message, err.stack);
}

const PLACEHOLDER = 'wix:image://v1/placeholder.jpg/placeholder.jpg';

$w.onReady(async () => {
  logDebug('homepage onReady', 'start');

  // ─── Mobile menu toggle ───
  try {
    if (wixWindow.formFactor === 'Mobile') {
      const burger = $w('#hamburgerIcon');
      if (burger) {
        burger.onClick(async () => {
          logDebug('hamburgerIcon', 'clicked');
          try {
            await wixWindow.openLightbox('MobileMenu');
            logDebug('openLightbox', 'success');
          } catch (e) {
            logError('openLightbox', e);
          }
        });
      } else {
        logDebug('homepage', '#hamburgerIcon not found');
      }
    }
  } catch (e) {
    logError('menuToggle', e);
  }

  // // ─── Populate Pro Gallery via code (no dataset) ───
  // try {
  //   logDebug('gallery', 'querying Stores/Collections');
  //   const result = await wixData
  //     .query('Stores/Collections')
  //     .ascending('sortOrder')
  //     .limit(100)
  //     .find();

  //   logDebug('gallery', 'queried items:', result.items.length);

  //   // keep only top-level categories
  //   const categories = result.items.filter(cat =>
  //     !cat.parentCollectionId && cat.slug !== 'all-products'
  //   );
  //   logDebug('gallery', 'filtered categories:', categories.length);

  //   // shape into Pro Gallery items
  //   const galleryItems = categories.map(cat => {
  //     const srcUrl = (cat.mainMedia && cat.mainMedia.src) || PLACEHOLDER;
  //     return {
  //       type:        'image',              // must be 'image'
  //       src:         srcUrl,               // string URL
  //       title:       cat.name,             
  //       description: cat.description || '',
  //       link:        cat.pageUrl || `/category/${cat.slug}`  // string URL
  //     };
  //   });

  //   const gallery = $w('#categoriesGallery');
  //   if (!gallery) throw new Error('#categoriesGallery element not found');

  //   logDebug('gallery', 'assigning items');
  //   gallery.items = galleryItems;
  //   logDebug('gallery', 'items set:', galleryItems.length);

  // } catch (e) {
  //   logError('populateGallery', e);

  //   // Stub fallback for Editor Preview (wixData.query errors in Preview)
  //   try {
  //     $w('#categoriesGallery').items = [{
  //       type:        'image',
  //       src:         PLACEHOLDER,
  //       title:       'Demo Category',
  //       description: '',
  //       link:        '#'                // simple string
  //     }];
  //     logDebug('populateGallery', 'fallback stub set');
  //   } catch (err) {
  //     logError('populateGallery fallback', err);
  //   }
  // }

  logDebug('homepage onReady', 'end');
});