import { openDB, type DBSchema, type StoreValue } from "idb";

const DB_NAME = "History";

export type ImageRecord = {
  id: string;
  timestamp: number;
  radio_id: string;
  version: number;
  snapshot: Uint8Array;
  name?: string;
};

export type SharingRecord = {
  id: string;
  timestamp: number;
  device_id: string;
};

interface Schema extends DBSchema {
  images: {
    key: string;
    value: ImageRecord;
    indexes: { timestamp: number; radio_id: string };
  };
  sharing: {
    key: string;
    value: SharingRecord;
  };
}

async function get_db() {
  const db = await openDB<Schema>(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("images")) {
        const store = db.createObjectStore("images", { keyPath: "id" });
        store.createIndex("timestamp", "timestamp");
        store.createIndex("radio_id", "radio_id");
      }

      if (!db.objectStoreNames.contains("sharing")) {
        db.createObjectStore("sharing", { keyPath: "id" });
      }
    },
  });

  return db;
}

export async function history_add(record: Omit<ImageRecord, "id">) {
  const db = await get_db();

  const id = crypto.randomUUID();

  await db.add("images", {
    ...record,
    id,
  });

  return id;
}

export async function history_all_short(limit = 30) {
  const db = await get_db();
  const records: Omit<ImageRecord, "snapshot">[] = [];

  const tx = db.transaction("images");
  let cursor = await tx.store.index("timestamp").openCursor(null, "prev");

  while (cursor) {
    const record = { ...cursor.value, snapshot: undefined };
    delete record.snapshot;

    records.push({
      id: record.id,
      radio_id: record.radio_id,
      timestamp: record.timestamp,
      version: record.version,
      name: record.name,
    });

    if (!limit--) break;
    cursor = await cursor.continue();
  }

  await tx.done;
  return records;
}

export async function history_get(id: ImageRecord["id"]) {
  const db = await get_db();

  return await db.get("images", id);
}

export async function sharing_put(record: SharingRecord) {
  const db = await get_db();

  await db.put("sharing", record);
}

export async function sharing_all() {
  const db = await get_db();

  return db.getAll("sharing");
}
