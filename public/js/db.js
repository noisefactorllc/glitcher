// SPDX-License-Identifier: MIT
/**
 * IndexedDB persistence for gallery captures
 *
 * Database 'glitcher', version 1, object store 'captures' with keyPath 'id'.
 * Each record: { id, type, blob, thumbUrl }
 */

const DB_NAME = 'glitcher'
const DB_VERSION = 1
const STORE = 'captures'

let _db = null

function openDB() {
    if (_db) return Promise.resolve(_db)
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION)
        req.onupgradeneeded = () => {
            req.result.createObjectStore(STORE, { keyPath: 'id' })
        }
        req.onsuccess = () => {
            _db = req.result
            resolve(_db)
        }
        req.onerror = () => reject(req.error)
    })
}

export async function saveCapture(record) {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).put(record)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

export async function deleteCapture(id) {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).delete(id)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

export async function loadAllCaptures() {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly')
        const req = tx.objectStore(STORE).getAll()
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}

export async function getMaxId() {
    const captures = await loadAllCaptures()
    if (captures.length === 0) return 0
    return Math.max(...captures.map(c => c.id))
}
