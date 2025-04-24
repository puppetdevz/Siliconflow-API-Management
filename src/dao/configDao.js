export default {
	async getConfigValueByName(name) {
		return await env.db.prepare(`select value from config where name = ?`).bind(name).first();
	},

	async getAllConfig() {
		return await env.db.prepare(`select name, value from config`).all();
	},
};
