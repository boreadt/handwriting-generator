/**
 * PDF编辑模块 - 支持导入PDF并在其上框选区域添加手写体文字
 */

// PDF编辑器状态
const pdfEditor = {
    pdfDoc: null,           // PDF文档对象
    currentPage: 1,         // 当前页码
    totalPages: 0,          // 总页数
    scale: 1.5,             // 渲染缩放比例
    regions: [],            // 所有页面的框选区域 [{pageNum, x, y, width, height, text}]
    isDrawing: false,       // 是否正在绘制
    startX: 0,              // 绘制起始X
    startY: 0,              // 绘制起始Y
    currentRegion: null,    // 当前正在绘制的区域元素
    pdfBytes: null,         // 原始PDF字节数据
};

// DOM元素引用
let pdfCanvas, pdfOverlay, pdfCanvasWrapper;
let uploadPdfBtn, pdfFileInput, clearRegionsBtn;
let pdfPrevPage, pdfNextPage, pdfPageInfo;
let regionsPanel, regionsList, regionsEmpty;
let exportEditedPdfBtn;

/**
 * 初始化PDF编辑器
 */
function initPdfEditor() {
    // 获取DOM元素
    pdfCanvas = document.getElementById('pdf-canvas');
    pdfOverlay = document.getElementById('pdf-overlay');
    pdfCanvasWrapper = document.getElementById('pdf-canvas-wrapper');
    uploadPdfBtn = document.getElementById('upload-pdf-btn');
    pdfFileInput = document.getElementById('pdf-file-input');
    clearRegionsBtn = document.getElementById('clear-regions-btn');
    pdfPrevPage = document.getElementById('pdf-prev-page');
    pdfNextPage = document.getElementById('pdf-next-page');
    pdfPageInfo = document.getElementById('pdf-page-info');
    regionsPanel = document.getElementById('regions-panel');
    regionsList = document.getElementById('regions-list');
    regionsEmpty = document.getElementById('regions-empty');
    exportEditedPdfBtn = document.getElementById('export-edited-pdf-button');

    // 绑定事件
    uploadPdfBtn.addEventListener('click', () => pdfFileInput.click());
    pdfFileInput.addEventListener('change', handlePdfUpload);
    clearRegionsBtn.addEventListener('click', clearAllRegions);
    pdfPrevPage.addEventListener('click', () => changePage(-1));
    pdfNextPage.addEventListener('click', () => changePage(1));
    exportEditedPdfBtn.addEventListener('click', exportEditedPdf);

    // 框选事件
    pdfOverlay.addEventListener('mousedown', startDrawing);
    pdfOverlay.addEventListener('mousemove', drawing);
    pdfOverlay.addEventListener('mouseup', endDrawing);
    pdfOverlay.addEventListener('mouseleave', endDrawing);
    
    // 监听字体设置变化，更新框选区域的字体
    const fontSelector = document.getElementById('font-selector');
    const fontWeightSelector = document.getElementById('font-weight');
    const fontSizeModeSelector = document.getElementById('font-size-mode');
    const jitterLevelInput = document.getElementById('jitter-level');
    
    if (fontSelector) {
        fontSelector.addEventListener('change', updateRegionsFontStyle);
    }
    if (fontWeightSelector) {
        fontWeightSelector.addEventListener('change', updateRegionsFontStyle);
    }
    if (fontSizeModeSelector) {
        fontSizeModeSelector.addEventListener('change', updateRegionsFontStyle);
    }
    if (jitterLevelInput) {
        jitterLevelInput.addEventListener('change', updateRegionsFontStyle);
    }
}

/**
 * 处理PDF文件上传
 */
async function handlePdfUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
        showToast('请选择PDF文件', 'error');
        return;
    }

    showToast('正在加载PDF...', 'info', 10000);

    try {
        const arrayBuffer = await file.arrayBuffer();
        // 保存原始ArrayBuffer的副本用于导出（避免被转移）
        pdfEditor.pdfBytes = arrayBuffer.slice(0);
        
        console.log('PDF数据已保存，大小:', pdfEditor.pdfBytes.byteLength);
        
        // 使用PDF.js加载
        pdfEditor.pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        pdfEditor.totalPages = pdfEditor.pdfDoc.numPages;
        pdfEditor.currentPage = 1;
        pdfEditor.regions = [];

        // 更新页码信息
        updatePageInfo();
        
        // 渲染第一页
        await renderPage(1);
        
        showToast(`PDF加载成功，共${pdfEditor.totalPages}页`, 'success');
    } catch (error) {
        console.error('PDF加载失败:', error);
        showToast('PDF加载失败，请确保文件格式正确', 'error');
    }
}

/**
 * 渲染指定页面
 */
async function renderPage(pageNum) {
    if (!pdfEditor.pdfDoc) return;

    const page = await pdfEditor.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: pdfEditor.scale });

    // 设置canvas尺寸
    pdfCanvas.width = viewport.width;
    pdfCanvas.height = viewport.height;
    pdfCanvasWrapper.style.width = viewport.width + 'px';
    pdfCanvasWrapper.style.height = viewport.height + 'px';

    // 渲染PDF页面
    const ctx = pdfCanvas.getContext('2d');
    await page.render({
        canvasContext: ctx,
        viewport: viewport
    }).promise;

    // 重新渲染当前页的区域
    renderRegions();
}

/**
 * 更新页码信息
 */
function updatePageInfo() {
    pdfPageInfo.textContent = `第 ${pdfEditor.currentPage} / ${pdfEditor.totalPages} 页`;
    pdfPrevPage.disabled = pdfEditor.currentPage <= 1;
    pdfNextPage.disabled = pdfEditor.currentPage >= pdfEditor.totalPages;
}

/**
 * 切换页面
 */
async function changePage(delta) {
    const newPage = pdfEditor.currentPage + delta;
    if (newPage < 1 || newPage > pdfEditor.totalPages) return;

    pdfEditor.currentPage = newPage;
    updatePageInfo();
    await renderPage(newPage);
}

/**
 * 开始绘制框选区域
 */
function startDrawing(e) {
    if (!pdfEditor.pdfDoc) {
        showToast('请先上传PDF文件', 'error');
        return;
    }
    
    // 检查点击位置是否在已有区域内，如果在则不开始新的框选
    if (e.target.closest('.selection-region')) {
        return;  // 点击在已有区域内，不开始新框选
    }

    const rect = pdfOverlay.getBoundingClientRect();
    pdfEditor.startX = e.clientX - rect.left;
    pdfEditor.startY = e.clientY - rect.top;
    pdfEditor.isDrawing = true;

    // 创建临时选区元素
    const region = document.createElement('div');
    region.className = 'selection-region';
    region.style.left = pdfEditor.startX + 'px';
    region.style.top = pdfEditor.startY + 'px';
    region.style.width = '0px';
    region.style.height = '0px';
    pdfOverlay.appendChild(region);
    pdfEditor.currentRegion = region;
}

/**
 * 绘制中
 */
function drawing(e) {
    if (!pdfEditor.isDrawing || !pdfEditor.currentRegion) return;

    const rect = pdfOverlay.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const width = Math.abs(currentX - pdfEditor.startX);
    const height = Math.abs(currentY - pdfEditor.startY);
    const left = Math.min(currentX, pdfEditor.startX);
    const top = Math.min(currentY, pdfEditor.startY);

    pdfEditor.currentRegion.style.left = left + 'px';
    pdfEditor.currentRegion.style.top = top + 'px';
    pdfEditor.currentRegion.style.width = width + 'px';
    pdfEditor.currentRegion.style.height = height + 'px';
}

/**
 * 结束绘制
 */
function endDrawing(e) {
    if (!pdfEditor.isDrawing) return;
    pdfEditor.isDrawing = false;

    if (!pdfEditor.currentRegion) return;

    // 获取最终尺寸
    const width = parseInt(pdfEditor.currentRegion.style.width);
    const height = parseInt(pdfEditor.currentRegion.style.height);

    // 太小的区域不保存
    if (width < 20 || height < 15) {
        pdfEditor.currentRegion.remove();
        pdfEditor.currentRegion = null;
        return;
    }

    // 保存区域数据
    const regionData = {
        id: Date.now(),
        pageNum: pdfEditor.currentPage,
        x: parseInt(pdfEditor.currentRegion.style.left),
        y: parseInt(pdfEditor.currentRegion.style.top),
        width: width,
        height: height,
        text: ''
    };

    pdfEditor.regions.push(regionData);

    // 更新区域元素
    setupRegionElement(pdfEditor.currentRegion, regionData);
    pdfEditor.currentRegion = null;

    // 更新左侧区域列表
    updateRegionsList();
}

/**
 * 设置区域元素的交互功能
 */
function setupRegionElement(element, data) {
    const index = pdfEditor.regions.findIndex(r => r.id === data.id) + 1;

    // 清空元素内容（防止重复添加）
    element.innerHTML = '';

    // 添加序号标签
    const numberLabel = document.createElement('div');
    numberLabel.className = 'region-number';
    numberLabel.textContent = index;
    element.appendChild(numberLabel);

    // 添加删除按钮
    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'region-delete';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        deleteRegion(data.id);
    });
    element.appendChild(deleteBtn);
    
    // 添加四个角的调整手柄
    const resizeHandles = ['nw', 'ne', 'sw', 'se'];
    resizeHandles.forEach(pos => {
        const handle = document.createElement('div');
        handle.className = `resize-handle resize-${pos}`;
        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            startResize(e, element, data, pos);
        });
        element.appendChild(handle);
    });

    // 添加文本输入框
    const textArea = document.createElement('textarea');
    textArea.className = 'region-text';
    textArea.placeholder = '点击输入文字...';
    textArea.value = data.text;
    
    // 应用当前字体样式
    const fontStyle = getCurrentFontStyle();
    textArea.style.fontFamily = fontStyle.fontFamily;
    textArea.style.fontWeight = fontStyle.fontWeight;
    textArea.style.fontSize = fontStyle.fontSize;
    
    textArea.addEventListener('input', (e) => {
        data.text = e.target.value;
        updateRegionsList();
    });
    
    textArea.addEventListener('blur', () => {
        element.classList.remove('active');
    });

    textArea.addEventListener('focus', () => {
        element.classList.add('active');
    });
    
    // 文本框的拖拽事件：区分点击和拖动
    let isDragging = false;
    let hasMoved = false;
    let startX, startY;
    
    textArea.addEventListener('mousedown', (e) => {
        // 如果已经在编辑模式，不处理拖动
        if (element.classList.contains('active')) return;
        
        startX = e.clientX;
        startY = e.clientY;
        isDragging = true;
        hasMoved = false;
        
        // 防止默认的文本选择行为
        e.preventDefault();
    });
    
    textArea.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const deltaX = Math.abs(e.clientX - startX);
        const deltaY = Math.abs(e.clientY - startY);
        
        // 移动超过5像素认为是拖动
        if (deltaX > 5 || deltaY > 5) {
            if (!hasMoved) {
                hasMoved = true;
                startDragFromTextArea(e, element, data, startX, startY);
            }
        }
    });
    
    textArea.addEventListener('mouseup', (e) => {
        if (isDragging && !hasMoved) {
            // 没有移动，是点击，进入编辑模式
            element.classList.add('active');
            textArea.focus();
        }
        isDragging = false;
        hasMoved = false;
    });
    
    textArea.addEventListener('mouseleave', (e) => {
        // 鼠标离开时如果正在拖动，继续拖动逻辑由document处理
    });

    element.appendChild(textArea);
    
    // 应用抖动效果（必须在textArea添加到DOM之后）
    applyJitterEffect(textArea, fontStyle.jitterLevel);

    // 存储元素引用
    element.dataset.regionId = data.id;
}

/**
 * 从文本框开始拖动区域位置
 */
function startDragFromTextArea(e, element, data, originX, originY) {
    const startLeft = data.x;
    const startTop = data.y;
    
    // 获取PDF叠加层的边界
    const overlayRect = pdfOverlay.getBoundingClientRect();
    const maxX = overlayRect.width - data.width;
    const maxY = overlayRect.height - data.height;
    
    // 添加拖动中的样式
    element.classList.add('dragging');
    document.body.style.cursor = 'move';
    
    function onMouseMove(e) {
        const deltaX = e.clientX - originX;
        const deltaY = e.clientY - originY;
        
        // 计算新位置，限制在PDF边界内
        let newX = Math.max(0, Math.min(maxX, startLeft + deltaX));
        let newY = Math.max(0, Math.min(maxY, startTop + deltaY));
        
        // 更新元素样式
        element.style.left = newX + 'px';
        element.style.top = newY + 'px';
        
        // 更新数据
        data.x = newX;
        data.y = newY;
    }
    
    function onMouseUp() {
        element.classList.remove('dragging');
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

/**
 * 开始调整区域大小
 */
function startResize(e, element, data, position) {
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = data.x;
    const startTop = data.y;
    const startWidth = data.width;
    const startHeight = data.height;
    
    // 添加调整中的样式
    element.classList.add('resizing');
    document.body.style.cursor = position === 'nw' || position === 'se' ? 'nwse-resize' : 'nesw-resize';
    
    function onMouseMove(e) {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        let newX = startLeft;
        let newY = startTop;
        let newWidth = startWidth;
        let newHeight = startHeight;
        
        // 根据拖拽位置计算新尺寸
        if (position.includes('e')) {
            newWidth = Math.max(10, startWidth + deltaX);
        }
        if (position.includes('w')) {
            newWidth = Math.max(10, startWidth - deltaX);
            newX = startLeft + (startWidth - newWidth);
        }
        if (position.includes('s')) {
            newHeight = Math.max(10, startHeight + deltaY);
        }
        if (position.includes('n')) {
            newHeight = Math.max(10, startHeight - deltaY);
            newY = startTop + (startHeight - newHeight);
        }
        
        // 更新元素样式
        element.style.left = newX + 'px';
        element.style.top = newY + 'px';
        element.style.width = newWidth + 'px';
        element.style.height = newHeight + 'px';
        
        // 更新数据
        data.x = newX;
        data.y = newY;
        data.width = newWidth;
        data.height = newHeight;
    }
    
    function onMouseUp() {
        element.classList.remove('resizing');
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        
        // 更新左侧列表
        updateRegionsList();
    }
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

/**
 * 渲染当前页的所有区域
 */
function renderRegions() {
    // 清除旧的区域元素
    pdfOverlay.innerHTML = '';

    // 只渲染当前页的区域
    const currentPageRegions = pdfEditor.regions.filter(r => r.pageNum === pdfEditor.currentPage);

    currentPageRegions.forEach((data, idx) => {
        const region = document.createElement('div');
        region.className = 'selection-region';
        region.style.left = data.x + 'px';
        region.style.top = data.y + 'px';
        region.style.width = data.width + 'px';
        region.style.height = data.height + 'px';

        setupRegionElement(region, data);
        pdfOverlay.appendChild(region);
    });
}

/**
 * 删除区域
 */
function deleteRegion(id) {
    pdfEditor.regions = pdfEditor.regions.filter(r => r.id !== id);
    renderRegions();
    updateRegionsList();
}

/**
 * 清除所有区域
 */
function clearAllRegions() {
    if (pdfEditor.regions.length === 0) {
        showToast('没有需要清除的区域', 'info');
        return;
    }
    
    if (confirm('确定要清除所有框选区域吗？')) {
        pdfEditor.regions = [];
        renderRegions();
        updateRegionsList();
        showToast('已清除所有区域', 'success');
    }
}

/**
 * 更新左侧区域列表
 */
function updateRegionsList() {
    regionsList.innerHTML = '';
    
    if (pdfEditor.regions.length === 0) {
        regionsEmpty.style.display = 'block';
        return;
    }

    regionsEmpty.style.display = 'none';

    pdfEditor.regions.forEach((data, idx) => {
        const item = document.createElement('div');
        item.className = 'region-input-item';

        const label = document.createElement('div');
        label.className = 'region-label';
        label.textContent = idx + 1;

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = `区域 ${idx + 1} (第${data.pageNum}页)`;
        input.value = data.text;
        input.addEventListener('input', (e) => {
            data.text = e.target.value;
            // 同步更新PDF上的文本
            syncRegionText(data.id, e.target.value);
        });

        // 添加删除按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'region-delete-btn';
        deleteBtn.textContent = '×';
        deleteBtn.title = '删除此区域';
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            deleteRegion(data.id);
        });

        item.appendChild(label);
        item.appendChild(input);
        item.appendChild(deleteBtn);
        regionsList.appendChild(item);
    });
}

/**
 * 同步更新PDF上区域的文本
 */
function syncRegionText(id, text) {
    const region = document.querySelector(`[data-region-id="${id}"]`);
    if (region) {
        const textArea = region.querySelector('.region-text');
        if (textArea) {
            textArea.value = text;
        }
    }
}

/**
 * 获取当前字体样式设置
 */
function getCurrentFontStyle() {
    const fontSelector = document.getElementById('font-selector');
    const fontWeightSelector = document.getElementById('font-weight');
    const fontSizeModeSelector = document.getElementById('font-size-mode');
    const jitterLevelInput = document.getElementById('jitter-level');
    
    // 字体映射表
    const fontFamilyMap = {
        'lxgw': 'LXGW WenKai',
        'dymon': 'Dymon',
        'xieyiti': 'XieYiTi',
        'xieyitisc': 'XieYiTiSC',
        'pingfang': 'PingFang',
        'honglei': 'HongLei'
    };
    
    const fontKey = fontSelector ? fontSelector.value : 'pingfang';
    const fontFamily = fontFamilyMap[fontKey] || 'PingFang';
    const fontWeight = fontWeightSelector ? fontWeightSelector.value : '400';
    
    // 字体大小
    let fontSize = '16px';  // 默认中等
    if (fontSizeModeSelector) {
        const mode = fontSizeModeSelector.value;
        if (mode === 'small') fontSize = '12px';
        else if (mode === 'medium') fontSize = '16px';
        else if (mode === 'large') fontSize = '20px';
    }
    
    // 抖动强度
    const jitterLevel = jitterLevelInput ? parseInt(jitterLevelInput.value) || 0 : 0;
    
    return {
        fontFamily: `"${fontFamily}", "LXGW WenKai", cursive`,
        fontWeight: fontWeight,
        fontSize: fontSize,
        jitterLevel: jitterLevel
    };
}

/**
 * 更新所有框选区域的字体样式
 */
function updateRegionsFontStyle() {
    const style = getCurrentFontStyle();
    
    // 更新PDF上所有区域的文本框字体
    const allTextAreas = document.querySelectorAll('.region-text');
    allTextAreas.forEach(textArea => {
        textArea.style.fontFamily = style.fontFamily;
        textArea.style.fontWeight = style.fontWeight;
        textArea.style.fontSize = style.fontSize;
        
        // 应用抖动效果
        applyJitterEffect(textArea, style.jitterLevel);
    });
    
    console.log(`更新了 ${allTextAreas.length} 个区域的字体样式:`, style);
}

/**
 * 应用抖动效果到文本框
 * 注：由于前端无法完全模拟后端的逐字抖动，这里只显示提示图标
 */
function applyJitterEffect(textArea, jitterLevel) {
    // 安全检查
    if (!textArea) return;
    
    // 移除之前的抖动提示
    if (textArea.parentElement) {
        const existingHint = textArea.parentElement.querySelector('.jitter-hint');
        if (existingHint) existingHint.remove();
    }
    
    // 不应用任何模拟效果，保持文本清晰可读
    textArea.style.letterSpacing = '0';
    textArea.style.textShadow = 'none';
    
    // 如果有抖动设置，显示提示图标
    if (jitterLevel > 0 && textArea.parentElement) {
        const hint = document.createElement('div');
        hint.className = 'jitter-hint';
        hint.title = `抖动强度: ${jitterLevel} - 导出后PDF中将应用抖动效果`;
        hint.textContent = '✨';
        textArea.parentElement.appendChild(hint);
    }
}

/**
 * 导出编辑后的PDF - 使用截图方式保证所见即所得
 */
async function exportEditedPdf() {
    if (!pdfEditor.pdfDoc) {
        showToast('请先上传PDF文件', 'error');
        return;
    }
    
    // 检查PDF字节数据是否存在
    if (!pdfEditor.pdfBytes || pdfEditor.pdfBytes.byteLength === 0) {
        showToast('PDF数据丢失，请重新上传文件', 'error');
        return;
    }

    if (pdfEditor.regions.length === 0) {
        showToast('请先框选要填写的区域', 'error');
        return;
    }

    // 检查是否有内容
    const hasContent = pdfEditor.regions.some(r => r.text.trim());
    if (!hasContent) {
        showToast('请在框选区域中输入内容', 'error');
        return;
    }

    showToast('正在生成PDF，请稍候...', 'info', 30000);
    
    console.log('PDF字节数据大小:', pdfEditor.pdfBytes.byteLength);
    console.log('框选区域数:', pdfEditor.regions.length);

    try {
        // 为每个区域生成截图
        const regionsWithImages = [];
        
        for (const region of pdfEditor.regions) {
            if (!region.text.trim()) continue;
            
            // 找到对应的DOM元素
            const element = pdfOverlay.querySelector(`[data-region-id="${region.id}"]`);
            if (!element) continue;
            
            // 找到textarea
            const textArea = element.querySelector('.region-text');
            if (!textArea) continue;
            
            // 创建临时div来替代textarea（因为html2canvas无法正确捕捉textarea的滚动状态）
            const tempDiv = document.createElement('div');
            const computedStyle = window.getComputedStyle(textArea);
            const scrollTop = textArea.scrollTop;  // 保存当前滚动位置
            
            // 复制样式 - 使用overflow:hidden和负边距模拟滚动
            tempDiv.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: ${textArea.offsetWidth}px;
                height: ${textArea.offsetHeight}px;
                padding: ${computedStyle.padding};
                font-family: ${computedStyle.fontFamily};
                font-size: ${computedStyle.fontSize};
                font-weight: ${computedStyle.fontWeight};
                line-height: ${computedStyle.lineHeight};
                color: ${computedStyle.color};
                white-space: pre-wrap;
                word-wrap: break-word;
                overflow: hidden;
                background: transparent;
                box-sizing: border-box;
            `;
            
            // 创建内部容器来处理滚动偏移
            const innerDiv = document.createElement('div');
            innerDiv.style.cssText = `
                transform: translateY(-${scrollTop}px);
            `;
            innerDiv.textContent = textArea.value;
            tempDiv.appendChild(innerDiv);
            
            // 隐藏原始textarea，显示临时div
            const originalTextAreaDisplay = textArea.style.display;
            textArea.style.display = 'none';
            element.appendChild(tempDiv);
            
            // 保存原始样式
            const originalElementBg = element.style.background;
            const originalBorder = element.style.border;
            const originalBoxShadow = element.style.boxShadow;
            
            // 设置透明背景用于截图
            element.style.background = 'transparent';
            element.style.border = 'none';
            element.style.boxShadow = 'none';
            
            // 隐藏其他装饰元素
            const numberLabel = element.querySelector('.region-number');
            const deleteBtn = element.querySelector('.region-delete');
            const handles = element.querySelectorAll('.resize-handle');
            const jitterHint = element.querySelector('.jitter-hint');
            
            if (numberLabel) numberLabel.style.display = 'none';
            if (deleteBtn) deleteBtn.style.display = 'none';
            if (jitterHint) jitterHint.style.display = 'none';
            handles.forEach(h => h.style.display = 'none');
            
            try {
                // 截取整个区域元素
                const canvas = await html2canvas(element, {
                    backgroundColor: null,  // 透明背景
                    scale: 2,  // 2倍分辨率以获得清晰图像
                    logging: false,
                    useCORS: true
                });
                
                // 转换为base64
                const imageData = canvas.toDataURL('image/png');
                
                regionsWithImages.push({
                    pageNum: region.pageNum,
                    x: region.x / pdfEditor.scale,
                    y: region.y / pdfEditor.scale,
                    width: region.width / pdfEditor.scale,
                    height: region.height / pdfEditor.scale,
                    image: imageData  // base64图片
                });
                
            } finally {
                // 恢复原始状态
                element.removeChild(tempDiv);
                textArea.style.display = originalTextAreaDisplay;
                element.style.background = originalElementBg;
                element.style.border = originalBorder;
                element.style.boxShadow = originalBoxShadow;
                if (numberLabel) numberLabel.style.display = '';
                if (deleteBtn) deleteBtn.style.display = '';
                if (jitterHint) jitterHint.style.display = '';
                handles.forEach(h => h.style.display = '');
            }
        }
        
        if (regionsWithImages.length === 0) {
            showToast('没有可导出的内容', 'error');
            return;
        }
        
        console.log('已生成截图数:', regionsWithImages.length);

        // 创建FormData上传PDF和截图数据
        const formData = new FormData();
        
        const pdfBlob = new Blob([pdfEditor.pdfBytes], { type: 'application/pdf' });
        formData.append('pdf', pdfBlob, 'original.pdf');
        formData.append('data', JSON.stringify({ regions: regionsWithImages }));

        const response = await fetch('/api/edit-pdf-screenshot', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const errorMsg = errorData?.error || 'PDF生成失败';
            showToast(errorMsg, 'error', 5000);
            return;
        }

        // 下载文件
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'edited_document.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        showToast('✅ PDF已下载成功！', 'success', 3000);
    } catch (error) {
        console.error('导出PDF失败:', error);
        showToast('❌ PDF生成失败，请稍后再试', 'error', 5000);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initPdfEditor);
