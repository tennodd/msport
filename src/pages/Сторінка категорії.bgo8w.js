// Довідник API Velo: https://www.wix.com/velo/reference/api-overview/introduction

$w.onReady(function () {
  $w("#repeater1").onItemReady(($item, itemData) => {
    const price = itemData.price;
    const sale = itemData.discountedPrice ?? price;

    // Назва
    $item("#productName").text = itemData.name;

    // Ціни
    $item("#price").text = `${price} грн`;
    $item("#salePrice").text = `${sale} грн`;

    // Знижка у %
    if (price && sale < price) {
      const percent = Math.round(100 - (sale / price) * 100);
      $item("#discountLabel").text = `-${percent}%`;
      $item("#discountLabel").show();
    } else {
      $item("#discountLabel").collapse();
    }

    // Фото товару
    if (itemData.mainMedia) {
      $item("#productImage").src = itemData.mainMedia;
    }
  });
});
