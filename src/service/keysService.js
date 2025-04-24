import keysDao from '../dao/keysDao';

// 获取所有密钥
export async function getAllKeys() {
	try {
		const result = await keysDao.getAllKeys();
		return result.results || [];
	} catch (error) {
		console.error('获取密钥时出错:', error);
		return [];
	}
}

/**
 * 添加单个密钥
 * @param {*} key
 * @param {*} balance
 * @returns
 */
export async function addKey(key, balance = 0) {
	try {
		await keysDao.addKey(key, balance);
		return true;
	} catch (error) {
		console.error(`添加密钥 ${key} 时出错:`, error);
		return false;
	}
}
/**
 * 批量添加密钥
 * @param {*} keys
 * @param {*} balance
 * @returns
 */
export async function addKeys(keys, balance = 0) {
	try {
		await keysDao.addKeys(keys, balance);
		return true;
	} catch (error) {
		console.error('批量添加密钥时出错:', error);
		return false;
	}
}

/**
 * 删除密钥
 * @param {*} key
 * @returns
 */
export async function deleteKey(key) {
	try {
		await keysDao.deleteKey(key);
		return true;
	} catch (error) {
		console.error(`删除密钥 ${key} 时出错:`, error);
		return false;
	}
}

/**
 * 优化后的密钥验证和余额检测函数
 * 首先验证密钥是否有效，然后查询余额
 */
export async function checkKeyValidity(key) {
	try {
		// 1. 验证密钥有效性
		const validationResponse = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${key}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: 'Qwen/Qwen2.5-7B-Instruct',
				messages: [{ role: 'user', content: 'hi' }],
				max_tokens: 100,
				stream: false,
			}),
		});

		if (!validationResponse.ok) {
			const errorData = await validationResponse.json().catch(() => null);
			const errorMessage = errorData && errorData.error && errorData.error.message ? errorData.error.message : '密钥验证失败';

			return {
				isValid: false,
				balance: 0,
				message: errorMessage,
			};
		}

		// 2. 查询余额
		const balanceResponse = await fetch('https://api.siliconflow.cn/v1/user/info', {
			method: 'GET',
			headers: { Authorization: `Bearer ${key}` },
		});

		if (!balanceResponse.ok) {
			const errorData = await balanceResponse.json().catch(() => null);
			const errorMessage = errorData && errorData.error && errorData.error.message ? errorData.error.message : '余额查询失败';

			return {
				isValid: false,
				balance: 0,
				message: errorMessage,
			};
		}

		const data = await balanceResponse.json();
		const balance = (data.data && data.data.totalBalance) || 0;

		return {
			isValid: true,
			balance: balance,
			message: '验证成功',
		};
	} catch (error) {
		console.error('检测密钥时出错:', error);
		return {
			isValid: false,
			balance: 0,
			message: `网络错误: ${error.message || '未知错误'}`,
		};
	}
}

/**
 * 更新所有密钥余额
 * @returns
 */
export async function updateAllKeyBalances() {
	try {
		// 获取所有密钥
		const keys = await getAllKeys();

		if (keys.length === 0) {
			return {
				success: true,
				updated: 0,
				failed: 0,
				results: [],
			};
		}

		// 使用分批处理以避免大量并发API请求
		const batchSize = 10; // 每批处理10个密钥
		let updatedCount = 0;
		let failedCount = 0;
		const results = [];
		const now = new Date().toISOString();

		// 分批处理
		for (let i = 0; i < keys.length; i += batchSize) {
			const batch = keys.slice(i, i + batchSize);

			// 批量检测当前批次的密钥
			const batchPromises = batch.map(async (keyObj) => {
				try {
					const result = await checkKeyValidity(keyObj.key);

					// 更新数据库中的余额和最后检查时间
					await env.db.prepare(`UPDATE keys SET balance = ?, last_updated = ? WHERE key = ?`).bind(result.balance, now, keyObj.key).run();

					const keyResult = {
						key: keyObj.key,
						success: result.isValid,
						balance: result.balance,
						message: result.message,
					};

					if (result.isValid) {
						updatedCount++;
					} else {
						failedCount++;
					}

					return keyResult;
				} catch (error) {
					console.error(`处理密钥 ${keyObj.key} 时出错:`, error);

					failedCount++;
					return {
						key: keyObj.key,
						success: false,
						message: `处理出错: ${error.message}`,
					};
				}
			});

			// 等待当前批次所有密钥处理完成
			const batchResults = await Promise.all(batchPromises);
			results.push(...batchResults);

			// 在批次之间添加短暂延迟，避免API速率限制
			if (i + batchSize < keys.length) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		}

		return {
			success: true,
			updated: updatedCount,
			failed: failedCount,
			results: results,
		};
	} catch (error) {
		console.error('更新密钥余额时出错:', error);
		return {
			success: false,
			message: `更新失败: ${error.message}`,
		};
	}
}

export default {
	getAllKeys,
	addKey,
	addKeys,
	deleteKey,
	checkKeyValidity,
	updateAllKeyBalances,
};
