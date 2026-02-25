const https = require('https');

function fetchListings(productId) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      filters: {
        term: { sellerStatus: "Live", channelId: 0, condition: ["Near Mint"] },
        range: {},
        exclude: { channelExclusion: 0 }
      },
      from: 0,
      size: 25,
      sort: { field: "price+shipping", order: "asc" },
      context: { shippingCountry: "US", cart: {} }
    });

    const options = {
      hostname: 'mp-search-api.tcgplayer.com',
      path: `/v1/product/${productId}/listings`,
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/json',
        'Origin': 'https://www.tcgplayer.com',
        'Referer': 'https://www.tcgplayer.com/',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function parseProductUrl(url) {
  const match = url.match(/\/product\/(\d+)\/?([^?]*)/);
  if (!match) return null;
  const productId = match[1];
  const slug = match[2] || '';
  const name = slug.split('/').pop().replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim() || `Product ${productId}`;
  return { productId, name, url };
}

module.exports = { fetchListings, parseProductUrl };
