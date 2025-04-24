import configDao from '../dao/configDao';
import defaultConfig from '../config/defaultConfig';

export default {
	// D1工具函数 - 获取配置值
	async getConfigValueByName(name, defaultValue) {
		try {
			const result = await configDao.getConfigValueByName(name);

			return result ? result.value : defaultValue;
		} catch (error) {
			console.error(`获取配置 ${name} 时出错:`, error);
			return defaultValue;
		}
	},
	async getAllConfig() {
		try {
			const configs = await configDao.getAllConfig();

			// 转换为映射结构
			const configMap = {};
			for (const row of configs.results) {
				configMap[row.name] = row.value;
			}

			return {
				apiKey: configMap.api_key || defaultConfig.API_KEY,
				adminUsername: configMap.admin_username || defaultConfig.ADMIN_USERNAME,
				adminPassword: configMap.admin_password || defaultConfig.ADMIN_PASSWORD,
				pageSize: parseInt(configMap.page_size || defaultConfig.PAGE_SIZE),
				accessControl: configMap.access_control || defaultConfig.ACCESS_CONTROL,
				guestPassword: configMap.guest_password || defaultConfig.GUEST_PASSWORD,
			};
		} catch (error) {
			console.error('获取配置时出错:', error);
			// 出错时返回默认配置
			return {
				apiKey: defaultConfig.API_KEY,
				adminUsername: defaultConfig.ADMIN_USERNAME,
				adminPassword: defaultConfig.ADMIN_PASSWORD,
				pageSize: defaultConfig.PAGE_SIZE,
				accessControl: defaultConfig.ACCESS_CONTROL,
				guestPassword: defaultConfig.GUEST_PASSWORD,
			};
		}
	},
	async updateConfiguration(config) {
		const updates = [];

		try {
			// 准备参数化SQL批量更新
			if (config.apiKey !== undefined) {
				updates.push(env.db.prepare(`INSERT OR REPLACE INTO config (name, value) VALUES ('api_key', ?)`).bind(config.apiKey));
			}

			if (config.adminUsername !== undefined) {
				updates.push(env.db.prepare(`INSERT OR REPLACE INTO config (name, value) VALUES ('admin_username', ?)`).bind(config.adminUsername));
			}

			if (config.adminPassword !== undefined) {
				updates.push(env.db.prepare(`INSERT OR REPLACE INTO config (name, value) VALUES ('admin_password', ?)`).bind(config.adminPassword));
			}

			if (config.pageSize !== undefined) {
				updates.push(
					env.db.prepare(`INSERT OR REPLACE INTO config (name, value) VALUES ('page_size', ?)`).bind(config.pageSize.toString())
				);
			}

			if (config.accessControl !== undefined) {
				updates.push(env.db.prepare(`INSERT OR REPLACE INTO config (name, value) VALUES ('access_control', ?)`).bind(config.accessControl));
			}

			if (config.guestPassword !== undefined) {
				updates.push(env.db.prepare(`INSERT OR REPLACE INTO config (name, value) VALUES ('guest_password', ?)`).bind(config.guestPassword));
			}

			// 执行所有更新
			if (updates.length > 0) {
				await env.db.batch(updates);
			}

			return true;
		} catch (error) {
			console.error('更新配置时出错:', error);
			return false;
		}
	},
};
