# Real-Time Inventory Sync Setup

This system is designed to automatically synchronize your warehouse inventory from an Excel file or a database directly to your dashboard in real-time.

## 1. Excel Synchronization (Default)

The system is currently configured to watch a local Excel file.

### Setup Steps:
1.  **Locate the Data File**: The system watches `data/inventory.xlsx` in the project root.
2.  **Edit the File**: Open `data/inventory.xlsx` in Excel or any spreadsheet editor.
3.  **Modify Data**: Change quantities, names, or add new rows.
4.  **Save**: As soon as you save the file, the dashboard will update instantly without a refresh.

### Excel Structure:
The Excel file should have the following headers in the first row:
`id`, `name`, `category`, `quantity`, `price`, `supplier`

---

## 2. Database Synchronization (Alternative)

To switch to a database like MongoDB or MySQL, follow these architectural patterns:

### MongoDB (Change Streams)
1.  Install `mongodb` driver.
2.  Use the `watch()` method on your collection.
3.  In `server.ts`, replace the Excel watcher with the MongoDB watcher.

### MySQL (Binlog)
1.  Enable `binlog` in your MySQL configuration.
2.  Use a library like `mysql-events` or `zongji`.
3.  Listen for `INSERT` or `UPDATE` events and emit them via Socket.io.

---

## 3. Backend Architecture

-   **Node.js + Express**: Serves the API and the frontend.
-   **Socket.io**: Handles the persistent WebSocket connection for instant updates.
-   **Chokidar**: Efficiently watches for file system changes in the Excel file.
-   **XLSX (SheetJS)**: Parses the Excel binary data into JSON for the frontend.

---

## 4. Deployment Steps

### Local Development:
```bash
npm install
npm run dev
```

### Production:
1.  **Build the Frontend**:
    ```bash
    npm run build
    ```
2.  **Environment Variables**: Ensure `NODE_ENV=production` is set.
3.  **Start the Server**:
    ```bash
    node server.ts
    ```
4.  **Persistent Data**: Ensure the `data/` directory is persistent across deployments (e.g., using Docker volumes or cloud storage).

---

## 5. Troubleshooting

-   **Sync Offline**: If the dashboard shows "Sync Offline", check if the backend server is running and if there are any network blocks on WebSockets.
-   **File Not Found**: Ensure the `data/inventory.xlsx` file exists. The server creates a sample one on first start.
-   **Permissions**: Ensure the Node.js process has read/write permissions for the `data/` directory.
