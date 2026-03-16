const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'lanyards.db'));

async function runSeed() {
  const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

  try {
    console.log('Clearing old data...');
    await run('PRAGMA foreign_keys = OFF');
    await run('DELETE FROM order_items');
    await run('DELETE FROM cart_items');
    await run('DELETE FROM products');
    await run('DELETE FROM categories');
    await run('DELETE FROM blog_posts');
    await run('DELETE FROM orders');
    await run('PRAGMA foreign_keys = ON');

    console.log('Inserting categories...');
    const categories = [
      { name: 'PERSONALISED ID CARDS', slug: 'personalised-id-cards', description: "UK's Favourite Supplier of custom identity cards.", image: 'images/category_printed.png', product_count: 3 },
      { name: 'Employee ID Cards', slug: 'employee-id-cards', description: 'Professional employee identification badges.', image: 'images/category_plain.png', product_count: 1 },
      { name: 'ID Accessories', slug: 'id-accessories', description: 'ID card holders, clips, badge reels and more.', image: 'images/category_attachments.png', product_count: 1 }
    ];

    const categoryMap = {};
    for (const cat of categories) {
      const result = await run(
        'INSERT INTO categories (name, slug, description, image, product_count) VALUES (?, ?, ?, ?, ?)',
        [cat.name, cat.slug, cat.description, cat.image, cat.product_count]
      );
      categoryMap[cat.slug] = result.lastID;
    }

    console.log('Inserting products...');
    const products = [
      {
        cat_slug: 'personalised-id-cards', name: 'Custom Printed ID Cards', slug: 'custom-printed-id-cards',
        description: 'Full-colour high quality custom printed ID cards.', price_from: 0.48,
        image: 'images/product_heat_transfer.png', badge: null, badge_type: 'default', featured: 1
      },
      {
        cat_slug: 'personalised-id-cards', name: 'Express Employee ID Cards – 3–5 Days Delivery', slug: 'express-employee-id-cards',
        description: 'Professional employee ID badges delivered in just 3-5 working days.', price_from: 1.37,
        image: 'images/product_express.png', badge: 'EXPRESS SERVICE', badge_type: 'express', featured: 1
      },
      {
        cat_slug: 'personalised-id-cards', name: 'Standard PVC ID Cards', slug: 'standard-pvc-id-cards',
        description: 'Durable PVC identity cards for general use.', price_from: 0.36,
        image: 'images/product_flat_polyester.png', badge: null, badge_type: 'default', featured: 1
      },
      {
        cat_slug: 'employee-id-cards', name: 'Employee ID Badge', slug: 'employee-id-badge',
        description: 'Comfortable and durable identification badges.', price_from: 0.38,
        image: 'images/category_plain.png', badge: null, badge_type: 'default', featured: 1
      },
      {
        cat_slug: 'id-accessories', name: 'Plastic ID Card Holder', slug: 'plastic-id-card-holder', 
        description: 'Clear PVC ID card holder compatible with all standard lanyard widths.', 
        price_from: 0.12, image: 'images/category_attachments.png', badge: null, badge_type: 'default', featured: 0 
      }
    ];

    for (const p of products) {
      await run(
        'INSERT INTO products (category_id, name, slug, description, price_from, image, badge, badge_type, featured) VALUES (?,?,?,?,?,?,?,?,?)',
        [categoryMap[p.cat_slug], p.name, p.slug, p.description, p.price_from, p.image, p.badge, p.badge_type, p.featured]
      );
    }

    console.log('Inserting blog posts...');
    const posts = [
      {
        title: 'The Ultimate Guide to Choosing the Right ID Cards',
        slug: 'guide-choosing-right-id-cards',
        excerpt: "Learn how to select the best identity solutions for your organization.",
        content: '...',
        tag: 'ID Cards'
      }
    ];

    for (const post of posts) {
      await run(
        'INSERT INTO blog_posts (title, slug, excerpt, content, tag) VALUES (?,?,?,?,?)',
        [post.title, post.slug, post.excerpt, post.content, post.tag]
      );
    }

    console.log('✅ Database updated with correctly mapped categories and products!');
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
  } finally {
    db.close();
  }
}

runSeed();
