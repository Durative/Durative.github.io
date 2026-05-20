/**
 * 博客增强功能 - TOC滚动高亮 + 搜索关键词高亮
 * 2026-05-20 by Mr.wolf
 */
(function () {
  'use strict';

  // ==================== TOC 滚动高亮当前章节 ====================
  function initTocHighlight() {
    const toc = document.querySelector('.toc');
    if (!toc) return;

    const tocLinks = toc.querySelectorAll('a');
    if (!tocLinks.length) return;

    const headings = [];
    tocLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (!href) return;
      const id = href.replace('#', '');
      const el = document.getElementById(id);
      if (el) headings.push({ el, link });
    });

    if (!headings.length) return;

    // 高亮当前 TOC 项
    function highlightCurrent() {
      const scrollTop = window.scrollY;
      const offset = 100; // 顶部偏移
      let current = headings[0];

      for (const h of headings) {
        if (h.el.offsetTop - offset <= scrollTop) {
          current = h;
        }
      }

      tocLinks.forEach(l => l.classList.remove('toc-active'));
      if (current) {
        current.link.classList.add('toc-active');
        // 自动展开父级
        let parent = current.link.parentElement;
        while (parent && parent !== toc) {
          if (parent.classList.contains('toc-child')) {
            parent.style.display = '';
          }
          parent = parent.parentElement;
        }
      }
    }

    // 节流
    let ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(function () {
          highlightCurrent();
          ticking = false;
        });
        ticking = true;
      }
    });

    highlightCurrent();
  }

  // ==================== 搜索关键词高亮 ====================
  function initSearchHighlight() {
    // 监听搜索结果渲染，在命中项中高亮关键词
    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          // 找到搜索结果中的标题
          const titles = node.querySelectorAll ? node.querySelectorAll('.meilisearch-hit-title, .meilisearch-suggestion-title') : [];
          titles.forEach(highlightElement);
          const descs = node.querySelectorAll ? node.querySelectorAll('.meilisearch-hit-desc, .meilisearch-suggestion-desc') : [];
          descs.forEach(highlightElement);
        });
      });
    });

    const suggestions = document.querySelector('.meilisearch-suggestions');
    if (suggestions) {
      observer.observe(suggestions, { childList: true, subtree: true });
    }
  }

  function highlightElement(el) {
    const text = el.textContent;
    const searchInput = document.querySelector('.meilisearch-input');
    if (!searchInput) return;
    const query = searchInput.value.trim();
    if (!query || query.length < 2) return;

    // 简单高亮：用 <mark> 包裹匹配文字
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('(' + escaped + ')', 'gi');
    if (regex.test(text)) {
      el.innerHTML = text.replace(regex, '<mark style="background:#fff3b0;color:#333;padding:0 2px;border-radius:2px">$1</mark>');
    }
  }

  // ==================== 阅读时间估算 ====================
  function initReadingTime() {
    const article = document.querySelector('.article-entry');
    if (!article) return;

    const text = article.textContent || '';
    const wordCount = text.replace(/\s+/g, '').length;
    const cpm = 300; // 中文每分钟阅读字数
    const minutes = Math.ceil(wordCount / cpm);

    // 在文章 meta 区域显示
    const readInfo = document.querySelector('.post-intro-read');
    if (readInfo && !readInfo.querySelector('.reading-time')) {
      const span = document.createElement('span');
      span.className = 'reading-time';
      span.innerHTML = '<i class="fas fa-clock" style="margin-right:0.2rem"></i>约 ' + minutes + ' 分钟';
      readInfo.appendChild(span);
    }
  }

  // ==================== 图片懒加载 ====================
  function initLazyLoad() {
    if ('loading' in HTMLImageElement.prototype) return; // 浏览器原生支持

    const images = document.querySelectorAll('img[data-src]');
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          observer.unobserve(img);
        }
      });
    });

    images.forEach(function (img) {
      observer.observe(img);
    });
  }

  // ==================== 初始化 ====================
  document.addEventListener('DOMContentLoaded', function () {
    initTocHighlight();
    initSearchHighlight();
    initReadingTime();
    initLazyLoad();
  });
})();
