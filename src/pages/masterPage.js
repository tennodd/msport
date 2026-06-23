// ========================= masterPage.js =========================
import wixWindow from 'wix-window';

const DEBUG = true;
function logDebug(context, ...args) {
  if (DEBUG) console.log(`[DEBUG:${context}]`, ...args);
}
function logError(context, err) {
  console.error(`[ERROR:${context}]`, err.message, err.stack);
}

$w.onReady(function () {
  logDebug('masterPage onReady', 'start');
  try {
    if (wixWindow.formFactor !== 'Mobile') {
      logDebug('masterPage', 'not mobile, skipping');
      return;
    }

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
    }
  } catch (e) {
    logError('masterPage onReady', e);
  }
});
