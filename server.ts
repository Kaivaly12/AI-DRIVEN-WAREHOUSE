
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import chokidar from 'chokidar';
import cors from 'cors';
import multer from 'multer';

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3000;
const EXCEL_FILE_PATH = path.resolve(process.cwd(), 'data/inventory.xlsx');
const DATA_DIR = path.resolve(process.cwd(), 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, DATA_DIR)
    },
    filename: function (req, file, cb) {
        cb(null, 'inventory.xlsx') // Always overwrite the watched file
    }
})
const upload = multer({ storage: storage })

// Create sample Excel file if it doesn't exist
if (!fs.existsSync(EXCEL_FILE_PATH)) {
    const wb = XLSX.utils.book_new();
    const ws_data = [
        ["id", "name", "category", "quantity", "price", "supplier", "dateAdded"],
        ["PID-001", "Quantum Processor", "Electronics", 120, 250.00, "SynthCore", "2023-10-15"],
        ["PID-002", "Hydrogel Packs", "Medical", 45, 30.50, "BioGen", "2023-11-02"],
        ["PID-003", "Carbon Nanotubes", "Materials", 0, 1200.00, "NanoWorks", "2023-09-20"],
        ["PID-004", "Ionic Power Cells", "Energy", 200, 150.75, "Voltacorp", "2023-11-10"],
        ["PID-005", "Data Crystal Shards", "Electronics", 500, 75.00, "SynthCore", "2023-08-01"],
        ["PID-006", "Auto-Suture Kits", "Medical", 15, 55.20, "BioGen", "2023-11-18"],
        ["PID-007", "Graphene Sheets", "Materials", 300, 800.00, "NanoWorks", "2023-10-05"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(EXCEL_FILE_PATH, buffer);
    console.log('Sample Excel file created at:', EXCEL_FILE_PATH);
}

async function startServer() {
    const app = express();
    const httpServer = createServer(app);
    const io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    app.use(cors());
    app.use(express.json());

    // --- REAL-TIME SYNC LOGIC (DATABASE ALTERNATIVE) ---
    /*
    // Example for MongoDB Change Streams:
    const collection = db.collection('products');
    const changeStream = collection.watch();
    changeStream.on('change', (next) => {
        console.log('Database change detected:', next);
        const updatedData = await collection.find({}).toArray();
        io.emit('inventory_update', updatedData);
    });

    // Example for MySQL (using mysql-events or similar):
    const MySQLEvents = require('mysql-events');
    const dsn = { host: 'localhost', user: 'root', password: 'password' };
    const mysqlEventWatcher = MySQLEvents(dsn);
    mysqlEventWatcher.add('my_database.products', (oldRow, newRow, event) => {
        console.log('MySQL change detected');
        // Fetch all and emit
        io.emit('inventory_update', await fetchAllProducts());
    });
    */

    // --- REAL-TIME SYNC LOGIC (EXCEL) ---
    
    const readExcelData = () => {
        try {
            if (!fs.existsSync(EXCEL_FILE_PATH)) return [];
            const fileBuffer = fs.readFileSync(EXCEL_FILE_PATH);
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet);
            console.log(`[Excel] Read ${data.length} rows from ${sheetName}`);
            if (data.length > 0) {
                console.log('[Excel] Sample Row:', JSON.stringify(data[0]));
            }
            return data;
        } catch (error) {
            console.error('Error reading Excel file:', error);
            return [];
        }
    };

    // Watch for changes in the Excel file with polling enabled for better reliability
    const watcher = chokidar.watch(EXCEL_FILE_PATH, {
        persistent: true,
        ignoreInitial: false,
        usePolling: true, // Crucial for many dev environments
        interval: 100,    // Check every 100ms
    });

    watcher.on('change', (filePath) => {
        console.log(`[Watcher] File ${filePath} changed. Reading new data...`);
        const updatedData = readExcelData();
        console.log(`[Watcher] Emitting update with ${updatedData.length} items.`);
        io.emit('inventory_update', updatedData);
    });

    // --- API ROUTES ---

    app.get('/api/inventory', (req, res) => {
        const data = readExcelData();
        res.json(data);
    });

    app.get('/api/download-template', (req, res) => {
        if (fs.existsSync(EXCEL_FILE_PATH)) {
            res.download(EXCEL_FILE_PATH, 'inventory_template.xlsx');
        } else {
            res.status(404).json({ message: 'Template file not found' });
        }
    });

    app.post('/api/test-sync', (req, res) => {
        try {
            const data = readExcelData();
            if (data.length > 0) {
                // Randomly update the quantity of the first item to simulate a change
                const firstItem = data[0] as any;
                const oldQty = firstItem.quantity;
                const newQty = Math.floor(Math.random() * 500);
                firstItem.quantity = newQty;
                
                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.json_to_sheet(data);
                XLSX.utils.book_append_sheet(wb, ws, "Inventory");
                const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
                fs.writeFileSync(EXCEL_FILE_PATH, buffer);
                
                console.log(`Simulated update: ${firstItem.name} quantity changed from ${oldQty} to ${newQty}`);
                res.json({ message: 'Excel file updated successfully', newItem: firstItem });
            } else {
                res.status(400).json({ message: 'No data in Excel to update' });
            }
        } catch (error) {
            console.error('Test sync failed:', error);
            res.status(500).json({ message: 'Failed to update Excel file' });
        }
    });

    app.post('/api/inventory/upload', upload.single('file'), (req, res) => {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        console.log(`[Upload] Received new Excel file: ${req.file.originalname}`);
        // The watcher will automatically pick up the change and emit the event
        res.json({ message: 'File uploaded successfully. Syncing...' });
    });

    app.post('/api/inventory/update', (req, res) => {
        // This endpoint could be used to manually trigger a write to Excel if needed
        // For now, we focus on the "watcher" aspect
        res.status(501).json({ message: 'Not implemented: Manual write to Excel via API' });
    });

    // --- VITE MIDDLEWARE ---
    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { 
                middlewareMode: true,
                hmr: {
                    port: 30001 // Use a high, unlikely port for HMR
                }
            },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        app.use(express.static(path.resolve(process.cwd(), 'dist')));
        app.get('*', (req, res) => {
            res.sendFile(path.resolve(process.cwd(), 'dist/index.html'));
        });
    }

    // --- SOCKET.IO CONNECTIONS ---
    io.on('connection', (socket) => {
        console.log('A client connected:', socket.id);
        
        // Send initial data on connection
        socket.emit('inventory_update', readExcelData());

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });

    httpServer.on('error', (e: any) => {
        if (e.code === 'EADDRINUSE') {
            console.error(`\n❌ ERROR: Port ${PORT} is already in use!`);
            console.error(`💡 QUICK FIX: Run this command instead:`);
            console.error(`   set PORT=${Number(PORT) + 1} && npm run dev\n`);
            process.exit(1);
        }
    });

    httpServer.listen(Number(PORT), '0.0.0.0', () => {
        console.log(`Server running on http://0.0.0.0:${PORT}`);
        console.log(`Watching Excel file: ${EXCEL_FILE_PATH}`);
    });
}

startServer().catch(err => {
    console.error('Failed to start server:', err);
});
