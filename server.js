const dns = require('dns');
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from the project directory
app.use(express.static(path.join(__dirname, 'public')));

// 1. DYNAMIC DATABASE CONNECTION & AUTO-CREATION SYSTEM
let dbType = (process.env.DB_TYPE || 'mysql').toLowerCase();
let pool = null;

async function initDatabase() {
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || (dbType === 'mysql' ? '3306' : '5432')),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'wellshine_db'
    };

    console.log(`Checking connection to database engine: ${dbType.toUpperCase()} on ${dbConfig.host}:${dbConfig.port}...`);

    try {
        // --- STEP 1: CONNECT TO ENGINE AND CREATE DATABASE IF NOT EXIST ---
        if (dbType === 'postgres' || dbType === 'postgresql') {
            const { Client, Pool } = require('pg');
            const connectionString = process.env.DATABASE_URL;

            if (connectionString) {
                console.log("Connecting to PostgreSQL using DATABASE_URL...");
                const sslConfig = !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')
                    ? { rejectUnauthorized: false }
                    : false;

                pool = new Pool({
                    connectionString,
                    ssl: sslConfig
                });
            } else {
                const sslConfig = dbConfig.host !== 'localhost' && dbConfig.host !== '127.0.0.1'
                    ? { rejectUnauthorized: false }
                    : false;

                const tempClient = new Client({
                    host: dbConfig.host,
                    port: dbConfig.port,
                    user: dbConfig.user,
                    password: dbConfig.password,
                    database: 'postgres',
                    ssl: sslConfig
                });
                await tempClient.connect();
                const res = await tempClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbConfig.database]);
                if (res.rows.length === 0) {
                    console.log(`Database '${dbConfig.database}' not found. Creating it automatically...`);
                    await tempClient.query(`CREATE DATABASE "${dbConfig.database}"`);
                    console.log(`Database '${dbConfig.database}' created.`);
                }
                await tempClient.end();

                // Establish PG Pool on the target database
                pool = new Pool({
                    host: dbConfig.host,
                    port: dbConfig.port,
                    user: dbConfig.user,
                    password: dbConfig.password,
                    database: dbConfig.database,
                    ssl: sslConfig
                });
            }
        } else {
            // Default to MySQL
            const mysql = require('mysql2/promise');
            const tempConn = await mysql.createConnection({
                host: dbConfig.host,
                port: dbConfig.port,
                user: dbConfig.user,
                password: dbConfig.password
            });
            
            console.log(`Database '${dbConfig.database}' check...`);
            await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
            await tempConn.end();

            // Establish MySQL connection pool on the target database
            pool = mysql.createPool({
                host: dbConfig.host,
                port: dbConfig.port,
                user: dbConfig.user,
                password: dbConfig.password,
                database: dbConfig.database,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            });
        }

        // --- STEP 2: TEST FULL CONNECTION & SETUP TABLES ---
        await query('SELECT 1');
        console.log(`Connected to target database '${dbConfig.database}' successfully.`);
        await setupTables();

    } catch (err) {
        console.error('\n======================================================================');
        console.error('CRITICAL DATABASE CONNECTION ERROR:');
        console.error('======================================================================');
        console.error(err.message);
        console.error('\n======================================================================\n');
    }
}

// Unified query wrapper supporting both mysql2 and pg
async function query(sql, params = []) {
    let formattedSql = sql;
    
    // Adapt SQL query placeholders if database is PostgreSQL
    if (dbType === 'postgres' || dbType === 'postgresql') {
        let paramIndex = 1;
        formattedSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    }

    if (dbType === 'postgres' || dbType === 'postgresql') {
        const res = await pool.query(formattedSql, params);
        return res.rows;
    } else {
        const [rows] = await pool.query(formattedSql, params);
        return rows;
    }
}

// 2. AUTO TABLE SCHEMAS AND SEEDING
async function setupTables() {
    console.log('Verifying table schemas...');
    
    // Create Products Table with stock and discount columns if not exists (Removed 'origin' column)
    await query(`
        CREATE TABLE IF NOT EXISTS products (
            id INT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            price INT NOT NULL,
            unit VARCHAR(50) NOT NULL,
            tag VARCHAR(255) NOT NULL,
            cat VARCHAR(100) NOT NULL,
            img VARCHAR(255) NOT NULL,
            description TEXT,
            stock INT DEFAULT 0,
            discount_percent INT DEFAULT 0
        )
    `);

    // Ensure stock column exists if table was created previously without it
    try {
        if (dbType === 'postgres' || dbType === 'postgresql') {
            await query('ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INT DEFAULT 0');
        } else {
            await query('ALTER TABLE products ADD COLUMN stock INT DEFAULT 0');
        }
        console.log("Verified: 'stock' column is present.");
    } catch (err) {
        // Safe to ignore if column already exists in other DB setups
    }

    // Ensure discount_percent column exists if table was created previously without it
    try {
        if (dbType === 'postgres' || dbType === 'postgresql') {
            await query('ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_percent INT DEFAULT 0');
        } else {
            await query('ALTER TABLE products ADD COLUMN discount_percent INT DEFAULT 0');
        }
        console.log("Verified: 'discount_percent' column is present.");
    } catch (err) {
        // Safe to ignore if column already exists in other DB setups
    }

    // Create Orders Table (Syntax adapts based on DB Type)
    if (dbType === 'postgres' || dbType === 'postgresql') {
        await query(`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                cust_name VARCHAR(255) NOT NULL,
                cust_address TEXT NOT NULL,
                items TEXT NOT NULL,
                total_price INT NOT NULL,
                status VARCHAR(50) DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                shop_name VARCHAR(255) NOT NULL,
                address TEXT NOT NULL,
                account_type VARCHAR(50) DEFAULT 'Business',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await query(`
            CREATE TABLE IF NOT EXISTS otp_verifications (
                email VARCHAR(255) PRIMARY KEY,
                otp_code VARCHAR(6) NOT NULL,
                expires_at TIMESTAMP NOT NULL
            )
        `);
    } else {
        await query(`
            CREATE TABLE IF NOT EXISTS orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                cust_name VARCHAR(255) NOT NULL,
                cust_address TEXT NOT NULL,
                items TEXT NOT NULL,
                total_price INT NOT NULL,
                status VARCHAR(50) DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                shop_name VARCHAR(255) NOT NULL,
                address TEXT NOT NULL,
                account_type VARCHAR(50) DEFAULT 'Business',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await query(`
            CREATE TABLE IF NOT EXISTS otp_verifications (
                email VARCHAR(255) PRIMARY KEY,
                otp_code VARCHAR(6) NOT NULL,
                expires_at TIMESTAMP NOT NULL
            )
        `);
    }

    // Ensure status column exists in orders table (migration)
    try {
        if (dbType === 'postgres' || dbType === 'postgresql') {
            await query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Pending'");
        } else {
            await query("ALTER TABLE orders ADD COLUMN status VARCHAR(50) DEFAULT 'Pending'");
        }
        console.log("Verified: 'status' column is present in orders.");
    } catch (err) {
        // Safe to ignore if column already exists
    }

    // Ensure account_type column exists in users table (migration)
    try {
        if (dbType === 'postgres' || dbType === 'postgresql') {
            await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR(50) DEFAULT 'Business'");
        } else {
            await query("ALTER TABLE users ADD COLUMN account_type VARCHAR(50) DEFAULT 'Business'");
        }
        console.log("Verified: 'account_type' column is present in users.");
    } catch (err) {
        // Safe to ignore if column already exists
    }

    // Sync product details and catalog on startup
    console.log('Syncing product details and catalog...');
    await seedProducts();
}

async function seedProducts() {
    // Delete all existing cashews to ensure we only have the new cashew list
    try {
        await query("DELETE FROM products WHERE cat = 'Cashew'");
        console.log("Cleared existing cashews from database for fresh sync.");
    } catch (err) {
        console.error("Error clearing existing cashews:", err);
    }

    const seedList = [
        // --- CATEGORY: CASHEWS ---
        { id: 1, name: "Split Cashew (Grade 52)", price: 1190, unit: "kg", tag: "Premium Splits", cat: "Cashew", img: "pics/products/split_cashew.jpg", desc: "Premium quality split cashew nuts, grade 52, perfect for culinary and snacking use." },
        { id: 2, name: "Fresh Cashew (Grade W240)", price: 735, unit: "500g", tag: "Fresh Grade W240", cat: "Cashew", img: "pics/products/cashew-2.jpg", desc: "Fresh whole cashew nuts of premium W240 grade, carefully packed in 500g packs." },
        { id: 3, name: "Cashew (Grade W320 - 250g)", price: 350, unit: "250g", tag: "Grade W320", cat: "Cashew", img: "pics/products/w320_250g.jpg", desc: "Premium whole cashew nuts, grade W320, packed in a 250g bag." },
        { id: 4, name: "Cashew (Grade W320 - 500g)", price: 700, unit: "500g", tag: "Grade W320", cat: "Cashew", img: "pics/products/w320_500g.jpg", desc: "Premium whole cashew nuts, grade W320, packed in a 500g bag." },
        { id: 40, name: "Cashew Gold Nuggets", price: 377, unit: "250g", tag: "Gold Nuggets", cat: "Cashew", img: "pics/products/cgold.jpg", desc: "Golden-white premium cashews, rich in flavor and quality." },
        { id: 41, name: "Cashew Roasted & Salted", price: 425, unit: "250g", tag: "Roasted & Salted", cat: "Cashew", img: "pics/products/croast.jpg", desc: "Delicious dry-roasted cashews, lightly salted for a perfect crunchy taste." },
        { id: 42, name: "Broken Cashew (Grade BB)", price: 910, unit: "kg", tag: "Grade BB", cat: "Cashew", img: "pics/products/broken_cashew_BB.jpg", desc: "Broken cashew nuts, grade BB, ideal for confectionery and baking." },

        // --- CATEGORY: DRY FRUITS & SEEDS ---
        { id: 5, name: "Dried Amla (1st Grade)", price: 130, unit: "250g", tag: "100% Natural", cat: "Dry Fruits", img: "pics/products/driedamla.jpg", desc: "Sun-dried gooseberries rich in Vitamin C, processed without artificial sweeteners." },
        { id: 6, name: "Premium Imported Badam", price: 220, unit: "150g", tag: "Premium Quality", cat: "Dry Fruits", img: "pics/products/badam.jpg", desc: "Crispy, nutritious imported almonds packed with protein and dietary fiber." },
        { id: 7, name: "Premium Quality Pista", price: 280, unit: "125g", tag: "Imported Shells", cat: "Dry Fruits", img: "pics/products/pista.jpg", desc: "Naturally opened, salted premium pistachios with delicious, nutty kernel flavor." },
        { id: 8, name: "Bazana California Pistachios", price: 1120, unit: "kg", tag: "Branded Pack", cat: "Dry Fruits", img: "pics/products/bazana.jpg", desc: "Branded premium roasted pistachios in clean bulk wholesale pack." },
        { id: 9, name: "Premium Walnut Kernels", price: 890, unit: "kg", tag: "Imported", cat: "Dry Fruits", img: "pics/products/walnutkernals.jpg", desc: "Raw, light-colored halved walnut kernels, ideal for brain health and heart nutrition." },
        { id: 10, name: "Imported Selection Dates", price: 230, unit: "400g", tag: "Premium Quality", cat: "Dry Fruits", img: "pics/products/d.jpeg", desc: "Soft, sweet, and sticky dates full of natural sugars and immediate energy." },
        { id: 11, name: "Mixed Premium Dry Fruits (150g)", price: 230, unit: "150g", tag: "Energy Mix", cat: "Dry Fruits", img: "pics/products/mdryfruit.jpg", desc: "Nutritious cocktail of almonds, cashews, raisins, and dried berries." },
        { id: 49, name: "Mixed Premium Dry Fruits (400g)", price: 599, unit: "400g", tag: "Premium Gift Pack", cat: "Dry Fruits", img: "pics/products/mixed-dry-fruits-rect.jpg", desc: "A premium rectangular partition tray filled with high-grade almonds, cashews, pistachios, dates, dried kiwi slices, and dried mango slices." },
        { id: 50, name: "Mixed Premium Dry Fruits (Hexagonal Box)", price: 749, unit: "box", tag: "Hexagonal Gift Box", cat: "Dry Fruits", img: "pics/products/mixed-dry-fruits-hex.jpg", desc: "A luxury hexagonal partition tray containing premium cashews, almonds, pistachios, and dried kiwi slices." },
        { id: 12, name: "Dried Kiwi Premium Slices", price: 130, unit: "150g", tag: "Sweet & Tangy", cat: "Dry Fruits", img: "pics/products/dried-kiwi.jpg", desc: "Tangy dried kiwi green slices with fine sugar dusting." },
        { id: 37, name: "Honey Amla Slices", price: 130, unit: "250g", tag: "Sweetened Amla", cat: "Dry Fruits", img: "pics/products/driedamla.jpg", desc: "Amla gooseberry slices soaked in pure forest honey, rich in immunity." },
        { id: 13, name: "Premium Pumpkin Seeds", price: 140, unit: "250g", tag: "Premium Quality", cat: "Dry Fruits", img: "pics/products/pkseed.jpg", desc: "Raw, unsalted premium pumpkin kernels rich in zinc and magnesium." },
        { id: 14, name: "Imported Sunflower Seeds", price: 130, unit: "250g", tag: "Premium Quality", cat: "Dry Fruits", img: "pics/products/sflower.jpg", desc: "Shelled organic sunflower seeds, high in Vitamin E and antioxidants." },
        { id: 15, name: "Premium Flax Seeds", price: 130, unit: "250g", tag: "Omega-3 Rich", cat: "Dry Fruits", img: "pics/products/flax-seeds.jpg", desc: "Whole brown flax seeds, ideal for heart health and rich in dietary fibers." },
        { id: 16, name: "Natural Basil Seeds", price: 130, unit: "250g", tag: "Cooling Quality", cat: "Dry Fruits", img: "pics/products/basil-seeds.jpg", desc: "Sweet basil seeds (Sabja) that gelatinize in water, excellent body coolant." },
        { id: 17, name: "Chia Seeds Premium Whole", price: 125, unit: "250g", tag: "Premium Quality", cat: "Dry Fruits", img: "pics/products/chia-seeds.jpg", desc: "Black organic chia seeds, high in calcium, omega-3, and hydration retention." },
        { id: 33, name: "Honey Mix Dry Fruits", price: 399, unit: "450g", tag: "Nuts Infused", cat: "Dry Fruits", img: "pics/products/honey-mix.jpg", desc: "Assorted premium nuts and seeds suspended in raw wild forest honey." },

        // --- CATEGORY: OATS & MILLETS ---
        { id: 18, name: "Nutri White Oats (Dr. Food)", price: 180, unit: "kg", tag: "Premium Quality", cat: "Oats & Millets", img: "pics/products/whiteo.jpg", desc: "Instant white rolled oats for a heart-healthy, quick breakfast." },
        { id: 19, name: "Nutri Multigrain Oats (Dr. Food)", price: 220, unit: "kg", tag: "Fiber Rich", cat: "Oats & Millets", img: "pics/products/mgrainoats.jpg", desc: "Multigrain oats blended with barley, ragi, and wheat flakes." },
        { id: 20, name: "Premium Little Millet (Chama)", price: 110, unit: "500g", tag: "Organic Grain", cat: "Oats & Millets", img: "pics/products/lmillet.jpg", desc: "Organic little millet (Chama), gluten-free grain rich in iron." },
        { id: 45, name: "Proso Millet Premium Grain", price: 110, unit: "500g", tag: "Traditional Grain", cat: "Oats & Millets", img: "pics/products/proso-millet.jpg", desc: "Traditional proso millet grain, rich in dietary fiber and lecithin." },
        { id: 46, name: "Kodo Millet Premium Grain", price: 110, unit: "500g", tag: "Traditional Grain", cat: "Oats & Millets", img: "pics/products/kodo-millet.jpg", desc: "High antioxidant Kodo millet grain, perfect substitute for white rice." },
        { id: 21, name: "Mixed Millet Premium Flakes", price: 140, unit: "400g", tag: "Healthy Breakfast", cat: "Oats & Millets", img: "pics/products/millet-flakes.jpg", desc: "Crispy breakfast flakes made from multi-millet grains (ragi, jowar, bajra)." },
        { id: 22, name: "Nutri DiaPlus Oats", price: 236, unit: "400g", tag: "Instant Mix", cat: "Oats & Millets", img: "pics/products/oatmeal-box.jpg", desc: "Dia Plus diabetic-friendly oat meal mix with natural wheat fibers." },
        { id: 23, name: "Nutri Steel Cut Oats", price: 293, unit: "kg", tag: "Whole Grain", cat: "Oats & Millets", img: "pics/products/steel-cut-oats.jpg", desc: "High fiber steel-cut oat kernels, chewy texture and slow-burning energy." },
        { id: 24, name: "Foxtail Millet Premium Grain", price: 115, unit: "500g", tag: "Traditional Grain", cat: "Oats & Millets", img: "pics/products/foxtail-millet.jpg", desc: "Foxtail millet grain (Navane) ideal for blood sugar management." },

        // --- CATEGORY: SNACKS & BREAKFAST ---
        { id: 25, name: "Mixed Vacuum Vegetable Chips", price: 480, unit: "kg", tag: "Premium Quality", cat: "Snacks & Breakfast", img: "pics/products/dry-veg.jpg", desc: "Vacuum fried crispy sweet potato, banana, okra, and carrot chips, low oil." },
        { id: 26, name: "Premium Roasted Jackfruit Chips", price: 250, unit: "250g", tag: "Kerala Special", cat: "Snacks & Breakfast", img: "pics/products/jackfruit-chips.jpg", desc: "Authentic Kerala Jackfruit chips roasted crispy in pure wood-pressed coconut oil." },
        { id: 27, name: "Premium Wheat Flakes", price: 100, unit: "350g", tag: "Crispy Whole", cat: "Snacks & Breakfast", img: "pics/products/wheat-flakes.jpg", desc: "Toasted whole wheat breakfast flakes, high fiber and low fat." },
        { id: 28, name: "Maize (Corn) Puttupodi Premium", price: 80, unit: "500g", tag: "Breakfast Special", cat: "Snacks & Breakfast", img: "pics/products/corn-puttu.jpg", desc: "Finely ground premium maize powder for yellow steam corn puttu." },
        { id: 29, name: "Premium Maize Rava Podi", price: 80, unit: "500g", tag: "Fine Textured", cat: "Snacks & Breakfast", img: "pics/products/corn-rava.jpg", desc: "Granulated corn semolina (Rava) for yellow upma or porridge." },
        { id: 30, name: "Traditional Ragi Semiya Pack", price: 85, unit: "500g", tag: "High Calcium", cat: "Snacks & Breakfast", img: "pics/products/ragi-semiya.jpg", desc: "Finger millet (Ragi) vermicelli pack, loaded with natural calcium." },
        { id: 31, name: "Hakka Noodles", price: 99, unit: "450g", tag: "100% Vegetarian", cat: "Snacks & Breakfast", img: "pics/products/hakka.jpg", desc: "Non-sticky, quick cooking vegetarian wheat noodles, perfect for stir fries." },
        { id: 38, name: "Premium Carrot Semiya", price: 90, unit: "400g", tag: "Carrot Infused", cat: "Snacks & Breakfast", img: "pics/products/carrot-semiya.jpg", desc: "Delicious vermicelli noodles infused with real carrot extract for vitamins." },
        { id: 43, name: "C.S. Karipatty ", price: 95, unit: "400g", tag: "karipatty", cat: "Snacks & Breakfast", img: "pics/products/karipatty.jpg", desc: "Premium grade rice powder for making soft traditional Puttu and Appam." },
        { id: 44, name: "Ragi aval", price: 110, unit: "400g", tag: "aval flakes", cat: "Snacks & Breakfast", img: "pics/products/ragiaval.jpg", desc: "Sprouted ragi malt powder enriched with traditional grains for infant health." },
        { id: 47, name: "Dried-kappa", price: 90, unit: "pack", tag: "Kerala Fried", cat: "Snacks & Breakfast", img: "pics/products/dried-kappa.jpg", desc: "Hand-sliced local tapioca chips fried golden in pure wood-pressed coconut oil." },
        { id: 48, name: "Dried Jackfruits (Chakka Slices)", price: 450, unit: "500g", tag: "Sun-dried Pack", cat: "Snacks & Breakfast", img: "pics/products/dried-jackfruit.jpg", desc: "Dehydrated chewy yellow jackfruit slices (Dried Jackfruits) in a clean transparent vacuum-sealed bag." },
        { id: 35, name: "Premium Wheat Semiya", price: 85, unit: "500g", tag: "Pure Wheat", cat: "Snacks & Breakfast", img: "pics/products/wheat-semiya.jpg", desc: "Thin roasted wheat vermicelli, perfect for traditional upma and sweet desserts." },
        { id: 36, name: "Nutri Nendran Banana Powder", price: 249, unit: "200g", tag: "Pure Baby Food", cat: "Snacks & Breakfast", img: "pics/products/nendran.jpg", desc: "Traditional baby food made from dehydrated raw green plantain slices." },

        // --- CATEGORY: SPICES & PASTES ---
        { id: 32, name: "Bakers Ginger Garlic Paste", price: 130, unit: "kg", tag: "Commercial Bulk", cat: "Spices", img: "pics/products/ggpaste.jpg", desc: "Commercial grade ginger-garlic paste for restaurants and bulk cooking." },
        { id: 34, name: "Palm Candy Special (Panakalkandam)", price: 140, unit: "250g", tag: "Traditional Pure", cat: "Spices", img: "pics/products/palm-candy.jpg", desc: "Unrefined palm sugar candy, traditional throat soother and sweetener." },
        { id: 39, name: "Premium Arrowroot Powder", price: 600, unit: "500g", tag: "100% Organic", cat: "Spices", img: "pics/products/arrowroot.jpg", desc: "Pure organic arrowroot starch powder (Koova Podi), highly cooling for stomach." },
        { id: 51, name: "Chukku Kappi (Dry Ginger Coffee)", price: 90, unit: "150g", tag: "Traditional Herbal", cat: "Spices", img: "pics/products/chukku-kappi.jpg", desc: "Dry ginger black coffee powder blended with black pepper, cumin, and basil." }
    ];

    for (const p of seedList) {
        const existing = await query('SELECT id FROM products WHERE id = ?', [p.id]);
        if (existing.length > 0) {
            // Update details (keep stock as it is!)
            await query(
                'UPDATE products SET name = ?, price = ?, unit = ?, tag = ?, cat = ?, img = ?, description = ? WHERE id = ?',
                [p.name, p.price, p.unit, p.tag, p.cat, p.img, p.desc, p.id]
            );
        } else {
            // Insert new product
            await query(
                'INSERT INTO products (id, name, price, unit, tag, cat, img, description, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 50)',
                [p.id, p.name, p.price, p.unit, p.tag, p.cat, p.img, p.desc]
            );
        }
    }
    console.log('Seeding and updating completed successfully!');
}

// 3. API ROUTING
// GET ALL PRODUCTS
app.get('/api/products', async (req, res) => {
    try {
        const products = await query(`
            SELECT * FROM products 
            ORDER BY 
                (CASE WHEN stock > 0 THEN 0 ELSE 1 END) ASC,
                (CASE cat 
                    WHEN 'Cashew' THEN 1 
                    WHEN 'Dry Fruits' THEN 2 
                    WHEN 'Oats & Millets' THEN 3 
                    WHEN 'Snacks & Breakfast' THEN 4 
                    WHEN 'Spices' THEN 5 
                    ELSE 6 
                END) ASC,
                id ASC
        `);
        res.json(products);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error fetching products' });
    }
});

// GET SINGLE PRODUCT (For Quick-View detail)
app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await query('SELECT * FROM products WHERE id = ?', [req.params.id]);
        if (product.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(product[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error fetching product details' });
    }
});

// --- USER AUTHENTICATION MIDDLEWARE ---
function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized: Authentication token required' });
    }
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    const jwtSecret = process.env.JWT_SECRET || 'wellshine_jwt_secret_key';
    try {
        const decoded = jwt.verify(token, jwtSecret);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
}

// POST SUBMIT ORDER (Requires user login, stock is deducted later by admin)
app.post('/api/orders', requireAuth, async (req, res) => {
    const { cust_name, cust_address, items, total_price } = req.body;
    if (!cust_name || !cust_address || !items || !total_price) {
        return res.status(400).json({ error: 'Missing required checkout parameters' });
    }

    try {
        // 1. Insert order to DB with 'Pending' status
        await query(
            "INSERT INTO orders (cust_name, cust_address, items, total_price, status) VALUES (?, ?, ?, ?, 'Pending')",
            [cust_name, cust_address, JSON.stringify(items), total_price]
        );

        res.status(201).json({ success: true, message: 'Order logged successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error saving wholesale order' });
    }
});

// --- USER AUTHENTICATION ENDPOINTS ---

// Verification email sender helper
async function sendVerificationEmail(email, otpCode) {
    const resendApiKey = process.env.RESEND_API_KEY;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');

    console.log('\n=============================================================');
    console.log(`[VERIFICATION CODE] Sent OTP: ${otpCode} to ${email}`);
    console.log('=============================================================\n');

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #d4af37; border-radius: 10px; background: #0c0c0c; color: #fff;">
            <h2 style="color: #d4af37; border-bottom: 1px solid #d4af37; padding-bottom: 10px;">Wellshine Distributors</h2>
            <p>Thank you for registering a wholesale account with us. To verify your email address, please enter the following 6-digit OTP code on the signup screen:</p>
            <div style="background: #1a1a1a; border: 1px solid #d4af37; border-radius: 5px; padding: 15px; font-size: 1.8rem; font-weight: bold; letter-spacing: 5px; text-align: center; margin: 20px 0; color: #d4af37;">
                ${otpCode}
            </div>
            <p style="font-size: 0.85rem; color: #aaa;">This code will expire in 5 minutes. If you did not request this code, you can safely ignore this email.</p>
        </div>
    `;

    if (resendApiKey) {
        // Use Resend HTTP API (works on Render free tier because it uses port 443/HTTPS)
        try {
            const https = require('https');
            const data = JSON.stringify({
                from: 'Wellshine Distributors <onboarding@resend.dev>',
                to: email,
                subject: 'Verify Your Wholesale Account - OTP Code',
                html: htmlContent
            });

            const options = {
                hostname: 'api.resend.com',
                port: 443,
                path: '/emails',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${resendApiKey}`,
                    'Content-Length': Buffer.byteLength(data)
                }
            };

            const req = https.request(options, (res) => {
                let responseBody = '';
                res.on('data', (chunk) => { responseBody += chunk; });
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        console.log(`Email successfully delivered via Resend HTTP API to ${email}`);
                    } else {
                        console.error(`Resend API error: Status ${res.statusCode}, Response: ${responseBody}`);
                    }
                });
            });

            req.on('error', (e) => {
                console.error(`Resend request error sending to ${email}:`, e.message);
            });

            req.write(data);
            req.end();
        } catch (err) {
            console.error(`Resend configuration error sending to ${email}:`, err.message);
        }
    } else if (smtpUser && smtpPass) {
        // Fallback to traditional SMTP
        try {
            // Resolve hostname to IPv4 address to bypass Render's IPv6 outbound limitations
            let targetHost = smtpHost;
            if (/[a-zA-Z]/.test(smtpHost)) {
                try {
                    const dnsPromises = require('dns').promises;
                    const addresses = await dnsPromises.resolve4(smtpHost);
                    if (addresses.length > 0) {
                        targetHost = addresses[0];
                        console.log(`Resolved ${smtpHost} to IPv4: ${targetHost}`);
                    }
                } catch (dnsErr) {
                    console.error(`DNS resolve4 failed for ${smtpHost}, falling back to hostname:`, dnsErr.message);
                }
            }

            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
                host: targetHost,
                port: smtpPort,
                secure: smtpPort === 465,
                tls: {
                    servername: smtpHost // Required for SSL certificate check when using an IP address
                },
                auth: {
                    user: smtpUser,
                    pass: smtpPass
                }
            });

            const mailOptions = {
                from: `"Wellshine Distributors" <${smtpUser}>`,
                to: email,
                subject: 'Verify Your Wholesale Account - OTP Code',
                html: htmlContent
            };

            await transporter.sendMail(mailOptions);
            console.log(`Email successfully delivered via SMTP to ${email}`);
        } catch (err) {
            console.error(`Nodemailer error sending to ${email}:`, err.message);
        }
    } else {
        console.log(`(SMTP_USER and RESEND_API_KEY not configured. Running in console-only mock mode.)`);
    }
}

// POST REQUEST OTP
app.post('/api/auth/send-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Missing email address' });
    }

    try {
        const cleanEmail = email.trim().toLowerCase();
        
        // 1. Check if user already exists
        const existing = await query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'An account with this email already exists' });
        }

        // 2. Generate random 6-digit code
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

        // 3. Save to otp_verifications (Insert or Replace)
        const active = await query('SELECT email FROM otp_verifications WHERE email = ?', [cleanEmail]);
        if (active.length > 0) {
            await query('UPDATE otp_verifications SET otp_code = ?, expires_at = ? WHERE email = ?', [otpCode, expiresAt, cleanEmail]);
        } else {
            await query('INSERT INTO otp_verifications (email, otp_code, expires_at) VALUES (?, ?, ?)', [cleanEmail, otpCode, expiresAt]);
        }

        // 4. Send the verification code (asynchronously in background for instant response)
        sendVerificationEmail(cleanEmail, otpCode);

        res.json({ success: true, message: 'Verification OTP sent successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error sending OTP' });
    }
});

// POST USER SIGNUP
app.post('/api/auth/register', async (req, res) => {
    const { email, password, shop_name, address, account_type } = req.body;
    if (!email || !password || !shop_name || !address) {
        return res.status(400).json({ error: 'Missing required registration parameters' });
    }
    const finalAccountType = account_type === 'Individual' ? 'Individual' : 'Business';
    const cleanEmail = email.trim().toLowerCase();

    try {
        // 1. Check if user already exists
        const existing = await query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'An account with this email already exists' });
        }

        // 2. Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // 4. Insert user into database
        await query(
            'INSERT INTO users (email, password_hash, shop_name, address, account_type) VALUES (?, ?, ?, ?, ?)',
            [cleanEmail, passwordHash, shop_name.trim(), address.trim(), finalAccountType]
        );

        // 5. Clean up OTP record
        await query('DELETE FROM otp_verifications WHERE email = ?', [cleanEmail]);

        res.status(201).json({ success: true, message: 'User account created successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error creating user account' });
    }
});

// POST USER LOGIN
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Missing email or password' });
    }

    try {
        // Find user by email
        const users = await query('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = users[0];

        // Compare password hash
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate JWT Token
        const jwtSecret = process.env.JWT_SECRET || 'wellshine_jwt_secret_key';
        const token = jwt.sign(
            { id: user.id, email: user.email },
            jwtSecret,
            { expiresIn: '7d' } // Token lasts 7 days
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                shop_name: user.shop_name,
                address: user.address,
                account_type: user.account_type
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error during user login' });
    }
});

// GET CURRENT USER PROFILE
app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
        const users = await query('SELECT id, email, shop_name, address, account_type FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'User profile not found' });
        }
        res.json(users[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error fetching user profile' });
    }
});

// --- ADMIN ENDPOINTS & AUTH MIDDLEWARE ---
function requireAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    const adminPass = process.env.ADMIN_PASSWORD || 'wellshine_admin';
    if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized: Passcode required' });
    }
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    if (token === adminPass) {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden: Invalid passcode' });
    }
}

// POST ADMIN LOGIN
app.post('/api/admin/login', (req, res) => {
    const { passcode } = req.body;
    const adminPass = process.env.ADMIN_PASSWORD || 'wellshine_admin';
    if (passcode === adminPass) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid passcode' });
    }
});

// GET ADMIN ORDERS
app.get('/api/admin/orders', requireAdmin, async (req, res) => {
    try {
        const orders = await query('SELECT * FROM orders ORDER BY created_at DESC');
        const parsedOrders = orders.map(o => {
            if (typeof o.items === 'string') {
                try {
                    o.items = JSON.parse(o.items);
                } catch (e) {
                    // leave as string
                }
            }
            return o;
        });
        res.json(parsedOrders);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error fetching admin orders' });
    }
});

// DELETE ADMIN ORDER
app.post('/api/admin/orders/delete', requireAdmin, async (req, res) => {
    const { orderId } = req.body;
    if (!orderId) {
        return res.status(400).json({ error: 'Missing orderId' });
    }
    try {
        const parsedOrderId = parseInt(orderId);
        // Fetch order to check status
        const orders = await query('SELECT * FROM orders WHERE id = ?', [parsedOrderId]);
        if (orders.length > 0) {
            const order = orders[0];
            // If the order was already confirmed, restore the stock
            if (order.status === 'Confirmed') {
                let items = order.items;
                if (typeof items === 'string') {
                    try {
                        items = JSON.parse(items);
                    } catch (e) {
                        // ignore
                    }
                }
                if (Array.isArray(items)) {
                    for (const item of items) {
                        if (item.id && item.quantity) {
                            await query(
                                'UPDATE products SET stock = stock + ? WHERE id = ?',
                                [parseInt(item.quantity), parseInt(item.id)]
                            );
                        }
                    }
                }
            }
        }
        await query('DELETE FROM orders WHERE id = ?', [parsedOrderId]);
        res.json({ success: true, message: 'Order deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error deleting order' });
    }
});

// CONFIRM ADMIN ORDER AND DEDUCT STOCK
app.post('/api/admin/orders/confirm', requireAdmin, async (req, res) => {
    const { orderId } = req.body;
    if (!orderId) {
        return res.status(400).json({ error: 'Missing orderId' });
    }
    try {
        const parsedOrderId = parseInt(orderId);
        // Fetch order details
        const orders = await query('SELECT * FROM orders WHERE id = ?', [parsedOrderId]);
        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        const order = orders[0];
        
        if (order.status === 'Confirmed') {
            return res.status(400).json({ error: 'Order has already been confirmed' });
        }
        
        // Parse items
        let items = order.items;
        if (typeof items === 'string') {
            try {
                items = JSON.parse(items);
            } catch (e) {
                return res.status(400).json({ error: 'Failed to parse order items' });
            }
        }
        
        // Deduct stock for each item in the order
        if (Array.isArray(items)) {
            for (const item of items) {
                if (item.id && item.quantity) {
                    await query(
                        'UPDATE products SET stock = GREATEST(0, stock - ?) WHERE id = ?',
                        [parseInt(item.quantity), parseInt(item.id)]
                    );
                }
            }
        }
        
        // Update order status to Confirmed
        await query("UPDATE orders SET status = 'Confirmed' WHERE id = ?", [parsedOrderId]);
        res.json({ success: true, message: 'Order confirmed and stock levels updated successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error confirming order' });
    }
});

// UPDATE PRODUCT DETAILS (Name, price, category, unit, tag, img, description, discount_percent)
app.post('/api/admin/products/update', requireAdmin, async (req, res) => {
    const { productId, name, price, unit, tag, cat, img, description, stock, discount_percent } = req.body;
    if (productId === undefined) {
        return res.status(400).json({ error: 'Missing productId' });
    }
    try {
        const parsedId = parseInt(productId);
        const fields = [];
        const params = [];

        if (name !== undefined) { fields.push('name = ?'); params.push(name); }
        if (price !== undefined) { fields.push('price = ?'); params.push(parseInt(price)); }
        if (unit !== undefined) { fields.push('unit = ?'); params.push(unit); }
        if (tag !== undefined) { fields.push('tag = ?'); params.push(tag); }
        if (cat !== undefined) { fields.push('cat = ?'); params.push(cat); }
        if (img !== undefined) { fields.push('img = ?'); params.push(img); }
        if (description !== undefined) { fields.push('description = ?'); params.push(description); }
        if (stock !== undefined) { fields.push('stock = ?'); params.push(parseInt(stock)); }
        if (discount_percent !== undefined) { fields.push('discount_percent = ?'); params.push(parseInt(discount_percent)); }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        params.push(parsedId);
        const updateQuery = `UPDATE products SET ${fields.join(', ')} WHERE id = ?`;
        await query(updateQuery, params);

        res.json({ success: true, message: 'Product updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error updating product details' });
    }
});

// UPDATE SINGLE PRODUCT STOCK
app.post('/api/admin/products/update-stock', requireAdmin, async (req, res) => {
    const { productId, stock } = req.body;
    if (productId === undefined || stock === undefined) {
        return res.status(400).json({ error: 'Missing productId or stock' });
    }
    try {
        await query('UPDATE products SET stock = ? WHERE id = ?', [parseInt(stock), parseInt(productId)]);
        res.json({ success: true, message: 'Stock updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error updating stock' });
    }
});

// BULK SYNC PRODUCT STOCK (Vyapar integration helper)
app.post('/api/admin/products/bulk-sync', requireAdmin, async (req, res) => {
    const { updates } = req.body; // Array of { id, name, stock }
    if (!Array.isArray(updates)) {
        return res.status(400).json({ error: 'Updates must be an array' });
    }
    try {
        let updatedCount = 0;
        for (const item of updates) {
            if (item.stock === undefined || isNaN(parseInt(item.stock))) continue;
            const newStock = parseInt(item.stock);
            
            if (item.id !== undefined && !isNaN(parseInt(item.id))) {
                await query('UPDATE products SET stock = ? WHERE id = ?', [newStock, parseInt(item.id)]);
                updatedCount++;
            } else if (item.name) {
                // Try direct match
                let cleanName = item.name.trim();
                await query('UPDATE products SET stock = ? WHERE name = ?', [newStock, cleanName]);
                updatedCount++;
            }
        }
        res.json({ success: true, message: `Successfully updated stock for ${updatedCount} items.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error during bulk stock sync' });
    }
});

// GET ALL REGISTERED USERS (For Admin Dashboard)
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const users = await query('SELECT id, email, shop_name, address, created_at, account_type FROM users ORDER BY created_at DESC');
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error fetching registered users' });
    }
});

// Fallback index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start initialization
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`=============================================================`);
        console.log(`Wellshine Wholesale Backend running on http://localhost:${PORT}`);
        console.log(`=============================================================`);
    });
});
