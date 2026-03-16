const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'lanyards.db'));

function seed() {
  db.serialize(() => {
    // Disable foreign keys temporarily for clean seed
    db.run('PRAGMA foreign_keys = OFF');
    db.run('DELETE FROM order_items');
    db.run('DELETE FROM cart_items');
    db.run('DELETE FROM products');
    db.run('DELETE FROM categories');
    db.run('DELETE FROM blog_posts');
    db.run('DELETE FROM orders');

    // Insert Categories
    const categories = [
      { name: 'PERSONALISED ID CARDS', slug: 'personalised-id-cards', description: "UK's Favourite Supplier of custom identity cards.", image: 'images/category_printed.png', product_count: 3 },
      { name: 'Employee ID Cards', slug: 'employee-id-cards', description: 'Professional employee identification badges.', image: 'images/category_plain.png', product_count: 1 },
      { name: 'ID Accessories', slug: 'id-accessories', description: 'ID card holders, clips, badge reels and more.', image: 'images/category_attachments.png', product_count: 1 }
    ];

    const categoryMap = {};
    const catStmt = db.prepare(`INSERT INTO categories (name, slug, description, image, product_count) VALUES (?, ?, ?, ?, ?)`);
    categories.forEach((c) => {
      catStmt.run(c.name, c.slug, c.description, c.image, c.product_count, function(err) {
        if (err) console.error('Category insert error:', err.message);
        categoryMap[c.slug] = this.lastID;
      });
    });
    catStmt.finalize();

    db.run('SELECT 1', [], function() {
      // -------------------------
      // Products
      // -------------------------
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

      const prodStmt = db.prepare(`INSERT INTO products (category_id, name, slug, description, price_from, image, badge, badge_type, featured) VALUES (?,?,?,?,?,?,?,?,?)`);
      products.forEach(p => {
        const cat_id = categoryMap[p.cat_slug];
        prodStmt.run(cat_id, p.name, p.slug, p.description, p.price_from, p.image, p.badge, p.badge_type, p.featured);
      });
      prodStmt.finalize();
    });

    const posts = [
      {
        title: 'The Ultimate Guide to Choosing the Right ID Cards',
        slug: 'guide-choosing-right-id-cards',
        excerpt: "Learn how to select the best identity solutions for your organization.",
        content: '...',
        tag: 'ID Cards'
      }
    ];

    const postStmt = db.prepare(`INSERT INTO blog_posts (title, slug, excerpt, content, tag) VALUES (?,?,?,?,?)`);
    posts.forEach(p => postStmt.run(p.title, p.slug, p.excerpt, p.content, p.tag));
    postStmt.finalize();

    console.log('Syncing categories and products...');
  });

  setTimeout(() => {
    console.log('✅ Database updated with new category structure successfully!');
    db.close();
  }, 2000);
}

seed();
