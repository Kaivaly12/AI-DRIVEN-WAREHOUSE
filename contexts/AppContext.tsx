import React, { createContext, useState, ReactNode, useEffect } from 'react';
import type { Product, Bot } from '../types';
import { ProductStatus } from '../types';
import { MOCK_PRODUCTS, MOCK_BOTS } from '../constants';
import { io } from 'socket.io-client';

interface AppContextType {
    products: Product[];
    setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
    bots: Bot[];
    setBots: React.Dispatch<React.SetStateAction<Bot[]>>;
    isSynced: boolean;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

const getStatusFromQuantity = (quantity: number): ProductStatus => {
    if (quantity === 0) return ProductStatus.OutOfStock;
    if (quantity <= 50) return ProductStatus.LowStock;
    return ProductStatus.InStock;
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
    const [bots, setBots] = useState<Bot[]>(MOCK_BOTS);
    const [isSynced, setIsSynced] = useState(false);

    useEffect(() => {
        // Connect to the WebSocket server
        // Use explicit transports for better reliability in proxied environments
        const socket = io({
            transports: ['websocket', 'polling'],
        });

        socket.on('connect', () => {
            console.log('✅ Connected to real-time sync server. ID:', socket.id);
            setIsSynced(true);
        });

        socket.on('connect_error', (error) => {
            console.error('❌ Socket connection error:', error);
            setIsSynced(false);
        });

        socket.on('inventory_update', (data: any[]) => {
            console.log('📥 Received real-time inventory update:', data);
            
            if (!Array.isArray(data)) {
                console.error('❌ Received invalid data format:', data);
                return;
            }
            
            // Map raw Excel data to Product type with flexible header support
            const syncedProducts: Product[] = data.map((item: any) => {
                // Find values by looking for common header names
                const findValue = (keys: string[]) => {
                    const foundKey = Object.keys(item).find(k => 
                        keys.includes(k.toLowerCase().trim())
                    );
                    return foundKey ? item[foundKey] : undefined;
                };

                const id = String(findValue(['id', 'pid', 'product id', 'item id']) || '');
                const name = String(findValue(['name', 'product name', 'item name', 'product']) || 'Unknown Product');
                const category = String(findValue(['category', 'type', 'group']) || 'Uncategorized');
                const quantity = Number(findValue(['quantity', 'qty', 'stock', 'amount']) || 0);
                const price = Number(findValue(['price', 'cost', 'unit price', 'rate']) || 0);
                const supplier = String(findValue(['supplier', 'vendor', 'source', 'manufacturer']) || 'Unknown Supplier');
                const dateAdded = String(findValue(['dateadded', 'date', 'added', 'created']) || new Date().toISOString().split('T')[0]);

                return {
                    id,
                    name,
                    category,
                    quantity,
                    price,
                    supplier,
                    status: getStatusFromQuantity(quantity),
                    dateAdded,
                };
            });

            if (syncedProducts.length > 0) {
                setProducts(syncedProducts);
            }
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from real-time sync server');
            setIsSynced(false);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const value = {
        products,
        setProducts,
        bots,
        setBots,
        isSynced,
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};
