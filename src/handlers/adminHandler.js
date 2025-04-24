import { middlewareAuthenticateAdmin, middlewareAuthenticateGuest } from './middleware';
import configService from '../service/configService';
import defaultConfig from '../config/defaultConfig.js';
import keysService from '../service/keysService.js';

export default {
	// 处理管理员API端点
	async getPageSize() {
		// 特殊处理pageSize请求，无需鉴权
		const pageSize = parseInt(await configService.getConfigValueByName('page_size', defaultConfig.PAGE_SIZE));
		return new Response(JSON.stringify({ success: true, data: pageSize }), {
			headers: { 'Content-Type': 'application/json' },
		});
	},
	async handleAdminAPI(request, endpoint) {
		// keys端点无需验证，其他端点需要验证
		if (endpoint === 'keys') {
			// 获取所有密钥，如果不是管理员调用，需要进行访客认证
			if (!(await middlewareAuthenticateAdmin(request)) && !(await middlewareAuthenticateGuest(request))) {
				return new Response(
					JSON.stringify({
						success: false,
						message: '需要认证',
						requireAuth: true,
						accessControl: (await configService.getAllConfig()).accessControl,
					}),
					{
						status: 401,
						headers: { 'Content-Type': 'application/json' },
					}
				);
			}

			const keys = await keysService.getAllKeys();
			return new Response(JSON.stringify({ success: true, data: keys }), {
				headers: { 'Content-Type': 'application/json' },
			});
		}
		// 添加获取访问控制配置的端点
		else if (endpoint === 'access-control') {
			// 这个端点可以公开访问，用于前端判断认证方式
			const config = await configService.getAllConfig();
			return new Response(
				JSON.stringify({
					success: true,
					data: {
						accessControl: config.accessControl,
					},
				}),
				{
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}
		// 添加访客验证的端点
		else if (endpoint === 'verify-guest') {
			const data = await request.json();
			const config = await configService.getAllConfig();

			if (config.accessControl !== 'restricted') {
				return new Response(
					JSON.stringify({
						success: false,
						message: '当前模式不需要访客认证',
					}),
					{
						headers: { 'Content-Type': 'application/json' },
					}
				);
			}

			// 验证访客密码
			if (data.password === config.guestPassword) {
				return new Response(
					JSON.stringify({
						success: true,
						token: config.guestPassword,
					}),
					{
						headers: { 'Content-Type': 'application/json' },
					}
				);
			} else {
				return new Response(
					JSON.stringify({
						success: false,
						message: '访客密码不正确',
					}),
					{
						status: 401,
						headers: { 'Content-Type': 'application/json' },
					}
				);
			}
		}

		try {
			if (request.method === 'GET') {
				// GET端点
				if (endpoint === 'keys') {
					// 获取所有密钥
					const keys = await getAllKeys();
					return new Response(JSON.stringify({ success: true, data: keys }), {
						headers: { 'Content-Type': 'application/json' },
					});
				} else if (endpoint === 'config') {
					// 获取配置
					const config = await configService.getAllConfig();
					return new Response(JSON.stringify({ success: true, data: config }), {
						headers: { 'Content-Type': 'application/json' },
					});
				}
			} else if (request.method === 'POST') {
				if (endpoint === 'add-key') {
					const data = await request.json();
					// 添加新密钥
					if (!data.key) {
						return new Response(JSON.stringify({ success: false, message: 'Key is required' }), {
							status: 400,
							headers: { 'Content-Type': 'application/json' },
						});
					}
					await addKey(data.key, data.balance || 0);
					return new Response(JSON.stringify({ success: true }), {
						headers: { 'Content-Type': 'application/json' },
					});
				} else if (endpoint === 'add-keys-bulk') {
					const data = await request.json();
					// 批量添加密钥（每行一个）
					if (!data.keys) {
						return new Response(JSON.stringify({ success: false, message: 'Keys are required' }), {
							status: 400,
							headers: { 'Content-Type': 'application/json' },
						});
					}

					const keys = data.keys
						.split('\n')
						.map((k) => k.trim())
						.filter((k) => k);

					// 使用批量添加函数
					await addKeys(keys, 0);

					// 直接返回添加的key字符串数组
					return new Response(
						JSON.stringify({
							success: true,
							count: keys.length,
							addedKeys: keys, // 直接返回API Key字符串数组
							autoCheck: true, // 标记前端需要自动触发检查
						}),
						{
							headers: { 'Content-Type': 'application/json' },
						}
					);
				} else if (endpoint === 'delete-key') {
					const data = await request.json();
					// 删除密钥
					if (!data.key) {
						return new Response(JSON.stringify({ success: false, message: 'Key is required' }), {
							status: 400,
							headers: { 'Content-Type': 'application/json' },
						});
					}
					await deleteKey(data.key);
					return new Response(JSON.stringify({ success: true }), {
						headers: { 'Content-Type': 'application/json' },
					});
				} else if (endpoint === 'update-config') {
					const data = await request.json();
					// 更新配置
					await updateConfiguration(data);
					return new Response(JSON.stringify({ success: true }), {
						headers: { 'Content-Type': 'application/json' },
					});
				} else if (endpoint === 'update-balances') {
					const data = await request.json();
					try {
						// 执行实际更新操作
						const result = await updateAllKeyBalances();

						return new Response(JSON.stringify(result), {
							headers: { 'Content-Type': 'application/json' },
						});
					} catch (error) {
						console.error('更新密钥余额时出错:', error);
						return new Response(
							JSON.stringify({
								success: false,
								message: `更新失败: ${error.message || '未知错误'}`,
							}),
							{
								status: 500,
								headers: { 'Content-Type': 'application/json' },
							}
						);
					}
				} else if (endpoint === 'update-key-balance') {
					const data = await request.json();
					if (!data.key) {
						return new Response(JSON.stringify({ success: false, message: '密钥不能为空' }), {
							status: 400,
							headers: { 'Content-Type': 'application/json' },
						});
					}

					// 检查密钥是否存在
					const keyExists = await env.db.prepare(`SELECT key FROM keys WHERE key = ?`).bind(data.key).first();

					if (!keyExists) {
						return new Response(JSON.stringify({ success: false, message: '密钥不存在' }), {
							status: 404,
							headers: { 'Content-Type': 'application/json' },
						});
					}

					// 更新单个密钥的余额
					try {
						// 使用优化后的检测方法
						const result = await checkKeyValidity(data.key);
						const now = new Date().toISOString();

						// 更新密钥状态到D1数据库
						await env.db.prepare(`UPDATE keys SET balance = ?, last_updated = ? WHERE key = ?`).bind(result.balance, now, data.key).run();

						return new Response(
							JSON.stringify({
								success: result.isValid,
								balance: result.balance,
								message: result.message,
								key: data.key,
								isValid: result.isValid,
								lastUpdated: now,
							}),
							{
								headers: { 'Content-Type': 'application/json' },
							}
						);
					} catch (error) {
						return new Response(
							JSON.stringify({
								success: false,
								message: '检测余额失败: ' + error.message,
							}),
							{
								status: 500,
								headers: { 'Content-Type': 'application/json' },
							}
						);
					}
				} else if (endpoint === 'update-keys-balance') {
					try {
						// 首先验证管理员权限
						const authHeader = request.headers.get('Authorization');
						if (!authHeader || !authHeader.startsWith('Basic ')) {
							return new Response(JSON.stringify({ success: false, message: '认证失败' }), {
								status: 401,
								headers: { 'Content-Type': 'application/json' },
							});
						}

						// 解码并验证凭据
						const encodedCredentials = authHeader.split(' ')[1];
						const decodedCredentials = atob(encodedCredentials);
						const [username, password] = decodedCredentials.split(':');

						// 从D1数据库查询管理员凭据
						const adminUsername = await configService.getConfigValueByName('admin_username', defaultConfig.ADMIN_USERNAME);
						const adminPassword = await configService.getConfigValueByName('admin_password', defaultConfig.ADMIN_PASSWORD);

						// 验证凭据
						if (username !== adminUsername || password !== adminPassword) {
							return new Response(JSON.stringify({ success: false, message: '认证失败' }), {
								status: 401,
								headers: { 'Content-Type': 'application/json' },
							});
						}

						// 只读取一次请求体
						const data = await request.json();

						// 验证keys数组
						if (!data || !data.keys || !Array.isArray(data.keys) || data.keys.length === 0) {
							return new Response(
								JSON.stringify({
									success: false,
									message: '请提供要检测的密钥列表',
								}),
								{
									status: 400,
									headers: { 'Content-Type': 'application/json' },
								}
							);
						}

						// 获取要检测的密钥
						const keysToCheck = data.keys;
						const now = new Date().toISOString();

						// 优化：不要分别查询每个密钥是否存在，而是一次性查询所有密钥
						const existingKeysQuery = await env.db
							.prepare(`SELECT key FROM keys WHERE key IN (${keysToCheck.map(() => '?').join(',')})`)
							.bind(...keysToCheck)
							.all();

						// 创建一个Set来快速检查密钥是否存在
						const existingKeysSet = new Set();
						for (const row of existingKeysQuery.results || []) {
							existingKeysSet.add(row.key);
						}

						// 创建所有密钥检测的Promise数组 - 后端完全并发处理
						const checkPromises = keysToCheck.map(async (key) => {
							try {
								// 使用Set快速检查密钥是否存在
								if (!existingKeysSet.has(key)) {
									return {
										key,
										success: false,
										isValid: false,
										balance: 0,
										lastUpdated: now,
										message: '密钥不存在',
									};
								}

								// 检测密钥余额
								const result = await checkKeyValidity(key);

								// 更新D1数据库中的余额和最后更新时间
								await env.db.prepare(`UPDATE keys SET balance = ?, last_updated = ? WHERE key = ?`).bind(result.balance, now, key).run();

								return {
									key,
									success: true,
									isValid: result.isValid,
									balance: result.balance,
									lastUpdated: now,
									message: result.message,
								};
							} catch (error) {
								console.error(`检测密钥 ${key} 失败:`, error);
								return {
									key,
									success: false,
									isValid: false,
									balance: 0,
									lastUpdated: now,
									message: `检测失败: ${error.message || '未知错误'}`,
								};
							}
						});

						// 并发执行所有检测Promise
						const results = await Promise.all(checkPromises);

						return new Response(
							JSON.stringify({
								success: true,
								results: results,
								count: results.length,
								validCount: results.filter((r) => r.isValid).length,
							}),
							{
								headers: { 'Content-Type': 'application/json' },
							}
						);
					} catch (error) {
						return new Response(
							JSON.stringify({
								success: false,
								message: '处理请求时出错: ' + (error.message || '未知错误'),
								stack: error.stack,
							}),
							{
								status: 500,
								headers: { 'Content-Type': 'application/json' },
							}
						);
					}
				} else if (endpoint === 'batch-update-keys') {
					try {
						// 验证管理员权限或访客权限
						if (!(await middlewareAuthenticateAdmin(request)) && !(await middlewareAuthenticateGuest(request))) {
							return new Response(JSON.stringify({ success: false, message: '认证失败' }), {
								status: 401,
								headers: { 'Content-Type': 'application/json' },
							});
						}

						// 解析请求体
						const data = await request.json();

						// 验证结果数组
						if (!data || !data.results || !Array.isArray(data.results) || data.results.length === 0) {
							return new Response(
								JSON.stringify({
									success: false,
									message: '请提供要更新的密钥结果列表',
								}),
								{
									status: 400,
									headers: { 'Content-Type': 'application/json' },
								}
							);
						}

						const now = new Date().toISOString();
						const updatePromises = [];
						const results = [];

						// 批量处理所有更新请求
						for (const result of data.results) {
							try {
								// 检查必要字段
								if (!result.key) {
									results.push({
										success: false,
										message: '密钥不能为空',
									});
									continue;
								}

								// 准备更新语句
								const updateStmt = env.db
									.prepare(`UPDATE keys SET balance = ?, last_updated = ? WHERE key = ?`)
									.bind(result.balance || 0, now, result.key);

								// 添加到批量操作中
								updatePromises.push(
									updateStmt
										.run()
										.then(() => {
											results.push({
												key: result.key,
												success: true,
												updated: now,
											});
										})
										.catch((error) => {
											console.error(`更新密钥 ${result.key} 失败:`, error);
											results.push({
												key: result.key,
												success: false,
												message: `数据库更新失败: ${error.message || '未知错误'}`,
											});
										})
								);
							} catch (error) {
								results.push({
									key: result.key || '未知密钥',
									success: false,
									message: `处理更新失败: ${error.message || '未知错误'}`,
								});
							}
						}

						// 等待所有更新完成
						await Promise.all(updatePromises);

						// 统计更新结果
						const successCount = results.filter((r) => r.success).length;
						const failCount = results.length - successCount;

						return new Response(
							JSON.stringify({
								success: true,
								updated: successCount,
								failed: failCount,
								total: results.length,
								results: results,
							}),
							{
								headers: { 'Content-Type': 'application/json' },
							}
						);
					} catch (error) {
						console.error('批量更新密钥时出错:', error);
						return new Response(
							JSON.stringify({
								success: false,
								message: '处理请求时出错: ' + (error.message || '未知错误'),
							}),
							{
								status: 500,
								headers: { 'Content-Type': 'application/json' },
							}
						);
					}
				}
			} else if (request.method === 'DELETE') {
				if (endpoint.startsWith('keys/')) {
					const key = endpoint.replace('keys/', '');
					await deleteKey(key);
					return new Response(JSON.stringify({ success: true }), {
						headers: { 'Content-Type': 'application/json' },
					});
				}
			}
		} catch (error) {
			return new Response(JSON.stringify({ success: false, message: error.message }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// 如果没有匹配的端点
		return new Response(JSON.stringify({ success: false, message: '无效的端点' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' },
		});
	},
};
