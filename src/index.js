require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { getDb, save } = require('./db');
const { fetchListings, parseProductUrl } = require('./tcgplayer');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await getDb();
  startMonitorLoop();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const db = await getDb();
  const userId = interaction.user.id;

  try {
    if (interaction.commandName === 'add-monitor') {
      const url = interaction.options.getString('url');
      const maxPrice = interaction.options.getNumber('max_price');
      const parsed = parseProductUrl(url);
      if (!parsed) return interaction.reply({ content: '❌ Invalid TCGPlayer URL.', ephemeral: true });

      db.run('INSERT INTO monitors (user_id, product_id, product_name, product_url, max_price) VALUES (?, ?, ?, ?, ?)',
        [userId, parsed.productId, parsed.name, url, maxPrice]);
      save();
      await interaction.reply(`✅ Monitoring **${parsed.name}** for listings under **$${maxPrice.toFixed(2)}**. I'll DM you when I find a match!`);
    }

    else if (interaction.commandName === 'list-monitors') {
      const rows = db.exec('SELECT id, product_name, max_price, active FROM monitors WHERE user_id = ? ORDER BY id', [userId]);
      if (!rows.length || !rows[0].values.length) return interaction.reply({ content: 'No monitors found.', ephemeral: true });
      const lines = rows[0].values.map(r => {
        const status = r[3] ? '🟢' : '⏸️';
        return `${status} **#${r[0]}** — ${r[1]} (≤ $${Number(r[2]).toFixed(2)})`;
      });
      await interaction.reply({ content: lines.join('\n'), ephemeral: true });
    }

    else if (interaction.commandName === 'remove-monitor') {
      const id = interaction.options.getInteger('id');
      const check = db.exec('SELECT id FROM monitors WHERE id = ? AND user_id = ?', [id, userId]);
      if (!check.length || !check[0].values.length) return interaction.reply({ content: '❌ Monitor not found.', ephemeral: true });
      db.run('DELETE FROM alerted_listings WHERE monitor_id = ?', [id]);
      db.run('DELETE FROM monitors WHERE id = ?', [id]);
      save();
      await interaction.reply({ content: `✅ Monitor #${id} removed.`, ephemeral: true });
    }

    else if (interaction.commandName === 'pause-monitor') {
      const id = interaction.options.getInteger('id');
      const check = db.exec('SELECT id FROM monitors WHERE id = ? AND user_id = ?', [id, userId]);
      if (!check.length || !check[0].values.length) return interaction.reply({ content: '❌ Monitor not found.', ephemeral: true });
      db.run('UPDATE monitors SET active = 0 WHERE id = ?', [id]);
      save();
      await interaction.reply({ content: `⏸️ Monitor #${id} paused.`, ephemeral: true });
    }

    else if (interaction.commandName === 'resume-monitor') {
      const id = interaction.options.getInteger('id');
      const check = db.exec('SELECT id FROM monitors WHERE id = ? AND user_id = ?', [id, userId]);
      if (!check.length || !check[0].values.length) return interaction.reply({ content: '❌ Monitor not found.', ephemeral: true });
      db.run('UPDATE monitors SET active = 1 WHERE id = ?', [id]);
      save();
      await interaction.reply({ content: `▶️ Monitor #${id} resumed.`, ephemeral: true });
    }
  } catch (err) {
    console.error('Command error:', err);
    const reply = interaction.deferred || interaction.replied ? 'editReply' : 'reply';
    await interaction[reply]({ content: '❌ An error occurred.', ephemeral: true }).catch(() => {});
  }
});

async function checkMonitor(monitor) {
  const [id, userId, productId, productName, productUrl, maxPrice] = monitor;
  try {
    const data = await fetchListings(productId);
    const listings = data?.results?.[0]?.results || [];
    const db = await getDb();

    for (const listing of listings) {
      if (listing.listingType !== 'standard') continue;
      const totalPrice = listing.price + (listing.shippingPrice || 0);
      if (totalPrice > maxPrice) continue;

      // Create a unique listing ID from seller + price + quantity
      const listingId = `${listing.sellerName}-${listing.price}-${listing.quantity}`;

      // Check if already alerted
      const exists = db.exec('SELECT 1 FROM alerted_listings WHERE monitor_id = ? AND listing_id = ?', [id, listingId]);
      if (exists.length && exists[0].values.length) continue;

      // Record alert
      db.run('INSERT OR IGNORE INTO alerted_listings (monitor_id, listing_id, price, seller_name) VALUES (?, ?, ?, ?)',
        [id, listingId, listing.price, listing.sellerName]);
      save();

      // Send DM
      try {
        const user = await client.users.fetch(userId);
        const embed = new EmbedBuilder()
          .setColor(0x00c853)
          .setTitle(`💰 ${productName}`)
          .setURL(productUrl)
          .addFields(
            { name: 'Price', value: `$${listing.price.toFixed(2)}`, inline: true },
            { name: 'Shipping', value: `$${(listing.shippingPrice || 0).toFixed(2)}`, inline: true },
            { name: 'Total', value: `$${(listing.price + (listing.shippingPrice || 0)).toFixed(2)}`, inline: true },
            { name: 'Seller', value: `${listing.sellerName}${listing.goldSeller ? ' ⭐' : ''}`, inline: true },
            { name: 'Rating', value: `${listing.sellerRating || 'N/A'}%`, inline: true },
            { name: 'Sales', value: `${listing.sellerSales || 'N/A'}`, inline: true },
            { name: 'Qty Available', value: `${listing.quantity}`, inline: true },
          )
          .setTimestamp();
        await user.send({ embeds: [embed] });
        console.log(`Alerted ${userId} for ${productName} @ $${listing.price}`);
      } catch (dmErr) {
        console.error(`Failed to DM ${userId}:`, dmErr.message);
      }
    }
  } catch (err) {
    console.error(`Error checking monitor #${id}:`, err.message);
  }
}

function startMonitorLoop() {
  setInterval(async () => {
    const db = await getDb();
    const rows = db.exec('SELECT id, user_id, product_id, product_name, product_url, max_price FROM monitors WHERE active = 1');
    if (!rows.length) return;
    for (let i = 0; i < rows[0].values.length; i++) {
      await checkMonitor(rows[0].values[i]);
      if (rows[0].values.length > 1) await new Promise(r => setTimeout(r, 2000)); // rate limit delay
    }
  }, 90_000);
  console.log('Monitor loop started (90s interval)');
}

client.login(process.env.BOT_TOKEN);
