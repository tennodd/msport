import wixLocation from 'wix-location';
import wixData from 'wix-data';

$w.onReady(() => {
  const currentSlug = wixLocation.path[0]; // наприклад: 'shoes', 'bikes', 'bike-helmet'

  // Фільтруємо товари по productType
  $w("#productsDataset").setFilter(
    wixData.filter().eq("productType", currentSlug)
  );

  // Готуємо картки
  $w("#repeater1").onItemReady(($item, itemData) => {
    const price = itemData.price;
    const sale = itemData.discountedPrice ?? price;

    // Назва товару
    $item("#productName").text = itemData.name;

    // Ціни
    $item("#price").text = `${price} грн`;
    $item("#salePrice").text = `${sale} грн`;

    // Відсоток знижки
    if (price && sale < price) {
      const percent = Math.round(100 - (sale / price) * 100);
      $item("#discountLabel").text = `-${percent}%`;
      $item("#discountLabel").show();
    } else {
      $item("#discountLabel").collapse();
    }

    // Фото
    if (itemData.mainMedia) {
      $item("#productImage").src = itemData.mainMedia;
    }
  });
});
