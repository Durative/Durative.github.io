// Meilisearch 搜索功能 - 新基础版 (2026-03-26)
// 功能：输入文字触发搜索，发送请求到/search路径，下拉框正常显示
// 状态：本地开发返回404（无反向代理），生产环境需配置Nginx反向代理
// 修改：隐藏了所有搜索框图标（.site-search .search-icon 和 .meilisearch-icon）
(function() {
    'use strict';

    // Meilisearch 配置（从主题配置中读取）
    const config = {
        host: window.theme.meilisearch?.host || '',
        apiKey: window.theme.meilisearch?.apiKey || '',
        indexName: window.theme.meilisearch?.indexName || 'posts'
    };

    // DOM 元素
    const searchBox = document.querySelector('.meilisearch-box');
    const searchInput = document.querySelector('.meilisearch-input');
    const clearBtn = document.querySelector('.meilisearch-clear-btn');
    const searchBtn = document.querySelector('.meilisearch-btn');
    const searchSuggestions = document.querySelector('.meilisearch-suggestions');
    const suggestionsList = document.querySelector('.meilisearch-suggestion-list'); // 修正：去掉多余的's'
    const loadingIndicator = document.querySelector('.meilisearch-loading');
    const noResults = document.querySelector('.meilisearch-no-results');

    let searchTimeout = null;
    let isLoading = false;

    // 如果配置未设置，使用模拟数据
    const useMockData = !config.host;

    if (!searchBox || !searchInput) {
        console.warn('Meilisearch: 未找到搜索框元素');
        return;
    }

    // 事件监听
    searchInput.addEventListener('focus', () => {
        searchBox.classList.add('focused');
        // 聚焦时，如果有内容则显示下拉框
        if (searchInput.value.trim()) {
            showSuggestions();
        }
    });

    // 移除blur事件中的隐藏逻辑，使下拉框显示与鼠标位置无关
    searchInput.addEventListener('blur', () => {
        // 仅移除焦点样式，不隐藏下拉框（与鼠标位置无关）
        searchBox.classList.remove('focused');
    });

    searchInput.addEventListener('input', (e) => {
        const value = e.target.value.trim();

        if (value) {
            clearBtn.classList.add('visible');
            // 只要有内容就显示下拉框（需求1和3）
            showSuggestions();
            performSearch(value);
        } else {
            clearBtn.classList.remove('visible');
            // 内容为空时隐藏下拉框
            hideSuggestions();
        }
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.classList.remove('visible');
            hideSuggestions();
            searchInput.focus();
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const query = searchInput.value.trim();
            if (query) {
                performSearch(query);
            }
        });
    }

    // 快捷键监听
    document.addEventListener('keydown', (e) => {
        // Cmd/Ctrl + K 聚焦搜索框
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            searchInput.focus();
        }

        // Escape 清除搜索
        if (e.key === 'Escape' && document.activeElement === searchInput) {
            searchInput.value = '';
            if (clearBtn) clearBtn.classList.remove('visible');
            hideSuggestions();
            searchInput.blur();
        }
    });

    // 执行搜索
    async function performSearch(query) {
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

        searchTimeout = setTimeout(async () => {
            console.log('Meilisearch: 搜索触发 (内容:', query, ')');
            
            if (!query) {
                displayResults([]);
                return;
            }

            // 显示加载状态
            if (loadingIndicator) {
                loadingIndicator.classList.add('visible');
            }
            if (noResults) {
                noResults.classList.remove('visible');
            }

            try {
                console.log('Meilisearch: 调用API搜索');
                const searchResults = await searchMeilisearch(query);
                const results = searchResults.hits || [];
                console.log('Meilisearch: 搜索结果数量:', results.length);
                displayResults(results);
                
            } catch (error) {
                console.error('Meilisearch: 搜索失败:', error);
                // 即使API失败，也显示空结果，让用户知道搜索已执行
                displayResults([]);
            }
        }, 300);
    }

    // 搜索 Meilisearch
    async function searchMeilisearch(query) {
        console.log('Meilisearch: 开始搜索', query);
        
        const response = await fetch(`${config.host}/indexes/${config.indexName}/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // Authorization 头由 Nginx 反向代理自动添加，前端无需传递
            },
            body: JSON.stringify({
                q: query,
                limit: 10,
                attributesToRetrieve: ['*'],  // 获取所有字段
                attributesToHighlight: ['title', 'excerpt']
            })
        });

        if (!response.ok) {
            throw new Error('搜索请求失败');
        }

        const data = await response.json();
        console.log('Meilisearch: 搜索结果', data);
        
        return data.hits.map(hit => {
            // 生成文章 URL
            let url;
            
            // 检查所有可能的路径字段
            if (hit.path) {
                url = hit.path;
            } else if (hit.slug) {
                // 使用 slug 字段
                const dateObj = new Date(hit.date);
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const day = String(dateObj.getDate()).padStart(2, '0');
                url = `/${year}/${month}/${day}/${hit.slug}/`;
            } else if (hit.filename) {
                // 使用 filename 字段（去掉 .md 后缀）
                const dateObj = new Date(hit.date);
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const day = String(dateObj.getDate()).padStart(2, '0');
                const filename = hit.filename.replace(/\.md$/, '');
                url = `/${year}/${month}/${day}/${filename}/`;
            } else if (hit.date && hit.title) {
                // 根据 date 和 title 生成 URL（尝试匹配实际文件名）
                const dateObj = new Date(hit.date);
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const day = String(dateObj.getDate()).padStart(2, '0');
                
                // 尝试从标题中提取文件名（这是一个猜测，可能不准确）
                // 更好的方法是在 Meilisearch 索引中添加文件名字段
                const titleSlug = hit.title
                    .replace(/[^\w\s-]/g, '') // 移除特殊字符
                    .replace(/\s+/g, '-') // 空格替换为连字符
                    .replace(/-+/g, '-') // 多个连字符合并为一个
                    .trim();
                
                console.warn(`Meilisearch: 使用标题生成 URL（可能不准确）: ${titleSlug}`);
                url = `/${year}/${month}/${day}/${titleSlug}/`;
            } else {
                url = `#${encodeURIComponent(hit.title)}`;
            }

            const result = {
                id: hit.id,
                title: hit._formatted?.title || hit.title,
                excerpt: hit._formatted?.excerpt || hit.excerpt,
                date: hit.date,
                tags: hit.tags || [],
                url: url
            };
            
            console.log('Meilisearch: 处理后的结果', result);
            return result;
        });
    }

    // 模拟搜索（用于演示）
    async function mockSearch(query) {
        // 模拟网络延迟
        await new Promise(resolve => setTimeout(resolve, 500));

        // 模拟结果数据
        const mockData = [
            {
                id: 1,
                title: `${query} 相关文章 1`,
                excerpt: `这是一篇关于 ${query} 的详细教程，涵盖了基础知识和实战案例...`,
                date: '2026-03-20',
                tags: ['k8s', '容器'],
                url: `/#${encodeURIComponent(query + ' 相关文章 1')}`
            },
            {
                id: 2,
                title: `${query} 进阶指南`,
                excerpt: `深入学习 ${query} 的高级特性和最佳实践，提升你的技能...`,
                date: '2026-03-15',
                tags: ['开发', '教程'],
                url: `/#${encodeURIComponent(query + ' 进阶指南')}`
            },
            {
                id: 3,
                title: `${query} 问题排查`,
                excerpt: `解决 ${query} 使用过程中遇到的常见问题和错误...`,
                date: '2026-03-10',
                tags: ['实战', '问题解决'],
                url: `/#${encodeURIComponent(query + ' 问题排查')}`
            }
        ];

        return mockData;
    }

    // 显示搜索结果（简化版本，暂时不填充内容）
    function displayResults(results) {
        // 根据需求，下拉框中不需要填充内容，后续再加
        // 这里只确保下拉框显示，并隐藏加载和无结果状态
        if (loadingIndicator) loadingIndicator.classList.remove('visible');
        if (noResults) noResults.classList.remove('visible');
        if (suggestionsList) suggestionsList.innerHTML = '';
        
        // 下拉框已经在input事件中显示，这里不需要重复显示
    }

    // 高亮匹配文本
    function highlightText(text, query) {
        if (!text || !query) return text || '';
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<span class="meilisearch-highlight">$1</span>');
    }

    // 显示/隐藏建议
    function showSuggestions() {
        if (searchSuggestions) {
            searchSuggestions.classList.add('visible');
        }
    }

    function hideSuggestions() {
        if (searchSuggestions) {
            searchSuggestions.classList.remove('visible');
        }
    }

    // 加载状态
    function showLoading() {
        isLoading = true;
        if (loadingIndicator) loadingIndicator.classList.add('visible');
        if (noResults) noResults.classList.remove('visible');
    }

    function hideLoading() {
        isLoading = false;
        if (loadingIndicator) loadingIndicator.classList.remove('visible');
    }

    // 初始化
    console.log('Meilisearch: 搜索功能已加载');
    console.log('Meilisearch: 快捷键提示 - 按 Cmd/Ctrl + K 快速聚焦搜索框');

    if (useMockData) {
        console.warn('Meilisearch: 未配置 Meilisearch 连接，使用模拟数据');
        console.warn('Meilisearch: 请在主题配置中设置 host、apiKey 和 indexName');
    }
})();