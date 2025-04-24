export default {
	async getAllKeys() {
		return await env.db.prepare(`SELECT key, balance, added, last_updated as lastUpdated FROM keys ORDER BY balance DESC`).all();
	},

	async addKey(key, balance = 0) {
		const now = new Date().toISOString();
		return await env.db
			.prepare(
				`INSERT OR REPLACE INTO keys (key, balance, added, last_updated)
       VALUES (?, ?, ?, ?)`
			)
			.bind(key, balance, now, null)
			.run();
	},
	// 批量添加密钥
	async addKeys(keys, balance = 0) {
		const now = new Date().toISOString();
		const batch = [];

		for (const key of keys) {
			batch.push(
				env.db
					.prepare(
						`INSERT OR REPLACE INTO keys (key, balance, added, last_updated)
           VALUES (?, ?, ?, ?)`
					)
					.bind(key, balance, now, null)
			);
		}

		await env.db.batch(batch);
	},
	async deleteKey(key) {
		return await env.db.prepare(`DELETE FROM keys WHERE key = ?`).bind(key).run();
	},
};
