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
            if (jitterInput) {
                jitterInput.value = '6';
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
            if (jitterInput) {
                jitterInput.value = '0';
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

    // 加载可用字体列表
    let fontMap = {};  // 存储 key -> cssFamily 的映射
    
    async function loadFonts() {
        try {
            const response = await fetch("/api/fonts");
            if (!response.ok) {
                throw new Error("加载字体列表失败");
            }
            const data = await response.json();
            fontSelector.innerHTML = "";
            
            data.fonts.forEach((font, index) => {
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
            // 只有在页面加载完成并且有内容时才更新字体
            // setTimeout(() => updatePreviewFont(), 100);  // 延迟更新以确保DOM加载完成
        } catch (error) {
            console.error(error);
            fontSelector.innerHTML = '<option value="lxgw">默认字体</option>';
        }
        
        // 初始化预览区字体
        setTimeout(() => {
            const previewContainer = document.querySelector(".preview-container");
            if (previewContainer) {
                previewContainer.innerHTML = '<div class="handwriting-preview">请先输入内容</div>';
            }
            updatePreviewFont();
        }, 100);  // 延迟更新以确保DOM加载完成
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

    // 监听每行字数和每页行数的变化，自动更新预览
    charsPerLineInput.addEventListener("change", function() {
        const previewContainer = document.querySelector(".preview-container");
        // 检查是否有内容
        if (previewContainer.children.length > 0) {
            const firstPage = previewContainer.querySelector(".handwriting-preview");
            if (firstPage && firstPage.textContent && firstPage.textContent !== "请先输入内容") {
                convertText();
            }
        }
    });
    
    linesPerPageInput.addEventListener("change", function() {
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
    jitterLevelInput.addEventListener("change", function() {
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
        
        // 计算预览区的字体大小（模拟后端逻辑）
        let previewFontSize;
        const currentFontSizeMode = fontSizeModeSelector.value || "auto";
        if (currentFontSizeMode === "auto") {
            // 自动计算：根据每行字数
            // 预览区宽度420px，边距20px
            const previewWidth = 420 - 40;  // 380px
            // 为手写体预留一些自然的边距和字间距
            let reservedSpace;
            if (charsPerLine <= 20) {
                // 少字数：预留更少空间，让字更大
                reservedSpace = 0.2;  // 预留0.2个字的空间
            } else if (charsPerLine <= 35) {
                // 中等字数：适中预留
                reservedSpace = 0.5;  // 预留0.5个字的空间
            } else {
                // 多字数：预留较少空间，但保持可读性
                reservedSpace = Math.max(0.2, Math.floor(charsPerLine * 0.015));  // 预留1.5%的空间
            }
            
            const estimatedCharWidth = previewWidth / (charsPerLine + reservedSpace);
            previewFontSize = Math.max(8, Math.min(estimatedCharWidth * 0.98, 24));
        } else if (currentFontSizeMode === "small") {
            previewFontSize = 12;  // 60pt -> 12px (1:5缩放)
        } else if (currentFontSizeMode === "large") {
            previewFontSize = 20;  // 100pt -> 20px
        } else {
            previewFontSize = 16;  // 80pt -> 16px (中等)
        }
        
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
            // 设置字体大小
            pageDiv.style.fontSize = `${previewFontSize}px`;
            // 根据每行字数设置适当的字符间距（模拟实际效果）
            if (charsPerLine <= 20) {
                pageDiv.style.letterSpacing = "0.2px";  // 少字数：较窄间距
            } else if (charsPerLine <= 35) {
                pageDiv.style.letterSpacing = "0.1px";  // 中等字数：更窄间距
            } else {
                pageDiv.style.letterSpacing = "0px";  // 多字数：最小间距
            }
            
            // 如果有抖动效果，逐行渲染并添加随机偏移
            if (jitterLevel > 0) {
                const pageLines = pageContent.split("\n");
                pageLines.forEach((lineText, lineIdx) => {
                    const lineDiv = document.createElement("div");
                    lineDiv.style.position = "relative";
                    lineDiv.style.whiteSpace = "nowrap";
                    
                    // 行级别抖动：水平和垂直偏移
                    const lineHJitter = (Math.random() - 0.5) * jitterLevel * 1.5;  // 水平偏移
                    const lineVJitter = (Math.random() - 0.5) * jitterLevel * 1;    // 垂直偏移
                    lineDiv.style.marginLeft = `${lineHJitter}px`;
                    lineDiv.style.marginTop = `${lineVJitter}px`;
                    
                    // 逐字符渲染（添加字符级别抖动）
                    for (let i = 0; i < lineText.length; i++) {
                        const charSpan = document.createElement("span");
                        charSpan.textContent = lineText[i];
                        charSpan.style.display = "inline-block";
                        charSpan.style.position = "relative";
                        
                        // 字符级别抖动
                        const charHJitter = (Math.random() - 0.5) * jitterLevel * 0.5;
                        const charVJitter = (Math.random() - 0.5) * jitterLevel * 0.6;
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
        
        // 智能提示：超过推荐值
        if (charsPerLine > 35) {
            const confirm = window.confirm(
                `每行${charsPerLine}字可能过多，建议20-30字。\n\n` +
                `过多的字可能导致：\n` +
                `1. 文字超出A4纸范围\n` +
                `2. 打印后难以识别\n\n` +
                `确定要继续生成吗？`
            );
            if (!confirm) {
                return;
            }
        }
        
        if (linesPerPage > 28) {
            const confirm = window.confirm(
                `每页${linesPerPage}行可能过多，建议15-25行。\n\n` +
                `过多的行可能导致文字超出A4纸高度。\n\n` +
                `确定要继续生成吗？`
            );
            if (!confirm) {
                return;
            }
        }

        // 显示开始生成的提示
        showToast("正在生成图片，请稍候...", "info", 30000);

        const payload = { text };

        if (fontSelector) {
            payload.font = fontSelector.value || "lxgw";
        }

        if (fontWeightSelector) {
            payload.font_weight = parseInt(fontWeightSelector.value, 10) || 400;
        }

        if (fontSizeModeSelector) {
            payload.font_size_mode = fontSizeModeSelector.value || "auto";
        }

        if (charsPerLineInput) {
            const value = parseInt(charsPerLineInput.value, 10);
            if (Number.isFinite(value) && value > 0) {
                payload.chars_per_line = value;
            }
        }

        if (linesPerPageInput) {
            const value = parseInt(linesPerPageInput.value, 10);
            if (Number.isFinite(value) && value > 0) {
                payload.lines_per_page = value;
            }
        }
        
        // 添加手写错误开关
        const enableErrorsSelector = document.getElementById('enable-errors');
        if (enableErrorsSelector) {
            payload.enable_errors = enableErrorsSelector.value === 'true';
        }
        
        // 添加抖动强度参数
        const jitterLevelInput = document.getElementById('jitter-level');
        if (jitterLevelInput) {
            payload.jitter_level = parseInt(jitterLevelInput.value, 10) || 0;
        }

        try {
            const response = await fetch("/api/render-image", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                // 尝试获取错误信息
                const errorData = await response.json().catch(() => null);
                const errorMsg = errorData?.error || "服务器错误，请稍后再试";
                showToast(errorMsg, "error", 5000);
                return;
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;

            let filename = "handwritten_page_1.png";
            const disposition = response.headers.get("Content-Disposition");
            if (disposition) {
                const match = /filename="?([^";]+)"?/i.exec(disposition);
                if (match && match[1]) {
                    filename = decodeURIComponent(match[1]);
                }
            }

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

            // 成功提示
            if (filename.endsWith(".zip")) {
                showToast("✅ 多页图片已打包下载！", "success", 3000);
            } else {
                showToast("✅ 图片已下载成功！", "success", 3000);
            }
        } catch (error) {
            console.error(error);
            showToast("❌ 图片生成失败，请稍后再试", "error", 5000);
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

        const payload = { text };

        if (fontSelector) {
            payload.font = fontSelector.value || "pingfang";
        }
        if (fontWeightSelector) {
            payload.font_weight = parseInt(fontWeightSelector.value, 10) || 400;
        }
        if (fontSizeModeSelector) {
            payload.font_size_mode = fontSizeModeSelector.value || "auto";
        }
        if (charsPerLineInput) {
            payload.chars_per_line = parseInt(charsPerLineInput.value, 10) || 26;
        }
        if (linesPerPageInput) {
            payload.lines_per_page = parseInt(linesPerPageInput.value, 10) || 20;
        }
        
        const enableErrorsSelector = document.getElementById('enable-errors');
        if (enableErrorsSelector) {
            payload.enable_errors = enableErrorsSelector.value === 'true';
        }
        
        const jitterLevelInput = document.getElementById('jitter-level');
        if (jitterLevelInput) {
            payload.jitter_level = parseInt(jitterLevelInput.value, 10) || 6;
        }

        try {
            const response = await fetch("/api/render-pdf", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                const errorMsg = errorData?.error || "PDF生成失败";
                showToast(errorMsg, "error", 5000);
                return;
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "handwritten_pages.pdf";
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

            showToast("✅ PDF已下载成功！", "success", 3000);
        } catch (error) {
            console.error(error);
            showToast("❌ PDF生成失败，请稍后再试", "error", 5000);
        }
    }
});
