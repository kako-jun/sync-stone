// IndexedDB utilities for SyncStone Chrome Extension

const DB_NAME = 'SyncStoneDB';
const DB_VERSION = 1;
const IMAGE_STORE = 'images';

export interface StoredImage {
  url: string;
  base64: string;
  filename: string;
  success: boolean;
}

// Open or create the database
export async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create images object store if it doesn't exist
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        const store = db.createObjectStore(IMAGE_STORE, { keyPath: 'url' });
        store.createIndex('filename', 'filename', { unique: false });
      }
    };
  });
}

// Save image to IndexedDB
export async function saveImage(image: StoredImage): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([IMAGE_STORE], 'readwrite');
  const store = transaction.objectStore(IMAGE_STORE);
  
  return new Promise((resolve, reject) => {
    const request = store.put(image);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Get image from IndexedDB
export async function getImage(url: string): Promise<StoredImage | null> {
  const db = await openDB();
  const transaction = db.transaction([IMAGE_STORE], 'readonly');
  const store = transaction.objectStore(IMAGE_STORE);
  
  return new Promise((resolve, reject) => {
    const request = store.get(url);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

// Get all images count
export async function getImageCount(): Promise<number> {
  const db = await openDB();
  const transaction = db.transaction([IMAGE_STORE], 'readonly');
  const store = transaction.objectStore(IMAGE_STORE);
  
  return new Promise((resolve, reject) => {
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Clear all images from IndexedDB
export async function clearAllImages(): Promise<void> {
  console.log('[IndexedDB] Clearing all images from database');
  const db = await openDB();
  const transaction = db.transaction([IMAGE_STORE], 'readwrite');
  const store = transaction.objectStore(IMAGE_STORE);
  
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => {
      console.log('[IndexedDB] All images cleared successfully');
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

// Delete the entire database (complete cleanup)
export async function deleteDatabase(): Promise<void> {
  console.log('[IndexedDB] Deleting entire database');
  
  return new Promise((resolve, reject) => {
    const deleteReq = indexedDB.deleteDatabase(DB_NAME);
    
    deleteReq.onsuccess = () => {
      console.log('[IndexedDB] Database deleted successfully');
      resolve();
    };
    
    deleteReq.onerror = () => {
      console.error('[IndexedDB] Failed to delete database');
      reject(deleteReq.error);
    };
    
    deleteReq.onblocked = () => {
      console.warn('[IndexedDB] Database deletion blocked - close all connections');
      // Still resolve as the database will be deleted when connections close
      resolve();
    };
  });
}