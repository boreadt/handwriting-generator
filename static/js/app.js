document.addEventListener("DOMContentLoaded", function () {
    const input = document.getElementById("input-text");
    const convertButton = document.getElementById("convert-button");
    const downloadButton = document.getElementById("download-image-button");
    const output = document.getElementById("output");
    const charsPerLineInput = document.getElementById("chars-per-line");
    const linesPerPageInput = document.getElementById("lines-per-page");
    const fontSelector = document.getElementById("font-selector");
    const fontWeightSelector = document.getElementById("font-weight");
    const fontSizeModeSelector = document.getElementById("font-size-mode");
    const toast = document.getElementById("toast");
    
    // 字体加载状态
    let fontsLoaded = false;
    
    // 检测字体加载状态
    if (document.fonts && document.fonts.ready) {
        // 显示加载提示
        const previewContainer = document.querySelector(".preview-container");
        if (previewContainer) {
            previewContainer.innerHTML = '<div class="handwriting-preview" style="display:flex;align-items:center;justify-content:center;color:#999;">字体加载中...</div>';
        }
        
        document.fonts.ready.then(function() {
            fontsLoaded = true;
            console.log("✓ 字体加载完成");
            // 字体加载完成后更新预览
            if (previewContainer) {
                previewContainer.innerHTML = '<div class="handwriting-preview">请先输入内容</div>';
            }
            updatePreviewFont();
        });
        
        // 超时处理，防止字体加载卡住
        setTimeout(function() {
            if (!fontsLoaded) {
                fontsLoaded = true;
                console.log("字体加载超时，使用备用字体");
                if (previewContainer) {
                    previewContainer.innerHTML = '<div class="handwriting-preview">请先输入内容</div>';
                }
                updatePreviewFont();
            }
        }, 5000);
    } else {
        // 不支持 document.fonts 的浏览器，延迟加载
        setTimeout(function() {
            fontsLoaded = true;
            updatePreviewFont();
        }, 2000);
    }
    
    // 模式切换
    const modeTextBtn = document.getElementById("mode-text-btn");
    const modePdfBtn = document.getElementById("mode-pdf-btn");
    const textPreviewContainer = document.getElementById("text-preview-container");
    const pdfPreviewContainer = document.getElementById("pdf-preview-container");
    const regionsPanel = document.getElementById("regions-panel");
    const exportEditedPdfBtn = document.getElementById("export-edited-pdf-button");
    const downloadPdfBtn = document.getElementById("download-pdf-button");
    const inputSectionH2 = document.querySelector(".input-section h2");
    const layoutOptions = document.querySelector(".layout-options");
    
    let currentMode = 'text';  // 'text' 或 'pdf'
    
    // 模式切换事件
    modeTextBtn.addEventListener("click", () => switchMode('text'));
    modePdfBtn.addEventListener("click", () => switchMode('pdf'));
    
    function switchMode(mode) {
        currentMode = mode;
        
        if (mode === 'text') {
            // 文本模式
            modeTextBtn.classList.add('active');
            modePdfBtn.classList.remove('active');
            textPreviewContainer.style.display = 'flex';
            pdfPreviewContainer.style.display = 'none';
            regionsPanel.style.display = 'none';
            exportEditedPdfBtn.style.display = 'none';
            downloadPdfBtn.style.display = '';
            convertButton.style.display = '';
            downloadButton.style.display = '';
            // 显示文本输入框
            input.style.display = '';
            inputSectionH2.textContent = '输入内容';
            // 显示排版选项（每行字数、每页行数等）
            if (layoutOptions) {
                const layoutRows = layoutOptions.querySelectorAll('.layout-row');
                layoutRows.forEach(row => {
                    row.style.display = '';
                    // 恢复所有label的显示
                    const labels = row.querySelectorAll('label');
                    labels.forEach(label => label.style.display = '');
                });
            }
            
            // 文本模式下恢复抖动默认值
            const jitterInput = document.getElementById('jitter-level');
            const jitterValueSpan = document.getElementById('jitter-level-value');
            if (jitterInput) {
                jitterInput.value = '6';
                if (jitterValueSpan) jitterValueSpan.textContent = '6';
            }
        } else {
            // PDF编辑模式
            modeTextBtn.classList.remove('active');
            modePdfBtn.classList.add('active');
            textPreviewContainer.style.display = 'none';
            pdfPreviewContainer.style.display = 'flex';
            regionsPanel.style.display = 'block';
            exportEditedPdfBtn.style.display = '';
            downloadPdfBtn.style.display = 'none';
            convertButton.style.display = 'none';
            downloadButton.style.display = 'none';
            // 隐藏文本输入框，显示区域列表
            input.style.display = 'none';
            inputSectionH2.textContent = '框选区域列表';
            
            // PDF模式下设置抖动默认为0
            const jitterInput = document.getElementById('jitter-level');
            const jitterValueSpan = document.getElementById('jitter-level-value');
            if (jitterInput) {
                jitterInput.value = '0';
                if (jitterValueSpan) jitterValueSpan.textContent = '0';
            }
            
            // 隐藏不相关的排版选项（每行字数、每页行数、手写错误）
            if (layoutOptions) {
                const layoutRows = layoutOptions.querySelectorAll('.layout-row');
                // 保留：字体选择、字体粗细、字体大小、抖动强度
                layoutRows.forEach((row, idx) => {
                    if (idx === 0) {
                        // 第一行：字体选择、字体粗细 - 保留
                        row.style.display = '';
                    } else if (idx === 2) {
                        // 第三行：字体大小 - 保留（但隐藏手写错误选项）
                        row.style.display = '';
                        // 隐藏手写错误选项
                        const errorLabel = row.querySelector('label:last-child');
                        if (errorLabel && errorLabel.textContent.includes('手写错误')) {
                            errorLabel.style.display = 'none';
                        }
                    } else if (idx === 3) {
                        // 第四行：抖动强度 - 保留
                        row.style.display = '';
                    } else {
                        // 其他行隐藏（每行字数、每页行数）
                        row.style.display = 'none';
                    }
                });
            }
        }
    }
    
    // 将showToast函数暴露到全局，供PDF编辑器使用
    window.showToast = function(message, type = "info", duration = 2000) {
        toast.textContent = message;
        toast.className = "toast show " + type;
        
        setTimeout(() => {
            toast.className = "toast";
        }, duration);
    };

    // 小弹窗提示函数
    function showToast(message, type = "info", duration = 2000) {
        toast.textContent = message;
        toast.className = "toast show " + type;
        
        setTimeout(() => {
            toast.className = "toast";
        }, duration);
    }

    // 加载可用字体列表（纯前端版本，不依赖后端API）
    let fontMap = {};  // 存储 key -> cssFamily 的映射
    
    // 字体配置（与后端 AVAILABLE_FONTS 保持一致）
    const FONTS_CONFIG = [
        { key: "lxgw", name: "霞鹜文楷", cssFamily: "LXGW WenKai" },
        { key: "dymon", name: "呆萌手写体", cssFamily: "Dymon" },
        { key: "xieyiti", name: "写意体", cssFamily: "XieYiTi" },
        { key: "xieyitisc", name: "写意体SC", cssFamily: "XieYiTiSC" },
        { key: "pingfang", name: "平方时光体", cssFamily: "PingFang" },
        { key: "honglei", name: "鸿雷小纸条青春体", cssFamily: "HongLei" },
        { key: "jianjian", name: "坚坚体", cssFamily: "JianJian" },
        { key: "shangshangqian", name: "平方上上谦体", cssFamily: "ShangShangQian" },
    ];
    
    function loadFonts() {
        fontSelector.innerHTML = "";
        
        FONTS_CONFIG.forEach((font) => {
            const option = document.createElement("option");
            option.value = font.key;
            option.textContent = font.name;
            // 默认选择平方时光体
            if (font.key === "pingfang") {
                option.selected = true;
            }
            fontSelector.appendChild(option);
            
            // 存储字体key到CSS font-family的映射
            fontMap[font.key] = font.cssFamily;
        });
        
        // 初始化预览区字体
        setTimeout(() => {
            const previewContainer = document.querySelector(".preview-container");
            if (previewContainer) {
                previewContainer.innerHTML = '<div class="handwriting-preview">请先输入内容</div>';
            }
            updatePreviewFont();
        }, 100);
    }
    
    // 更新预览区字体
    // 更新所有预览页面的字体和粗细
    function updatePreviewFont() {
        // 检查是否有字体选择器
        if (!fontSelector) {
            console.log("字体选择器不存在");
            return;
        }
            
        const selectedFont = fontSelector.value;
        const cssFamily = fontMap[selectedFont] || "PingFang";
        const fontWeight = fontWeightSelector.value || "400";
        
        // 主动加载字体（确保手机端能正确加载）
        if (document.fonts && document.fonts.load) {
            document.fonts.load(`${fontWeight} 16px "${cssFamily}"`).then(function() {
                console.log(`字体 ${cssFamily} 加载成功`);
                applyFontToPages(cssFamily, fontWeight);
            }).catch(function(err) {
                console.warn(`字体 ${cssFamily} 加载失败:`, err);
                applyFontToPages(cssFamily, fontWeight);
            });
        } else {
            applyFontToPages(cssFamily, fontWeight);
        }
    }
    
    // 应用字体到页面
    function applyFontToPages(cssFamily, fontWeight) {
        // 获取所有预览页面（在函数执行时重新查询）
        const allPages = document.querySelectorAll(".handwriting-preview");
        console.log(`找到 ${allPages.length} 个预览页面`);
            
        allPages.forEach(page => {
            if (page && page.style) {
                page.style.fontFamily = `"${cssFamily}", "Comic Sans MS", "KaiTi", cursive`;
                page.style.fontWeight = fontWeight;
            }
        });
        
        // 同时更新PDF编辑模式中的文本区域
        const regionTexts = document.querySelectorAll(".region-text");
        regionTexts.forEach(textarea => {
            if (textarea && textarea.style) {
                textarea.style.fontFamily = `"${cssFamily}", "Comic Sans MS", "KaiTi", cursive`;
                textarea.style.fontWeight = fontWeight;
            }
        });
    }
    
    // 字体选择变化时更新预览
    fontSelector.addEventListener("change", updatePreviewFont);
    fontWeightSelector.addEventListener("change", updatePreviewFont);

    // 页面加载时自动加载字体列表
    loadFonts();

    // 更新滑块进度条颜色
    function updateSliderTrack(slider) {
        const min = parseFloat(slider.min) || 0;
        const max = parseFloat(slider.max) || 100;
        const val = parseFloat(slider.value) || 0;
        const percent = ((val - min) / (max - min)) * 100;
        slider.style.background = `linear-gradient(to right, #0066ff 0%, #00c8ff ${percent}%, #e0e0e0 ${percent}%, #e0e0e0 100%)`;
    }
    
    // 初始化所有滑块的进度条
    document.querySelectorAll('.slider-group input[type="range"]').forEach(slider => {
        updateSliderTrack(slider);
    });

    // 监听每行字数和每页行数的变化，自动更新预览
    charsPerLineInput.addEventListener("input", function() {
        // 更新滑块进度条
        updateSliderTrack(this);
        // 更新显示值
        const valueSpan = document.getElementById('chars-per-line-value');
        if (valueSpan) valueSpan.textContent = this.value + '字';
        
        const previewContainer = document.querySelector(".preview-container");
        // 检查是否有内容
        if (previewContainer.children.length > 0) {
            const firstPage = previewContainer.querySelector(".handwriting-preview");
            if (firstPage && firstPage.textContent && firstPage.textContent !== "请先输入内容") {
                convertText();
            }
        }
    });
    
    linesPerPageInput.addEventListener("input", function() {
        // 更新滑块进度条
        updateSliderTrack(this);
        // 更新显示值
        const valueSpan = document.getElementById('lines-per-page-value');
        if (valueSpan) valueSpan.textContent = this.value + '行';
        
        const previewContainer = document.querySelector(".preview-container");
        if (previewContainer.children.length > 0) {
            const firstPage = previewContainer.querySelector(".handwriting-preview");
            if (firstPage && firstPage.textContent && firstPage.textContent !== "请先输入内容") {
                convertText();
            }
        }
    });
    
    // 监听字体大小模式的变化
    fontSizeModeSelector.addEventListener("change", function() {
        const previewContainer = document.querySelector(".preview-container");
        if (previewContainer.children.length > 0) {
            const firstPage = previewContainer.querySelector(".handwriting-preview");
            if (firstPage && firstPage.textContent && firstPage.textContent !== "请先输入内容") {
                convertText();
            }
        }
    });
    
    // 监听抖动强度的变化
    const jitterLevelInput = document.getElementById('jitter-level');
    jitterLevelInput.addEventListener("input", function() {
        // 更新滑块进度条
        updateSliderTrack(this);
        // 更新显示值
        const valueSpan = document.getElementById('jitter-level-value');
        if (valueSpan) valueSpan.textContent = this.value;
        
        const previewContainer = document.querySelector(".preview-container");
        if (previewContainer.children.length > 0) {
            const firstPage = previewContainer.querySelector(".handwriting-preview");
            if (firstPage && (firstPage.textContent || firstPage.children.length > 0)) {
                convertText();
            }
        }
    });

    async function convertText() {
        const text = input.value.trim();
        if (!text) {
            // 清空预览区
            const previewContainer = document.querySelector(".preview-container");
            previewContainer.innerHTML = '<div class="handwriting-preview">请先输入内容</div>';
            return;
        }

        // 获取排版参数
        const charsPerLine = parseInt(charsPerLineInput.value, 10) || 26;
        const linesPerPage = parseInt(linesPerPageInput.value, 10) || 20;
        const fontSizeMode = fontSizeModeSelector.value || "auto";
        const enableErrors = document.getElementById('enable-errors').value;
        
        // 与生成图片/PDF使用相同的字体计算逻辑，确保所见即所得
        // A4尺寸 (300 DPI): 2480x3508, 边距160
        // 预览区尺寸: 420x594, 边距20
        // 缩放比例: 420/2480 = 0.169
        const A4_WIDTH = 2480;
        const A4_HEIGHT = 3508;
        const MARGIN = 160;
        
        // 计算字体大小（与 frontend-render.js 相同的算法）
        const availableWidth = A4_WIDTH - MARGIN * 2;
        const availableHeight = A4_HEIGHT - MARGIN * 2;
        const maxFontSizeByWidth = Math.floor(availableWidth / charsPerLine * 0.95);
        const lineHeight = Math.floor(availableHeight / linesPerPage);
        const maxFontSizeByHeight = Math.floor(lineHeight * 0.7);
        const a4FontSize = Math.max(20, Math.min(maxFontSizeByWidth, maxFontSizeByHeight));
        
        // 预览区使用更高精度的缩放，避免小数点截断
        const PREVIEW_WIDTH = 420;  // 预览区宽度
        const PREVIEW_HEIGHT = 594; // 预览区高度
        const PREVIEW_MARGIN = 20;  // 预览区边距
        
        // 精确缩放比例
        const widthScale = PREVIEW_WIDTH / A4_WIDTH;
        const heightScale = PREVIEW_HEIGHT / A4_HEIGHT;
        
        // 使用较小的缩放比例以确保内容完全适应预览区
        const scale = Math.min(widthScale, heightScale);
        
        // 预览区字体大小 = A4字体大小 * 精确缩放比例
        const previewFontSize = a4FontSize * scale;
        // 预览区行高
        const previewLineHeight = lineHeight * scale;
        
        // 为避免小数点导致的精度问题，使用整数像素值
        const roundedPreviewFontSize = Math.max(1, Math.round(previewFontSize));
        const roundedPreviewLineHeight = Math.max(1, Math.round(previewLineHeight));
        
        // 按照每行字数切分文本
        const lines = [];
        const paragraphs = text.split("\n");
        
        for (const para of paragraphs) {
            if (!para.trim()) {
                lines.push("");  // 保留空行
                continue;
            }
            
            let remainText = para.trim();
            // 严格按照设置的每行字数切分，不再使用额外的缩放因子
            while (remainText.length > 0) {
                const chunk = remainText.substring(0, charsPerLine);
                lines.push(chunk);
                remainText = remainText.substring(charsPerLine);
            }
        }
        
        // 按每页行数分页
        const pages = [];
        for (let i = 0; i < lines.length; i += linesPerPage) {
            const pageLines = lines.slice(i, i + linesPerPage);
            pages.push(pageLines.join("\n"));
        }
        
        // 如果没有内容，至少显示一页
        if (pages.length === 0) {
            pages.push("");
        }
        
        // 清空并重新创建多个预览页面
        const previewContainer = document.querySelector(".preview-container");
        previewContainer.innerHTML = "";  // 清空
        
        // 获取抖动强度
        const jitterLevel = parseInt(document.getElementById('jitter-level').value, 10) || 0;
        
        pages.forEach((pageContent, index) => {
            const pageDiv = document.createElement("div");
            pageDiv.className = "handwriting-preview";
            pageDiv.setAttribute("data-page-num", `第 ${index + 1} 页`);
            // 设置字体大小和行高（与生成一致）
            pageDiv.style.fontSize = `${roundedPreviewFontSize}px`;
            pageDiv.style.lineHeight = `${roundedPreviewLineHeight}px`;
            pageDiv.style.letterSpacing = "0px";  // 与生成保持一致
            
            if (jitterLevel > 0) {
                const pageLines = pageContent.split("\n");
                pageLines.forEach((lineText, lineIdx) => {
                    const lineDiv = document.createElement("div");
                    lineDiv.style.position = "relative";
                    lineDiv.style.whiteSpace = "nowrap";
                    lineDiv.style.height = `${roundedPreviewLineHeight}px`;
                    
                    // 行级别抖动：水平和垂直偏移（按精确比例缩放）
                    const lineHJitter = (Math.random() - 0.5) * jitterLevel * 1.5 * scale;
                    const lineVJitter = (Math.random() - 0.5) * jitterLevel * 1 * scale;
                    lineDiv.style.marginLeft = `${lineHJitter}px`;
                    lineDiv.style.marginTop = `${lineVJitter}px`;
                    
                    // 逐字符渲染（添加字符级别抖动）
                    for (let i = 0; i < lineText.length; i++) {
                        const charSpan = document.createElement("span");
                        charSpan.textContent = lineText[i];
                        charSpan.style.display = "inline-block";
                        charSpan.style.position = "relative";
                        
                        // 字符级别抖动（按精确比例缩放）
                        const charHJitter = (Math.random() - 0.5) * jitterLevel * 0.5 * scale;
                        const charVJitter = (Math.random() - 0.5) * jitterLevel * 0.6 * scale;
                        charSpan.style.left = `${charHJitter}px`;
                        charSpan.style.top = `${charVJitter}px`;
                        
                        lineDiv.appendChild(charSpan);
                    }
                    
                    pageDiv.appendChild(lineDiv);
                });
            } else {
                // 无抖动，直接显示文本
                pageDiv.textContent = pageContent;
            }
            
            previewContainer.appendChild(pageDiv);
        });
        
        // 更新所有页面的字体样式
        updatePreviewFont();
    }

    async function downloadImage() {
        const text = input.value.trim();
        if (!text) {
            showToast("请先输入内容", "error");
            return;
        }

        // 验证参数范围
        const charsPerLine = parseInt(charsPerLineInput.value, 10) || 26;
        const linesPerPage = parseInt(linesPerPageInput.value, 10) || 20;
        
        // 参数已记录，无限制弹窗
        console.log(`排版参数: 每行${charsPerLine}字, 每页${linesPerPage}行`);

        // 显示开始生成的提示
        showToast("正在生成图片，请稍候...", "info", 30000);

        try {
            // 设置字体映射
            FrontendRender.setFontMap(fontMap);
            
            // 生成图片
            const blobs = await FrontendRender.generateImages(text, {
                fontKey: fontSelector.value || 'pingfang',
                fontWeight: parseInt(fontWeightSelector.value, 10) || 400,
                charsPerLine: charsPerLine,
                linesPerPage: linesPerPage,
                fontSizeMode: fontSizeModeSelector.value || 'medium',
                jitterLevel: parseInt(document.getElementById('jitter-level').value, 10) || 0
            });
            
            // 下载
            await FrontendRender.downloadImages(blobs);
            
            // 成功提示
            if (blobs.length > 1) {
                showToast("✅ 多页图片已下载！", "success", 3000);
            } else {
                showToast("✅ 图片已下载成功！", "success", 3000);
            }
        } catch (error) {
            console.error(error);
            showToast("❌ 图片生成失败：" + error.message, "error", 5000);
        }
    }

    convertButton.addEventListener("click", convertText);
    downloadButton.addEventListener("click", downloadImage);
    
    // PDF下载按钮
    const downloadPdfButton = document.getElementById("download-pdf-button");
    downloadPdfButton.addEventListener("click", downloadPdf);
    
    async function downloadPdf() {
        const text = input.value.trim();
        if (!text) {
            showToast("请先输入内容", "error");
            return;
        }

        showToast("正在生成PDF，请稍候...", "info", 30000);

        try {
            // 设置字体映射
            FrontendRender.setFontMap(fontMap);
            
            // 生成 PDF
            const pdfBlob = await FrontendRender.generatePDF(text, {
                fontKey: fontSelector.value || 'pingfang',
                fontWeight: parseInt(fontWeightSelector.value, 10) || 400,
                charsPerLine: parseInt(charsPerLineInput.value, 10) || 26,
                linesPerPage: parseInt(linesPerPageInput.value, 10) || 20,
                fontSizeMode: fontSizeModeSelector.value || 'medium',
                jitterLevel: parseInt(document.getElementById('jitter-level').value, 10) || 6
            });
            
            // 下载
            FrontendRender.downloadPDF(pdfBlob);

            showToast("✅ PDF已下载成功！", "success", 3000);
        } catch (error) {
            console.error(error);
            showToast("❌ PDF生成失败：" + error.message, "error", 5000);
        }
    }
});
