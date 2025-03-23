// 标签功能
const tabs = document.querySelectorAll('.tab')
const tabContents = document.querySelectorAll('.tab-content')

// 弹窗功能
let modalCallback = null
let modalInputType = 'text'

// 选中key
let selectedKeys = new Set()

// 停止检测
let isBatchProcessingStopped = false

// 排序变量
let currentSortField = 'added' // 默认按添加时间排序
let currentSortOrder = 'desc' // 默认降序(最新添加的在前面)

// 打开弹窗
function showModal(options = {}) {
  const modal = document.getElementById('custom-modal')
  const title = document.getElementById('modal-title')
  const message = document.getElementById('modal-message')
  const confirmBtn = document.getElementById('modal-confirm')
  const cancelBtn = document.getElementById('modal-cancel')
  const inputContainer = document.getElementById('modal-input-container')
  const input = document.getElementById('modal-input')

  // 设置标题
  if (options.title) {
    document.querySelector('.modal-title').textContent = options.title
  } else {
    document.querySelector('.modal-title').textContent = '提示'
  }

  // 设置消息
  message.textContent = options.message || ''

  // 设置按钮文本
  confirmBtn.textContent = options.confirmText || '确认'
  cancelBtn.textContent = options.cancelText || '取消'

  // 设置按钮颜色
  confirmBtn.className = options.confirmClass || ''

  // 处理输入框
  if (options.input) {
    inputContainer.style.display = 'block'
    input.placeholder = options.placeholder || ''
    input.value = options.value || ''
    modalInputType = options.inputType || 'text'
    input.type = modalInputType
  } else {
    inputContainer.style.display = 'none'
  }

  // 显示/隐藏取消按钮
  if (options.showCancel === false) {
    cancelBtn.style.display = 'none'
  } else {
    cancelBtn.style.display = 'inline-block'
  }

  // 保存回调
  modalCallback = options.callback

  // 显示弹窗
  modal.classList.add('show')

  // 如果有输入框，聚焦它
  if (options.input) {
    setTimeout(() => input.focus(), 100)
  }
}

// 关闭弹窗
function closeModal() {
  const modal = document.getElementById('custom-modal')
  modal.classList.remove('show')
  modalCallback = null
}

// 处理弹窗确认
function handleModalConfirm() {
  const input = document.getElementById('modal-input')
  const value = input.value

  if (modalCallback) {
    modalCallback(value)
  }

  closeModal()
}

// 确认对话框
function confirmDialog(message, callback, options = {}) {
  showModal({
    title: options.title || '确认操作',
    message: message,
    confirmText: options.confirmText || '确认',
    cancelText: options.cancelText || '取消',
    confirmClass: options.confirmClass || 'danger',
    callback: result => {
      if (callback) callback(true)
    },
    showCancel: true,
  })
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const tabId = tab.getAttribute('data-tab')

    // 更新活动标签
    tabs.forEach(t => t.classList.remove('active'))
    tab.classList.add('active')

    // 更新活动内容
    tabContents.forEach(content => {
      content.classList.remove('active')
      if (content.id === tabId) {
        content.classList.add('active')
      }
    })

    // 基于标签加载内容
    if (tabId === 'dashboard') {
      loadDashboard()
    } else if (tabId === 'keys') {
      loadAllKeys()
    } else if (tabId === 'settings') {
      loadSettings()
    }
  })
})

// 通知消息
const toast = document.getElementById('toast')

function showToast(message, isError = false) {
  toast.textContent = message
  toast.style.background = isError ? 'rgba(231, 76, 60, 0.9)' : 'rgba(46, 204, 113, 0.9)'
  toast.classList.add('show')

  setTimeout(() => {
    toast.classList.remove('show')
  }, 3000) // 延长显示时间
}

// 图表实例对象
let balanceDistChart, keyStatusChart, balanceTrendChart

// 增强的仪表盘加载函数
function loadDashboard() {
  loadStats()
  loadRecentKeys()

  // 添加图表数据加载和渲染
  loadChartData()
}

// 加载并处理图表数据
async function loadChartData() {
  try {
    const response = await fetch('/admin/api/keys')
    if (!response.ok) throw new Error('加载密钥失败')

    const result = await response.json()
    if (result.success) {
      const keys = result.data

      // 处理余额分布数据
      renderBalanceDistributionChart(keys)

      // 处理密钥状态数据
      renderKeyStatusChart(keys)

      // 处理余额趋势数据
      renderBalanceTrendChart(keys)

      // 更新余额统计信息
      updateBalanceStats(keys)
    }
  } catch (error) {
    console.error('加载图表数据失败:', error)
    showToast('加载图表数据失败', true)
  }
}

// 渲染余额分布图表
function renderBalanceDistributionChart(keys) {
  const ctx = document.getElementById('balance-distribution-chart').getContext('2d')

  // 定义余额区间
  const ranges = [
    { min: 0, max: 10, label: '0-10' },
    { min: 10, max: 12, label: '10-12' },
    { min: 12, max: 13, label: '12-13' },
    { min: 13, max: 14, label: '13-14' },
    { min: 14, max: 100, label: '14-100' },
    { min: 100, max: 1000, label: '100-1000' },
    { min: 1000, max: Infinity, label: '1000+' },
  ]

  // 计算每个区间的密钥数量
  const distribution = ranges.map(range => {
    return keys.filter(key => {
      const balance = parseFloat(key.balance) || 0
      return balance > range.min && balance <= range.max
    }).length
  })

  // 销毁旧图表
  if (balanceDistChart) {
    balanceDistChart.destroy()
  }

  // 创建新图表
  balanceDistChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ranges.map(r => r.label),
      datasets: [
        {
          label: '密钥数量',
          data: distribution,
          backgroundColor: [
            'rgba(52, 152, 219, 0.7)',
            'rgba(46, 204, 113, 0.7)',
            'rgba(155, 89, 182, 0.7)',
            'rgba(52, 73, 94, 0.7)',
            'rgba(22, 160, 133, 0.7)',
            'rgba(241, 196, 15, 0.7)',
          ],
          borderColor: [
            'rgba(52, 152, 219, 1)',
            'rgba(46, 204, 113, 1)',
            'rgba(155, 89, 182, 1)',
            'rgba(52, 73, 94, 1)',
            'rgba(22, 160, 133, 1)',
            'rgba(241, 196, 15, 1)',
          ],
          borderWidth: 1,
          borderRadius: 5,
          maxBarThickness: 50,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            title: function (tooltipItems) {
              return `余额范围: ${tooltipItems[0].label}`
            },
            label: function (context) {
              return `数量: ${context.raw} 个密钥`
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
          },
          title: {
            display: true,
            text: '密钥数量',
          },
        },
        x: {
          title: {
            display: true,
            text: '余额范围',
          },
        },
      },
    },
  })
}

// 渲染密钥状态图表
function renderKeyStatusChart(keys) {
  const ctx = document.getElementById('key-status-chart').getContext('2d')

  // 计算状态分布
  const valid = keys.filter(k => parseFloat(k.balance) > 0 && !k.lastError).length
  const noBalance = keys.filter(k => parseFloat(k.balance) <= 0 && !k.lastError).length
  const hasError = keys.filter(k => k.lastError).length

  // 销毁旧图表
  if (keyStatusChart) {
    keyStatusChart.destroy()
  }

  // 创建新图表
  keyStatusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['有效', '余额不足', '错误'],
      datasets: [
        {
          data: [valid, noBalance, hasError],
          backgroundColor: ['rgba(46, 204, 113, 0.8)', 'rgba(241, 196, 15, 0.8)', 'rgba(231, 76, 60, 0.8)'],
          borderColor: ['rgba(46, 204, 113, 1)', 'rgba(241, 196, 15, 1)', 'rgba(231, 76, 60, 1)'],
          borderWidth: 1,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            usePointStyle: true,
            pointStyle: 'circle',
          },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.label || ''
              const value = context.raw
              const total = context.dataset.data.reduce((a, b) => a + b, 0)
              const percentage = Math.round((value / total) * 100)
              return `${label}: ${value} (${percentage}%)`
            },
          },
        },
      },
    },
  })
}

// 渲染余额趋势图表
function renderBalanceTrendChart(keys) {
  const ctx = document.getElementById('balance-trend-chart').getContext('2d')

  // 获取有效密钥并按余额排序
  const validKeys = keys
    .filter(k => parseFloat(k.balance) > 0)
    .sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance))

  // 获取选定范围
  const rangeSelect = document.getElementById('trend-range')
  const range = rangeSelect ? rangeSelect.value : '20'

  // 根据范围选择数据
  let displayKeys
  if (range === 'all') {
    displayKeys = validKeys
  } else {
    displayKeys = validKeys.slice(0, parseInt(range))
  }

  // 准备数据
  const labels = displayKeys.map((_, index) => `密钥 ${index + 1}`)
  const balances = displayKeys.map(k => parseFloat(k.balance) || 0)

  // 销毁旧图表
  if (balanceTrendChart) {
    balanceTrendChart.destroy()
  }

  // 创建新图表
  balanceTrendChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: '余额',
          data: balances,
          backgroundColor: balances.map(balance => {
            if (balance >= 50) return 'rgba(46, 204, 113, 0.7)' // 高余额
            if (balance >= 10) return 'rgba(52, 152, 219, 0.7)' // 中等余额
            return 'rgba(241, 196, 15, 0.7)' // 低余额
          }),
          borderColor: balances.map(balance => {
            if (balance >= 50) return 'rgba(46, 204, 113, 1)'
            if (balance >= 10) return 'rgba(52, 152, 219, 1)'
            return 'rgba(241, 196, 15, 1)'
          }),
          borderWidth: 1,
          borderRadius: 4,
          maxBarThickness: 40,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            title: function (tooltipItems) {
              const keyIndex = tooltipItems[0].dataIndex
              return `密钥: ${displayKeys[keyIndex].key}`
            },
            label: function (context) {
              return `余额: ${context.raw}`
            },
            afterLabel: function (context) {
              const keyIndex = context.dataIndex
              const key = displayKeys[keyIndex]
              if (key.lastUpdated) {
                return `最后更新: ${new Date(key.lastUpdated).toLocaleString()}`
              }
              return ''
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: '余额',
          },
        },
        x: {
          ticks: {
            autoSkip: true,
            maxTicksLimit: 20,
          },
          title: {
            display: true,
            text: '密钥编号',
          },
        },
      },
    },
  })

  // 添加点击事件，显示详细信息
  ctx.canvas.onclick = function (evt) {
    const points = balanceTrendChart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true)
    if (points.length) {
      const firstPoint = points[0]
      const keyIndex = firstPoint.index
      const key = displayKeys[keyIndex]

      // 显示详细信息
      showKeyDetail(key)
    }
  }
}

// 显示密钥详细信息
function showKeyDetail(key) {
  showModal({
    title: '密钥详细信息',
    message: `余额: ${key.balance || 0}\n添加时间: ${new Date(key.added).toLocaleString()}${
      key.lastUpdated ? '\n最后更新: ' + new Date(key.lastUpdated).toLocaleString() : ''
    }${key.lastError ? '\n错误: ' + key.lastError : ''}`,
    confirmText: '复制密钥',
    callback: () => {
      navigator.clipboard
        .writeText(key.key)
        .then(() => showToast('密钥已复制到剪贴板'))
        .catch(() => showToast('复制失败', true))
    },
  })
}

// 更新余额统计信息
function updateBalanceStats(keys) {
  // 过滤有效键（余额大于0）
  const validBalances = keys.map(k => parseFloat(k.balance) || 0).filter(balance => balance > 0)

  if (validBalances.length > 0) {
    // 计算最大值、最小值、中位数和总和
    const max = Math.max(...validBalances)
    const min = Math.min(...validBalances)
    const total = validBalances.reduce((sum, b) => sum + b, 0)

    // 计算中位数
    const sorted = [...validBalances].sort((a, b) => a - b)
    let median
    if (sorted.length % 2 === 0) {
      // 偶数个，取中间两个值的平均
      median = (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    } else {
      // 奇数个，取中间值
      median = sorted[Math.floor(sorted.length / 2)]
    }

    // 更新显示
    document.getElementById('max-balance').textContent = max.toFixed(2)
    document.getElementById('min-balance').textContent = min.toFixed(2)
    document.getElementById('median-balance').textContent = median.toFixed(2)
    document.getElementById('total-balance').textContent = total.toFixed(2)
  } else {
    // 没有有效数据
    document.getElementById('max-balance').textContent = '0.00'
    document.getElementById('min-balance').textContent = '0.00'
    document.getElementById('median-balance').textContent = '0.00'
    document.getElementById('total-balance').textContent = '0.00'
  }
}

// 设置图表切换事件
document.addEventListener('DOMContentLoaded', function () {
  // 初始化图表范围选择器
  const rangeSelector = document.getElementById('trend-range')
  if (rangeSelector) {
    rangeSelector.addEventListener('change', function () {
      // 更新余额趋势图
      loadChartData()
    })
  }

  // 初始化图表周期选择器
  const periodSelector = document.getElementById('chart-period')
  if (periodSelector) {
    periodSelector.addEventListener('change', function () {
      // 更新所有图表
      loadChartData()
    })
  }

  // 初始化趋势图显示切换按钮
  const trendViewToggle = document.getElementById('toggle-trend-view')
  if (trendViewToggle) {
    trendViewToggle.addEventListener('click', function () {
      // 切换异常值显示
      if (balanceTrendChart) {
        const hideOutliers = !balanceTrendChart.options.scales.y.max

        if (hideOutliers) {
          // 计算一个合理的最大值 (去除异常值)
          const data = balanceTrendChart.data.datasets[0].data
          const sortedData = [...data].sort((a, b) => a - b)
          const q3Index = Math.floor(sortedData.length * 0.75)
          const q3 = sortedData[q3Index]
          const maxNormal = q3 * 2 // 一个简单的启发式计算正常范围的最大值

          balanceTrendChart.options.scales.y.max = maxNormal
          trendViewToggle.textContent = '显示异常值'
        } else {
          // 恢复自动缩放
          balanceTrendChart.options.scales.y.max = undefined
          trendViewToggle.textContent = '隐藏异常值'
        }

        balanceTrendChart.update()
      }
    })
  }
})

async function loadStats() {
  try {
    const response = await fetch('/admin/api/keys')
    if (!response.ok) throw new Error('加载密钥失败')

    const result = await response.json()
    if (result.success) {
      const keys = result.data

      // 计算统计数据
      const totalKeys = keys.length
      const validKeys = keys.filter(k => k.balance > 0).length
      const invalidKeys = totalKeys - validKeys

      // 修正计算平均余额的方式
      const validBalances = keys.map(k => parseFloat(k.balance) || 0).filter(balance => balance > 0)

      const avgBalance =
        validBalances.length > 0 ? (validBalances.reduce((a, b) => a + b, 0) / validBalances.length).toFixed(2) : '0.00'

      // 更新UI
      document.getElementById('total-keys-stat').textContent = totalKeys
      document.getElementById('valid-keys-stat').textContent = validKeys
      document.getElementById('invalid-keys-stat').textContent = invalidKeys
      document.getElementById('avg-balance-stat').textContent = avgBalance
    }
  } catch (error) {
    console.error('加载统计数据时出错:', error)
    showToast('加载统计数据失败', true)
  }
}

async function loadRecentKeys() {
  try {
    const response = await fetch('/admin/api/keys')
    if (!response.ok) throw new Error('加载密钥失败')

    const result = await response.json()
    if (result.success) {
      const keys = result.data

      // 按添加时间排序（最新的在前面）并获取前5个
      const recentKeys = [...keys].sort((a, b) => new Date(b.added) - new Date(a.added)).slice(0, 5)

      const tableBody = document.querySelector('#recent-keys-table tbody')

      if (recentKeys.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="empty-state">暂无数据</td></tr>'
        return
      }

      let html = ''
      recentKeys.forEach(key => {
        const addedDate = new Date(key.added).toLocaleString()
        const balance = parseFloat(key.balance) || 0

        // 检查是否有错误信息或余额不足
        let statusHtml = '<td><span class="admin-normal-status">正常</span></td>'
        if (balance <= 0 || key.lastError) {
          const errorMsg = key.lastError || (balance <= 0 ? '余额不足' : '未知错误')
          statusHtml = `<td>
                  <span class="tooltip">
                    <span style="color: #e74c3c;">错误</span>
                    <span class="tooltip-text">${errorMsg}</span>
                  </span>
                </td>`
        }

        html += `
                <tr>
                  <td class="key-column">${key.key}</td>
                  <td>${key.balance || 0}</td>
                  <td>${addedDate}</td>
                  ${statusHtml}
                </tr>
              `
      })

      tableBody.innerHTML = html
    }
  } catch (error) {
    console.error('加载最近密钥时出错:', error)
    const tableBody = document.querySelector('#recent-keys-table tbody')
    tableBody.innerHTML = '<tr><td colspan="4" class="empty-state">加载失败</td></tr>'
  }
}

// 密钥管理功能
async function loadAllKeys() {
  try {
    const response = await fetch('/admin/api/keys')
    if (!response.ok) throw new Error('加载密钥失败')

    const result = await response.json()
    if (result.success) {
      const keys = result.data

      const tableBody = document.querySelector('#all-keys-table tbody')

      if (keys.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="empty-state">暂无API Keys</td></tr>'
        return
      }

      // 应用排序逻辑
      const sortedKeys = sortKeys(keys, currentSortField, currentSortOrder)

      // 更新表头以支持排序
      const tableHeader = document.querySelector('#all-keys-table thead tr')
      tableHeader.innerHTML = `
              <th width="50px">序号</th>
              <th width="30px"><input type="checkbox" id="select-all-table"></th>
              <th>API Key</th>
              <th class="sort-header" data-sort="balance">
                余额
                <span class="sort-icon" id="sort-balance">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sort-arrow"><path d="M7 10l5 5 5-5"></path></svg>
                </span>
              </th>
              <th class="sort-header" data-sort="lastUpdated">
                最后更新时间
                <span class="sort-icon" id="sort-lastUpdated">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sort-arrow"><path d="M7 10l5 5 5-5"></path></svg>
                </span>
              </th>
              <th class="sort-header" data-sort="added">
                添加时间
                <span class="sort-icon" id="sort-added">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sort-arrow"><path d="M7 10l5 5 5-5"></path></svg>
                </span>
              </th>
              <th>状态</th>
              <th>操作</th>
            `

      // 更新排序图标状态
      updateSortIcons()

      // 为表头添加事件
      document.querySelectorAll('.sort-header').forEach(header => {
        header.addEventListener('click', () => {
          const sortField = header.getAttribute('data-sort')

          // 如果点击当前排序列，切换排序顺序
          if (sortField === currentSortField) {
            currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc'
          } else {
            // 如果点击新列，设置为新排序字段并默认降序
            currentSortField = sortField
            currentSortOrder = 'desc'
          }

          // 更新排序图标并重新加载数据
          loadAllKeys()
        })
      })

      let html = ''
      sortedKeys.forEach((key, index) => {
        // 序号从1开始
        const rowNumber = index + 1

        // 使用最后更新时间，如果没有则使用添加时间
        const updateTime = key.lastUpdated ? new Date(key.lastUpdated) : new Date(key.added)
        const timeLabel = key.lastUpdated ? '更新于' : '添加于'
        const displayTime = updateTime.toLocaleString()

        // 添加时间格式化
        const addedTime = new Date(key.added).toLocaleString()

        // 检查是否在选中集合中
        const isChecked = selectedKeys.has(key.key) ? 'checked' : ''

        // 检查余额是否为负数或0，或者有错误信息
        const balance = parseFloat(key.balance) || 0
        let statusHtml = ''

        if (balance <= 0 || key.lastError) {
          // 确定显示的错误消息
          const errorMsg = key.lastError || (balance <= 0 ? '余额不足' : '未知错误')
          statusHtml = `<td>
                  <span class="tooltip">
                    <span style="color: #e74c3c;">错误</span>
                    <span class="tooltip-text">${errorMsg}</span>
                  </span>
                </td>`
        } else {
          statusHtml = '<td><span class="admin-normal-status">正常</span></td>'
        }

        html += `
              <tr data-key="${key.key}" class="${isChecked ? 'selected-row' : ''}">
                  <td class="row-number">${rowNumber}</td>
                  <td><input type="checkbox" class="key-selector" data-key="${key.key}" ${isChecked}></td>
                  <td class="key-column">${key.key}</td>
                  <td>${key.balance || 0}</td>
                  <td><small>${timeLabel} ${displayTime}</small></td>
                  <td><small>${addedTime}</small></td>
                  ${statusHtml}
                  <td class="actions-column">
                    <span class="action-icon check" title="检测余额" onclick="checkKeyBalance('${key.key}')">⟳</span>
                    <span class="action-icon delete" title="删除" onclick="deleteKey('${key.key}')">🗑️</span>
                  </td>
              </tr>
              `
      })

      tableBody.innerHTML = html

      // 添加事件监听器
      attachKeySelectors()
      updateSelectionStatus()
    }
  } catch (error) {
    console.error('加载所有密钥时出错:', error)
    const tableBody = document.querySelector('#all-keys-table tbody')
    tableBody.innerHTML = '<tr><td colspan="8" class="empty-state">加载失败</td></tr>'
  }
}

// 添加多选框事件监听器
function attachKeySelectors() {
  // 为每个密钥选择器添加事件
  document.querySelectorAll('.key-selector').forEach(checkbox => {
    checkbox.addEventListener('change', function () {
      const key = this.getAttribute('data-key')
      const row = this.closest('tr')

      if (this.checked) {
        selectedKeys.add(key)
        row.classList.add('selected-row')
      } else {
        selectedKeys.delete(key)
        row.classList.remove('selected-row')
      }

      updateSelectionStatus()
    })
  })

  // 表头全选/取消全选功能
  document.getElementById('select-all-table').addEventListener('change', function () {
    const checkboxes = document.querySelectorAll('.key-selector')
    checkboxes.forEach(cb => {
      cb.checked = this.checked
      const key = cb.getAttribute('data-key')
      const row = cb.closest('tr')

      if (this.checked) {
        selectedKeys.add(key)
        row.classList.add('selected-row')
      } else {
        selectedKeys.delete(key)
        row.classList.remove('selected-row')
      }
    })

    updateSelectionStatus()
  })

  // 行选择功能 - 点击行也可以选择
  document.querySelectorAll('#all-keys-table tbody tr').forEach(row => {
    row.addEventListener('click', function (e) {
      // 忽略操作按钮的点击
      if (e.target.closest('.action-icon') || e.target.type === 'checkbox') {
        return
      }

      // 切换选择状态
      const checkbox = this.querySelector('.key-selector')
      checkbox.checked = !checkbox.checked

      // 触发change事件
      const event = new Event('change')
      checkbox.dispatchEvent(event)
    })
  })
}

// 更新选择状态显示
function updateSelectionStatus() {
  const count = selectedKeys.size
  document.getElementById('selection-count').textContent = `已选择 ${count} 个 Key`

  // 设置批量操作按钮状态
  document.getElementById('check-selected-keys').disabled = count === 0
  document.getElementById('delete-selected-keys').disabled = count === 0

  // 设置全选框状态
  const allCheckboxes = document.querySelectorAll('.key-selector')
  const allChecked = allCheckboxes.length > 0 && count === allCheckboxes.length
  document.getElementById('select-all-table').checked = allChecked
  document.getElementById('select-all-keys').checked = allChecked
}

// 处理批量检测密钥余额
async function batchCheckSelectedKeys() {
  const processedKeysSet = new Set() // 用于跟踪已经处理过的密钥

  // 如果没有选择任何密钥，直接返回
  if (selectedKeys.size === 0) {
    showToast('请选择至少一个API Key', true)
    return
  }

  // 获取配置
  const intervalType = document.getElementById('interval-type').value
  const minInterval = parseInt(document.getElementById('min-interval').value) || 500
  const maxInterval = parseInt(document.getElementById('max-interval').value) || 1500
  const retryCount = parseInt(document.getElementById('retry-count').value) || 1
  const retryInterval = parseInt(document.getElementById('retry-interval').value) || 2000

  // 获取固定间隔秒数并转换为毫秒
  const fixedIntervalSeconds = parseFloat(document.getElementById('concurrency').value) || 1
  const fixedInterval = Math.max(0, Math.round(fixedIntervalSeconds * 1000)) // 保证非负

  // 确保最小间隔不大于最大间隔，可取0s
  const effectiveMinInterval = Math.max(0, minInterval)
  if (minInterval > maxInterval) {
    showToast('最小间隔不能大于最大间隔', true)
    return
  }

  try {
    // 准备进度显示
    showProgress('批量检测密钥余额')

    // 将选中的密钥转换为数组
    const keysToCheck = Array.from(selectedKeys)
    const total = keysToCheck.length

    let processed = 0
    let successful = 0
    let failed = 0
    let startTime = Date.now()

    // 创建任务队列
    const queue = [...keysToCheck]
    const running = new Set() // 用于跟踪当前运行的任务
    const results = new Map() // 存储结果

    // 更新进度显示
    function updateProgressDisplay() {
      const percentComplete = Math.floor((processed / total) * 100)
      const elapsed = Date.now() - startTime
      const speed = processed > 0 ? elapsed / processed : 0 // 每个key平均处理时间(ms)
      const remaining = (total - processed) * speed // 估计剩余时间(ms)

      // 更新进度条
      updateProgress(processed, total, successful)

      // 格式化剩余时间，精确到秒
      const remainingText = formatTime(remaining)
      const elapsedText = formatTime(elapsed)

      // 格式化速度
      const speedText = (speed / 1000).toFixed(2) + '秒/项'

      // 更新详细信息
      document.getElementById('progress-speed').textContent = speedText
      document.getElementById('progress-eta').textContent = remainingText
      document.getElementById('progress-elapsed').textContent = elapsedText

      // 更新表格行状态
      results.forEach((result, key) => {
        const row = document.querySelector(`tr[data-key="${key}"]`)
        if (row) {
          // 更新余额
          row.querySelector('td:nth-child(4)').textContent = result.balance || 0

          // 更新时间
          const updateTime = result.lastUpdated
            ? new Date(result.lastUpdated).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false, // 使用24小时制
              })
            : new Date().toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false, // 使用24小时制
              })

          row.querySelector('td:nth-child(5)').innerHTML = `<small>更新于 ${updateTime}</small>`

          // 更新状态 - 判断是否成功且余额大于0
          if (result.success && result.balance > 0) {
            row.querySelector('td:nth-child(7)').innerHTML = '<span class="admin-normal-status">正常</span>'
          } else {
            row.querySelector('td:nth-child(7)').innerHTML = `
                    <span class="tooltip">
                      <span style="color: #e74c3c;">错误</span>
                      <span class="tooltip-text">${result.message || '未知错误'}</span>
                    </span>
                  `
          }
        }
      })
    }

    // 添加时间格式化函数
    function formatTime(milliseconds) {
      if (isNaN(milliseconds) || milliseconds <= 0) {
        return '计算中...'
      }

      const seconds = Math.floor(milliseconds / 1000)

      if (seconds < 60) {
        return `${seconds}秒`
      } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        return `${minutes}分${remainingSeconds}秒`
      } else {
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        const remainingSeconds = seconds % 60
        return `${hours}小时${minutes}分${remainingSeconds}秒`
      }
    }

    const pendingTimeUpdates = [] // 用于收集需要更新的时间

    // 处理单个键
    async function processKey(key, attempts = 0) {
      try {
        // 如果密钥已处理，直接返回，不重复计算进度
        if (processedKeysSet.has(key)) {
          return
        }

        running.add(key)
        // 标记该密钥已被处理
        processedKeysSet.add(key)

        const response = await fetch('/admin/api/update-key-balance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key }),
        })

        if (!response.ok) throw new Error('检测余额失败')

        const result = await response.json()

        // 收集时间更新信息
        if (result.success) {
          pendingTimeUpdates.push({
            key,
            lastUpdated: result.lastUpdated || new Date().toISOString(),
          })
        }

        // 保存结果
        results.set(key, result)
        processed++

        if (result.success) {
          successful++
        } else {
          failed++
        }

        running.delete(key)
        updateProgressDisplay()

        return result
      } catch (error) {
        console.error(`检测密钥${key}时出错:`, error)

        // 重试逻辑
        if (attempts < retryCount) {
          console.log(`重试密钥${key}, 尝试次数: ${attempts + 1}/${retryCount}`)
          await new Promise(resolve => setTimeout(resolve, retryInterval))
          return processKey(key, attempts + 1)
        }

        // 重试失败，标记为错误
        results.set(key, {
          success: false,
          balance: 0,
          message: `检测失败: ${error.message}`,
        })

        // 即使出错也要标记为已处理，避免重复计算
        if (!processedKeysSet.has(key)) {
          processedKeysSet.add(key)
          processed++ // 仍然计入已处理数量
          failed++
        }

        running.delete(key)
        updateProgressDisplay()

        return { success: false, message: error.message }
      }
    }

    // 串行处理所有密钥
    for (let i = 0; i < keysToCheck.length; i++) {
      // 检查是否收到停止信号
      if (isBatchProcessingStopped) {
        hideProgress()
        showToast(`批量检测已停止！已完成: ${processed}/${total}`)
        return
      }

      // 获取请求延迟时间
      let delay
      if (i > 0) {
        // 第一个请求不需要延迟
        const intervalType = document.getElementById('interval-type').value
        const effectiveMinInterval = Math.max(500, parseInt(document.getElementById('min-interval').value) || 500)
        const maxInterval = parseInt(document.getElementById('max-interval').value) || 1500

        // 根据间隔类型计算延迟
        if (intervalType === 'fixed') {
          const fixedIntervalSeconds = parseFloat(document.getElementById('concurrency').value) || 1
          delay = Math.max(500, Math.round(fixedIntervalSeconds * 1000))
        } else {
          delay = Math.floor(Math.random() * (maxInterval - effectiveMinInterval + 1)) + effectiveMinInterval
        }

        // 在处理下一个密钥前添加延迟
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      // 处理当前密钥
      const key = keysToCheck[i]
      await processKey(key)
    }

    // 处理完成
    setTimeout(() => {
      hideProgress()
      showToast(`批量检测完成！成功: ${successful}, 失败: ${failed}`)
    }, 1000)
  } catch (error) {
    hideProgress()
    console.error('批量检测失败:', error)
    showToast(`批量检测失败: ${error.message}`, true)
  }
}

// 批量删除选中的密钥
function batchDeleteSelectedKeys() {
  if (selectedKeys.size === 0) {
    showToast('请选择至少一个API Key', true)
    return
  }

  confirmDialog(
    `确定要删除这些API Key吗？此操作不可撤销，将删除 ${selectedKeys.size} 个密钥。`,
    async confirmed => {
      if (!confirmed) return

      try {
        showProgress('正在批量删除密钥')

        const keysToDelete = Array.from(selectedKeys)
        const total = keysToDelete.length
        let processed = 0
        let successful = 0

        for (const key of keysToDelete) {
          try {
            const response = await fetch('/admin/api/delete-key', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ key }),
            })

            if (!response.ok) throw new Error('删除失败')

            const result = await response.json()
            if (result.success) {
              successful++
              selectedKeys.delete(key) // 从选中集合中移除
            }
          } catch (error) {
            console.error(`删除密钥 ${key} 失败:`, error)
          } finally {
            processed++
            updateProgress(processed, total, successful)
          }

          // 添加短暂延迟避免请求过快
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        // 重新加载数据
        setTimeout(() => {
          hideProgress()
          loadAllKeys()
          setTimeout(loadDashboard, 500)
          showToast(`成功删除 ${successful} 个API Key`)
          updateSelectionStatus() // 更新选择状态
        }, 1000)
      } catch (error) {
        hideProgress()
        console.error('批量删除失败:', error)
        showToast(`批量删除失败: ${error.message}`, true)
      }
    },
    {
      confirmClass: 'danger',
      confirmText: '批量删除',
      title: '批量删除确认',
    }
  )
}

// 检测单个密钥余额的函数
window.checkKeyBalance = async function (key) {
  const rows = document.querySelectorAll('#all-keys-table tbody tr')
  let targetRow

  // 找到对应的行
  rows.forEach(row => {
    const keyCell = row.querySelector('.key-column')
    if (keyCell && keyCell.textContent === key) {
      targetRow = row
    }
  })

  if (!targetRow) return

  // 序号td:nth-child(1), 复选框td:nth-child(2), API Key td:nth-child(3)
  // 余额td:nth-child(4), 最后更新时间td:nth-child(5), 添加时间td:nth-child(6), 状态td:nth-child(7)
  const balanceCell = targetRow.querySelector('td:nth-child(4)')
  const timeCell = targetRow.querySelector('td:nth-child(5)')
  const statusCell = targetRow.querySelector('td:nth-child(7)')

  if (!balanceCell || !timeCell || !statusCell) return

  // 显示加载中状态
  const originalBalanceText = balanceCell.textContent
  const originalStatusHtml = statusCell.innerHTML
  const originalTimeHtml = timeCell.innerHTML

  balanceCell.innerHTML = '<span class="loader" style="border-top-color: #3498db;"></span> 检测中'
  statusCell.innerHTML = '<span style="color: #3498db;">检测中...</span>'

  try {
    const response = await fetch('/admin/api/update-key-balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    })

    if (!response.ok) throw new Error('检测余额失败')

    const result = await response.json()
    const updateTime = result.lastUpdated ? new Date(result.lastUpdated).toLocaleString() : new Date().toLocaleString()

    // 更新时间
    timeCell.innerHTML = `<small>更新于 ${updateTime}</small>`

    // 判断余额是否有效（大于0）
    const balance = parseFloat(result.balance) || 0
    balanceCell.textContent = balance

    if (result.success && balance > 0) {
      // 余额正常
      statusCell.innerHTML = '<span class="admin-normal-status">正常</span>'
      showToast('余额检测成功')
    } else {
      // API成功但余额为0或负数，也视为错误
      const errorMsg = result.message || (balance <= 0 ? '余额不足' : '未知错误')
      statusCell.innerHTML = `
              <span class="tooltip">
                <span style="color: #e74c3c;">错误</span>
                <span class="tooltip-text">${errorMsg}</span>
              </span>
            `
      showToast(errorMsg || '密钥余额不足', true)
    }
  } catch (error) {
    console.error('检测余额时出错:', error)
    balanceCell.textContent = originalBalanceText
    statusCell.innerHTML = originalStatusHtml
    timeCell.innerHTML = originalTimeHtml
    showToast('检测失败: ' + error.message, true)
  }
}

// 添加密钥
async function addKey() {
  const keyInput = document.getElementById('add-key-input')
  const key = keyInput.value.trim()

  if (!key) {
    showToast('请输入API Key', true)
    return
  }

  try {
    const response = await fetch('/admin/api/add-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    })

    if (!response.ok) throw new Error('添加密钥失败')

    const result = await response.json()
    if (result.success) {
      showToast('API Key添加成功，正在检测余额...')
      keyInput.value = ''

      // 添加成功后自动检测余额
      try {
        await fetch('/admin/api/update-key-balance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key }),
        })
        // 不管检测结果如何，都重新加载数据
      } catch (error) {
        console.error('添加后检测余额失败:', error)
      }

      loadAllKeys()
      setTimeout(loadDashboard, 500)
    } else {
      showToast(result.message || '添加失败', true)
    }
  } catch (error) {
    console.error('添加密钥时出错:', error)
    showToast('添加失败: ' + error.message, true)
  }
}

// 批量添加keys
async function addBulkKeys() {
  const textarea = document.getElementById('bulk-keys-input')
  const keysText = textarea.value.trim()

  if (!keysText) {
    showToast('请输入API Keys', true)
    return
  }

  try {
    const response = await fetch('/admin/api/add-keys-bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: keysText }),
    })

    if (!response.ok) throw new Error('添加密钥失败')

    const result = await response.json()
    if (result.success) {
      showToast(`成功添加 ${result.count} 个API Keys，正在检测余额...`)
      textarea.value = ''

      // 获取添加的密钥列表
      const keysArray = keysText
        .split('\n')
        .map(k => k.trim())
        .filter(k => k)

      // 为每个新添加的密钥单独检测余额
      for (const key of keysArray) {
        try {
          await fetch('/admin/api/update-key-balance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key }),
          })
          // 添加短暂延迟，防止API限流
          await new Promise(resolve => setTimeout(resolve, 200))
        } catch (error) {
          console.error(`检测密钥 ${key} 余额失败:`, error)
        }
      }

      // 重新加载界面数据
      loadAllKeys()
      setTimeout(loadDashboard, 500)
    } else {
      showToast(result.message || '批量添加失败', true)
    }
  } catch (error) {
    console.error('批量添加密钥时出错:', error)
    showToast('批量添加失败: ' + error.message, true)
  }
}

// 全局删除密钥函数
window.deleteKey = async function (key) {
  confirmDialog(
    '确定要删除这个API Key吗？',
    async confirmed => {
      if (!confirmed) return

      try {
        const response = await fetch('/admin/api/delete-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key }),
        })

        if (!response.ok) throw new Error('删除密钥失败')

        const result = await response.json()
        if (result.success) {
          showToast('API Key已删除')
          loadAllKeys()
          setTimeout(loadDashboard, 500)
        } else {
          showToast(result.message || '删除失败', true)
        }
      } catch (error) {
        console.error('删除密钥时出错:', error)
        showToast('删除失败: ' + error.message, true)
      }
    },
    {
      confirmClass: 'danger',
      confirmText: '删除',
    }
  )
}

// 增强批量操作面板的视觉反馈
function enhanceBatchConfigPanelVisibility() {
  const configPanel = document.getElementById('batch-config-panel')
  const toggleBtn = document.getElementById('toggle-batch-config')

  // 初始状态检查
  if (configPanel.classList.contains('show')) {
    toggleBtn.classList.add('active')
    toggleBtn.querySelector('span').textContent = '点击收起'
  } else {
    toggleBtn.classList.remove('active')
    toggleBtn.querySelector('span').textContent = '高级设置'
  }

  // 添加过渡结束事件监听器
  configPanel.addEventListener('transitionend', function (e) {
    if (e.propertyName === 'max-height') {
      if (!configPanel.classList.contains('show')) {
        configPanel.style.overflow = 'hidden'
      } else {
        configPanel.style.overflow = 'visible'
      }
    }
  })
}

// 设置功能
async function loadSettings(attempts = 3) {
  try {
    // 添加一个随机参数防止缓存
    const timestamp = new Date().getTime()
    const response = await fetch(`/admin/api/config?_=${timestamp}`, {
      // 添加超时处理
      signal: AbortSignal.timeout(10000), // 10秒超时
    })

    if (!response.ok) {
      throw new Error(`加载配置失败: 状态码 ${response.status}`)
    }

    const result = await response.json()
    if (result.success) {
      const config = result.data
      document.getElementById('api-key-input').value = config.apiKey || ''
      document.getElementById('admin-username-input').value = config.adminUsername || ''
      document.getElementById('admin-password-input').value = '' // 不预填密码
      document.getElementById('page-size-input').value = config.pageSize || 10
      // 设置访问控制选项
      const accessControlSelect = document.getElementById('access-control-select')
      accessControlSelect.value = config.accessControl || 'open'
      // 显示/隐藏访客密码输入框
      toggleGuestPasswordField(accessControlSelect.value)

      // 预填访客密码（如果存在）
      if (config.guestPassword) {
        document.getElementById('guest-password-input').value = '' // 出于安全考虑，不预填真实密码
        document.getElementById('guest-password-input').placeholder = '已设置访客密码 (不显示)'
      } else {
        document.getElementById('guest-password-input').placeholder = '设置访客密码'
      }
    } else {
      throw new Error(result.message || '未知错误')
    }
  } catch (error) {
    console.error('加载设置时出错:', error)

    // 如果还有重试次数，尝试重试
    if (attempts > 0) {
      console.log(`尝试重新加载设置，剩余尝试次数: ${attempts - 1}`)
      await new Promise(resolve => setTimeout(resolve, 1000)) // 等待1秒再重试
      return loadSettings(attempts - 1)
    }

    // 显示错误提示
    showToast(`加载设置失败: ${error.message}`, true)
  }
}

// 根据访问控制模式显示/隐藏访客密码字段
function toggleGuestPasswordField(mode) {
  const guestPasswordGroup = document.getElementById('guest-password-group')
  guestPasswordGroup.style.display = mode === 'restricted' ? 'block' : 'none'
}

// 排序辅助函数
function sortKeys(keys, field, order) {
  return [...keys].sort((a, b) => {
    let valueA, valueB

    // 根据字段类型获取对应的值
    switch (field) {
      case 'balance':
        valueA = parseFloat(a.balance) || 0
        valueB = parseFloat(b.balance) || 0
        break
      case 'lastUpdated':
        // 如果没有lastUpdated，则使用added时间
        valueA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : new Date(a.added).getTime()
        valueB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : new Date(b.added).getTime()
        break
      case 'added':
      default:
        valueA = new Date(a.added).getTime()
        valueB = new Date(b.added).getTime()
        break
    }

    // 应用排序方向
    return order === 'asc'
      ? valueA - valueB // 升序
      : valueB - valueA // 降序
  })
}

// 更新排序图标状态
function updateSortIcons() {
  document.querySelectorAll('.sort-icon').forEach(icon => {
    icon.classList.remove('active', 'asc', 'desc')
  })

  const activeIcon = document.getElementById(`sort-${currentSortField}`)
  if (activeIcon) {
    activeIcon.classList.add('active', currentSortOrder)
  }
}

async function saveSettings(event) {
  // 阻止表单默认提交
  if (event) event.preventDefault()

  const apiKey = document.getElementById('api-key-input').value.trim()
  const adminUsername = document.getElementById('admin-username-input').value.trim()
  const adminPassword = document.getElementById('admin-password-input').value.trim()
  const pageSize = parseInt(document.getElementById('page-size-input').value) || 10
  const accessControl = document.getElementById('access-control-select').value
  const guestPassword = document.getElementById('guest-password-input').value

  const config = {}
  if (apiKey) config.apiKey = apiKey
  if (adminUsername) config.adminUsername = adminUsername
  if (adminPassword) config.adminPassword = adminPassword
  if (pageSize) config.pageSize = pageSize

  // 添加访问控制设置
  config.accessControl = accessControl

  // 只有在有值或模式为restricted时设置访客密码
  if (accessControl === 'restricted') {
    // 如果密码字段非空，则更新密码
    if (guestPassword) {
      config.guestPassword = guestPassword
    }
    // 否则保持原密码不变
  } else {
    // 其他模式下，显式设置为空字符串
    config.guestPassword = ''
  }

  try {
    const response = await fetch('/admin/api/update-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })

    if (!response.ok) throw new Error('更新配置失败')

    const result = await response.json()
    if (result.success) {
      showToast('设置已保存')
      document.getElementById('admin-password-input').value = ''
    } else {
      showToast(result.message || '保存设置失败', true)
    }
  } catch (error) {
    console.error('保存设置时出错:', error)
    showToast('保存设置失败: ' + error.message, true)
  }
}

// 停止批量处理函数
function stopBatchProcessing() {
  isBatchProcessingStopped = true
  showToast('正在停止批量检测，请等待当前任务完成...')
  document.getElementById('stop-batch-process').disabled = true
  document.getElementById('stop-batch-process').textContent = '正在停止...'
}

// 进度条控制函数
function showProgress(title) {
  const container = document.getElementById('progress-container')
  const titleElement = container.querySelector('.progress-title')
  const progressFill = document.getElementById('progress-fill')
  const progressText = document.getElementById('progress-text')
  const successRate = document.getElementById('progress-success-rate')

  // 重置停止标记
  isBatchProcessingStopped = false

  titleElement.textContent = title || '操作进行中'
  progressFill.style.width = '0%'
  progressText.textContent = '0/0 (0%)'
  successRate.textContent = '成功: 0'

  container.classList.add('active')
}

// 更新进度函数
function updateProgress(current, total, success) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0
  const progressFill = document.getElementById('progress-fill')
  const progressText = document.getElementById('progress-text')
  const successRate = document.getElementById('progress-success-rate')

  progressFill.style.width = `${percent}%`
  progressText.textContent = `${current}/${total} (${percent}%)`
  successRate.textContent = `成功: ${success}`
}

function hideProgress() {
  const container = document.getElementById('progress-container')
  container.classList.remove('active')

  // 重置停止按钮状态
  const stopButton = document.getElementById('stop-batch-process')
  stopButton.disabled = false
  stopButton.textContent = '停止检测'

  // 重置停止标记
  isBatchProcessingStopped = false
}

// 更新所有密钥余额
async function updateAllBalances() {
  const btn = document.getElementById('update-balances-btn')
  const originalText = btn.textContent

  confirmDialog(
    '确定要更新所有密钥的余额吗？这可能需要几分钟时间完成。',
    async confirmed => {
      if (!confirmed) return

      btn.disabled = true
      btn.innerHTML = '<span class="loader"></span>更新中...'

      try {
        // 获取所有密钥并全选
        const response = await fetch('/admin/api/keys')
        if (!response.ok) throw new Error('获取密钥失败')

        const result = await response.json()
        if (!result.success) throw new Error('获取密钥数据失败')

        const allKeys = result.data

        if (allKeys.length === 0) {
          showToast('没有可更新的密钥')
          return
        }

        // 清除现有选择
        selectedKeys.clear()

        // 将所有密钥添加到选中集合
        allKeys.forEach(key => selectedKeys.add(key.key))

        // 更新选择状态UI
        updateSelectionStatus()

        // 调用批量检测功能
        await batchCheckSelectedKeys()

        // 更新完成后刷新仪表盘数据
        setTimeout(loadDashboard, 500)
      } catch (error) {
        hideProgress()
        showToast(`更新失败: ${error.message}`, true)
      } finally {
        btn.disabled = false
        btn.textContent = originalText
      }
    },
    {
      title: '更新所有密钥',
      confirmText: '开始更新',
      confirmClass: 'success',
    }
  )
}

// 关闭余额过滤模态框
function closeBalanceFilterModal() {
  document.getElementById('balance-filter-modal').classList.remove('show')
}

// 显示余额过滤模态框
function showBalanceFilterModal() {
  document.getElementById('balance-filter-modal').classList.add('show')
}

// 导出选中的密钥
function exportSelectedKeys() {
  if (selectedKeys.size === 0) {
    showToast('请先选择要导出的密钥', true)
    return
  }

  exportKeys(Array.from(selectedKeys), '已选密钥')
}

// 复制所选密钥
async function copySelectedKeys() {
  if (selectedKeys.size === 0) {
    showToast('请先选择要复制的密钥', true)
    return
  }

  try {
    // 获取分隔符
    const delimiter = getSelectedDelimiter()

    // 复制到剪贴板
    const keysText = Array.from(selectedKeys).join(delimiter)
    await navigator.clipboard.writeText(keysText)

    showToast(`成功复制 ${selectedKeys.size} 个密钥到剪贴板`)
  } catch (error) {
    console.error('复制所选密钥失败:', error)
    showToast(`复制失败: ${error.message}`, true)
  }
}

// 获取当前选择的分隔符
function getSelectedDelimiter() {
  const delimiterType = document.getElementById('delimiter-select').value

  switch (delimiterType) {
    case 'newline':
      return '\n'
    case 'comma':
      return ','
    case 'space':
      return ' '
    case 'semicolon':
      return ';'
    case 'tab':
      return '\\t'
    case 'custom':
      return document.getElementById('custom-delimiter').value || ',' // 默认逗号
    default:
      return '\n' // 默认换行符
  }
}

// 更新分隔符文本显示
function updateDelimiterDisplay() {
  const delimiterType = document.getElementById('delimiter-select').value
  const displayElement = document.getElementById('delimiter-display')
  const customDelimiterInput = document.getElementById('custom-delimiter')

  // 显示/隐藏自定义分隔符输入框
  if (delimiterType === 'custom') {
    customDelimiterInput.style.display = 'inline-block'
    customDelimiterInput.focus()

    // 为自定义分隔符添加change事件
    customDelimiterInput.onchange = function () {
      displayElement.textContent = `"${this.value}"`
    }

    // 显示当前自定义值
    const currentCustomValue = customDelimiterInput.value || ''
    displayElement.textContent = `"${currentCustomValue}"`
  } else {
    customDelimiterInput.style.display = 'none'

    // 显示选定的分隔符
    switch (delimiterType) {
      case 'newline':
        displayElement.textContent = '"\n"'
        break
      case 'comma':
        displayElement.textContent = '","'
        break
      case 'space':
        displayElement.textContent = '" "'
        break
      case 'semicolon':
        displayElement.textContent = '";"'
        break
      case 'tab':
        displayElement.textContent = '"\\t"'
        break
    }
  }
}

// 清除无效密钥
function clearInvalidKeys() {
  confirmDialog(
    '确定要删除所有无效密钥吗？此操作不可撤销。',
    async confirmed => {
      if (!confirmed) return

      try {
        // 获取所有密钥
        const response = await fetch('/admin/api/keys')
        if (!response.ok) throw new Error('获取密钥失败')

        const result = await response.json()
        if (!result.success) throw new Error('获取密钥失败')

        const keys = result.data
        const invalidKeys = keys.filter(k => k.balance <= 0 || k.lastError).map(k => k.key)

        if (invalidKeys.length === 0) {
          showToast('没有找到无效密钥')
          return
        }

        // 显示进度条
        showProgress('正在删除无效密钥')

        // 批量删除
        let processed = 0
        let successful = 0

        for (const key of invalidKeys) {
          try {
            const deleteResponse = await fetch('/admin/api/delete-key', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ key }),
            })

            if (deleteResponse.ok) {
              const deleteResult = await deleteResponse.json()
              if (deleteResult.success) successful++
            }
          } catch (e) {
            console.error(`删除密钥 ${key} 失败:`, e)
          } finally {
            processed++
            updateProgress(processed, invalidKeys.length, successful)

            // 添加短暂延迟避免请求过快
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }

        // 完成后重新加载数据
        setTimeout(() => {
          hideProgress()
          loadAllKeys()
          setTimeout(loadDashboard, 500)
          showToast(`成功删除 ${successful} 个无效密钥`)
        }, 1000)
      } catch (error) {
        hideProgress()
        console.error('清除无效密钥失败:', error)
        showToast(`操作失败: ${error.message}`, true)
      }
    },
    {
      confirmText: '删除无效密钥',
      confirmClass: 'danger',
    }
  )
}

// 导出所有有效密钥
async function exportValidKeys() {
  try {
    // 获取所有密钥
    const response = await fetch('/admin/api/keys')
    if (!response.ok) throw new Error('获取密钥失败')

    const result = await response.json()
    if (!result.success) throw new Error('获取密钥失败')

    const keys = result.data
    const validKeys = keys.filter(k => k.balance > 0 && !k.lastError).map(k => k.key)

    if (validKeys.length === 0) {
      showToast('没有找到有效密钥', true)
      return
    }

    exportKeys(validKeys, '有效密钥')
  } catch (error) {
    console.error('导出有效密钥失败:', error)
    showToast(`导出失败: ${error.message}`, true)
  }
}

// 导出高余额密钥
async function exportFilteredKeys() {
  try {
    // 获取最低余额阈值
    const minBalance = parseFloat(document.getElementById('min-balance-input').value) || 0
    const includeBalances = document.getElementById('include-balances').checked

    // 关闭模态框
    closeBalanceFilterModal()

    // 获取所有密钥
    const response = await fetch('/admin/api/keys')
    if (!response.ok) throw new Error('获取密钥失败')

    const result = await response.json()
    if (!result.success) throw new Error('获取密钥失败')

    const keys = result.data
    const filteredKeys = keys.filter(k => parseFloat(k.balance) >= minBalance && !k.lastError)

    if (filteredKeys.length === 0) {
      showToast(`没有找到余额高于 ${minBalance} 的密钥`, true)
      return
    }

    if (includeBalances) {
      // 导出格式: key|balance
      const keysWithBalances = filteredKeys.map(k => `${k.key}|${k.balance}`)
      exportKeys(keysWithBalances, `余额≥${minBalance}密钥`, true)
    } else {
      // 仅导出密钥
      const keysOnly = filteredKeys.map(k => k.key)
      exportKeys(keysOnly, `余额≥${minBalance}密钥`)
    }
  } catch (error) {
    console.error('导出高余额密钥失败:', error)
    showToast(`导出失败: ${error.message}`, true)
  }
}

// 复制所有密钥
async function copyAllKeys() {
  try {
    // 获取所有密钥
    const response = await fetch('/admin/api/keys')
    if (!response.ok) throw new Error('获取密钥失败')

    const result = await response.json()
    if (!result.success) throw new Error('获取密钥失败')

    const keys = result.data.map(k => k.key)

    if (keys.length === 0) {
      showToast('没有找到可复制的密钥', true)
      return
    }

    // 获取分隔符
    const delimiter = getSelectedDelimiter()

    // 复制到剪贴板
    const keysText = keys.join(delimiter)
    await navigator.clipboard.writeText(keysText)

    showToast(`成功复制 ${keys.length} 个密钥到剪贴板`)
  } catch (error) {
    console.error('复制所有密钥失败:', error)
    showToast(`复制失败: ${error.message}`, true)
  }
}

// 通用导出密钥函数
function exportKeys(keys, description, isFormatted = false) {
  if (!keys || keys.length === 0) {
    showToast('没有可导出的密钥', true)
    return
  }

  try {
    // 获取用户指定的分隔符
    const delimiter = getSelectedDelimiter()

    // 创建Blob对象
    const keysText = keys.join(delimiter)
    const blob = new Blob([keysText], { type: 'text/plain' })

    // 创建下载链接
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url

    // 设置文件名
    const date = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)
    const formattedType = isFormatted ? '(带余额)' : ''
    a.download = `siliconflow-${description}${formattedType}-${date}.txt` // 导出文件名

    // 模拟点击
    document.body.appendChild(a)
    a.click()

    // 清理
    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 100)

    showToast(`成功导出 ${keys.length} 个${description}`)
  } catch (error) {
    console.error('导出密钥失败:', error)
    showToast(`导出失败: ${error.message}`, true)
  }
}

// 添加隐藏进度条函数
window.hideProgress = hideProgress

// 事件监听器
document.addEventListener('DOMContentLoaded', () => {
  // 全局多选控件
  document.getElementById('select-all-keys').addEventListener('change', function () {
    const tableCheckbox = document.getElementById('select-all-table')
    tableCheckbox.checked = this.checked

    // 触发表格全选按钮的change事件
    const event = new Event('change')
    tableCheckbox.dispatchEvent(event)
  })

  // 显示/隐藏批量配置面板
  document.getElementById('toggle-batch-config').addEventListener('click', function () {
    const configPanel = document.getElementById('batch-config-panel')
    configPanel.classList.toggle('show')
    this.classList.toggle('active')

    // 使用平滑动画效果更新按钮文本
    const btnText = this.querySelector('span')
    const btnIcon = this.querySelector('svg')

    if (configPanel.classList.contains('show')) {
      // 配置面板显示状态
      btnIcon.style.transform = 'rotate(180deg)'
      btnText.textContent = '点击收起'

      // 平滑滚动到配置面板
      setTimeout(() => {
        configPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 100)
    } else {
      // 配置面板隐藏状态
      btnIcon.style.transform = 'rotate(0)'
      btnText.textContent = '高级设置'
    }
  })

  // 批量检测按钮
  document.getElementById('check-selected-keys').addEventListener('click', async () => {
    try {
      await batchCheckSelectedKeys()
    } catch (error) {
      console.error('批量检测出错:', error)
    }
  })
  // 批量删除按钮
  document.getElementById('delete-selected-keys').addEventListener('click', batchDeleteSelectedKeys)

  // 回车按钮检测
  const modalInput = document.getElementById('modal-input')
  modalInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      handleModalConfirm()
    }
  })

  // 仪表盘
  document.getElementById('refresh-stats-btn').addEventListener('click', loadDashboard)
  document.getElementById('update-balances-btn').addEventListener('click', updateAllBalances)

  // 密钥
  document.getElementById('add-key-btn').addEventListener('click', addKey)
  document.getElementById('add-bulk-keys-btn').addEventListener('click', addBulkKeys)

  // 按Enter键添加单个密钥
  document.getElementById('add-key-input').addEventListener('keypress', event => {
    if (event.key === 'Enter') {
      addKey()
    }
  })

  // 添加间隔类型切换逻辑
  const intervalTypeSelect = document.getElementById('interval-type')

  // 初始化输入框状态
  updateIntervalFields()

  // 监听间隔类型变化
  intervalTypeSelect.addEventListener('change', updateIntervalFields)

  function updateIntervalFields() {
    const intervalType = intervalTypeSelect.value
    const minIntervalInput = document.getElementById('min-interval')
    const maxIntervalInput = document.getElementById('max-interval')
    const fixedIntervalInput = document.getElementById('concurrency')

    if (intervalType === 'fixed') {
      // 启用固定间隔，禁用随机间隔
      fixedIntervalInput.disabled = false
      minIntervalInput.disabled = true
      maxIntervalInput.disabled = true

      // 视觉反馈
      fixedIntervalInput.style.opacity = '1'
      minIntervalInput.style.opacity = '0.5'
      maxIntervalInput.style.opacity = '0.5'
    } else {
      // 启用随机间隔，禁用固定间隔
      fixedIntervalInput.disabled = true
      minIntervalInput.disabled = false
      maxIntervalInput.disabled = false

      // 视觉反馈
      fixedIntervalInput.style.opacity = '0.5'
      minIntervalInput.style.opacity = '1'
      maxIntervalInput.style.opacity = '1'
    }
  }

  // 增强批量配置面板可见性
  enhanceBatchConfigPanelVisibility()

  // 下拉菜单控制
  const moreActionsBtn = document.getElementById('more-actions')
  const dropdownContent = document.querySelector('.dropdown-content')

  moreActionsBtn.addEventListener('click', e => {
    e.stopPropagation()
    dropdownContent.classList.toggle('show')

    // 添加或移除活跃状态样式
    moreActionsBtn.classList.toggle('active', dropdownContent.classList.contains('show'))
  })

  // 点击其他地方关闭下拉菜单
  document.addEventListener('click', e => {
    if (!moreActionsBtn.contains(e.target)) {
      dropdownContent.classList.remove('show')
      moreActionsBtn.classList.remove('active')
    }
  })

  // 导出选中密钥
  document.getElementById('export-selected-keys').addEventListener('click', exportSelectedKeys)

  // 清除无效密钥
  document.getElementById('clear-invalid-keys').addEventListener('click', clearInvalidKeys)

  // 导出有效密钥
  document.getElementById('export-valid-keys').addEventListener('click', exportValidKeys)

  // 导出高余额密钥
  document.getElementById('export-balance-keys').addEventListener('click', showBalanceFilterModal)

  // 复制所有密钥
  document.getElementById('copy-all-keys').addEventListener('click', copyAllKeys)

  // 复制所选密钥
  document.getElementById('copy-selected-keys').addEventListener('click', copySelectedKeys)

  // 导出过滤后的密钥按钮
  document.getElementById('export-filtered-keys').addEventListener('click', exportFilteredKeys)

  // 停止批量处理按钮点击事件
  document.getElementById('stop-batch-process').addEventListener('click', stopBatchProcessing)

  // 更新分隔符文本显示
  document.getElementById('delimiter-select').addEventListener('change', updateDelimiterDisplay)

  // 更新导出按钮状态
  function updateExportButtonState() {
    document.getElementById('export-selected-keys').disabled = selectedKeys.size === 0
  }

  // 初始化分隔符显示
  updateDelimiterDisplay()

  // 添加事件监听器
  document.getElementById('delimiter-select').addEventListener('change', updateDelimiterDisplay)
  document.getElementById('custom-delimiter').addEventListener('input', updateDelimiterDisplay)

  // 扩展更新选择状态函数
  const originalUpdateSelectionStatus = updateSelectionStatus
  window.updateSelectionStatus = function () {
    originalUpdateSelectionStatus()
    updateExportButtonState()
  }

  // 访问控制选择变化时
  document.getElementById('access-control-select').addEventListener('change', function () {
    toggleGuestPasswordField(this.value)
  })

  // 初始加载
  loadDashboard()
})
