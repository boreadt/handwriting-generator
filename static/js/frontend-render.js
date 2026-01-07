/**
 * 前端渲染模块 - 使用 Canvas 和 jsPDF 在浏览器端生成图片和 PDF
 */

const FrontendRender = (function() {
    // A4 尺寸 (300 DPI)
    const A4_WIDTH = 2480;
    const A4_HEIGHT = 3508;
    const MARGIN = 160;
    
    /**
     * 根据每行字数和每页行数自动计算字体大小和行高
     */
    function calculateFontSize(charsPerLine, linesPerPage) {
        // A4可用宽度 = 总宽度 - 左右边距
        const availableWidth = A4_WIDTH - MARGIN * 2;
        // A4可用高度 = 总高度 - 上下边距
        const availableHeight = A4_HEIGHT - MARGIN * 2;
        
        // 根据每行字数计算字体大小（宽度限制）
        const maxFontSizeByWidth = Math.floor(availableWidth / charsPerLine * 0.95);
        
        // 根据每页行数计算行高（高度限制）
        const lineHeight = Math.floor(availableHeight / linesPerPage);
        // 字体大小不能超过行高的70%
        const maxFontSizeByHeight = Math.floor(lineHeight * 0.7);
        
        // 取两个限制的较小值
        const fontSize = Math.min(maxFontSizeByWidth, maxFontSizeByHeight);
        
        return {
            size: Math.max(20, fontSize), // 最小20px
            lineHeight: lineHeight
        };
    }
    
    // 字体大小配置（保留作为备用）
    const FONT_SIZES = {
        small: { size: 60, lineHeight: 84 },
        medium: { size: 80, lineHeight: 112 },
        large: { size: 100, lineHeight: 140 }
    };
    
    // 字体映射（key -> CSS font-family）
    let fontMap = {};
    
    /**
     * 设置字体映射
     */
    function setFontMap(map) {
        fontMap = map;
    }
    
    /**
     * 等待字体加载完成
     */
    async function waitForFont(fontFamily) {
        if (document.fonts && document.fonts.load) {
            try {
                await document.fonts.load(`80px "${fontFamily}"`);
                console.log(`字体 ${fontFamily} 加载完成`);
            } catch (e) {
                console.warn(`字体 ${fontFamily} 加载失败:`, e);
            }
        }
    }
    
    /**
     * 切分文本为行和页
     */
    // 标点不计数的拆行辅助（保留标点在行内位置）
    function isPunct(ch) {
        try {
            return /\p{P}/u.test(ch);
        } catch (e) {
            // 如果环境不支持 Unicode 属性，回退到常用标点集合
            return ",.!?;:，。！？；：、（）()[]{}『』”“'\"".indexOf(ch) !== -1;
        }
    }

    function splitParagraphByCharsIgnoringPunct(para, charsPerLine) {
        const chunks = [];
        let cur = '';
        let count = 0;
        for (const ch of para) {
            cur += ch;
            if (!isPunct(ch) && ch !== ' ') {
                count += 1;
            }
            if (count >= charsPerLine) {
                chunks.push(cur);
                cur = '';
                count = 0;
            }
        }
        if (cur !== '') chunks.push(cur);
        return chunks;
    }

    // 按像素宽度拆行（自适应，返回数组 of lines）
    function splitParagraphByWidth(para, fontFamily, fontSize, fontWeight, availableWidth) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.font = `${fontWeight || 400} ${fontSize}px "${fontFamily}"`;

        const chunks = [];
        let cur = '';
        let curWidth = 0;

        for (const ch of para) {
            const w = ctx.measureText(ch).width;
            if (cur === '') {
                cur = ch;
                curWidth = w;
            } else if (curWidth + w <= availableWidth) {
                cur += ch;
                curWidth += w;
            } else {
                chunks.push(cur);
                cur = ch;
                curWidth = w;
            }
        }
        if (cur !== '') chunks.push(cur);
        return chunks;
    }

    function splitTextToPages(text, charsPerLine, linesPerPage, options = {}) {
        const lines = [];
        const paragraphs = text.split("\n");
        const fontFamily = options.fontFamily || 'PingFang';
        const fontSize = options.fontSize || 80;
        const fontWeight = options.fontWeight || 400;
        const availableWidth = A4_WIDTH - MARGIN * 2;

        for (const para of paragraphs) {
            if (!para.trim()) {
                lines.push("");
                continue;
            }

            const trimmed = para.trim();
            if (options.adaptiveWrap) {
                const chunks = splitParagraphByWidth(trimmed, fontFamily, fontSize, fontWeight, availableWidth);
                for (const c of chunks) lines.push(c);
            } else {
                const chunks = splitParagraphByCharsIgnoringPunct(trimmed, charsPerLine);
                for (const c of chunks) lines.push(c);
            }
        }

        // 分页
        const pages = [];
        for (let i = 0; i < lines.length; i += linesPerPage) {
            pages.push(lines.slice(i, i + linesPerPage));
        }

        if (pages.length === 0) pages.push([""]);
        return pages;
    }        
        if (lines.length === 0) {
            lines.push("");
        }
        
        // 分页
        const pages = [];
        for (let i = 0; i < lines.length; i += linesPerPage) {
            pages.push(lines.slice(i, i + linesPerPage));
        }
        
        if (pages.length === 0) {
            pages.push([""]);
        }
        
        return pages;
    }
    
    /**
     * 在 Canvas 上绘制单页内容
     */
    function drawPage(canvas, lines, options) {
        const ctx = canvas.getContext('2d');
        const { fontFamily, fontSize, lineHeight, fontWeight, jitterLevel } = options;
        
        // 设置画布尺寸
        canvas.width = A4_WIDTH;
        canvas.height = A4_HEIGHT;
        
        // 白色背景
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT);
        
        // 设置字体
        ctx.fillStyle = '#1e1e1e';
        ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}", "KaiTi", cursive`;
        ctx.textBaseline = 'top';
        
        let currentY = MARGIN;
        
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const line = lines[lineIdx];
            
            if (currentY > A4_HEIGHT - MARGIN - lineHeight) {
                break;
            }
            
            // 计算抖动参数
            const lineVRange = jitterLevel * 3;
            const lineHRange = jitterLevel * 4;
            const charVRange = jitterLevel * 2;
            const charHRange = jitterLevel * 1.5;
            
            // 行级抖动
            const lineVJitter = lineVRange > 0 ? (Math.random() - 0.5) * 2 * lineVRange : 0;
            const lineHJitter = lineHRange > 0 ? (Math.random() - 0.5) * 2 * lineHRange : 0;
            
            const baseY = currentY + lineVJitter;
            let x = MARGIN + lineHJitter;
            
            // 逐字符绘制
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                
                // 字符级抖动
                const charVJitter = charVRange > 0 ? (Math.random() - 0.5) * 2 * charVRange : 0;
                const charHJitter = charHRange > 0 ? (Math.random() - 0.5) * 2 * charHRange : 0;
                
                const charX = x + charHJitter;
                const charY = baseY + charVJitter;
                
                ctx.fillText(char, charX, charY);
                
                // 计算字符宽度
                const charWidth = ctx.measureText(char).width;
                x += charWidth;
            }
            
            currentY += lineHeight;
        }
        
        return canvas;
    }
    
    /**
     * 生成 A4 图片（返回 Blob 数组）
     */
    async function generateImages(text, options) {
        const {
            fontKey = 'pingfang',
            fontWeight = 400,
            charsPerLine = 26,
            linesPerPage = 20,
            fontSizeMode = 'medium',
            jitterLevel = 6,
            adaptiveWrap = true
        } = options;
        
        // 获取字体信息
        const fontFamily = fontMap[fontKey] || 'PingFang';
        
        // 自动计算字体大小，确保A4纸能容纳（charsPerLine 仅作为提示）
        const fontConfig = calculateFontSize(charsPerLine, linesPerPage);
        
        // 等待字体加载
        await waitForFont(fontFamily);
        
        // 分页（支持 adaptiveWrap）
        const pages = splitTextToPages(text, charsPerLine, linesPerPage, { fontFamily, fontSize: fontConfig.size, fontWeight, adaptiveWrap });
        
        // 生成每页图片
        const blobs = [];
        const canvas = document.createElement('canvas');
        
        for (let i = 0; i < pages.length; i++) {
            drawPage(canvas, pages[i], {
                fontFamily,
                fontSize: fontConfig.size,
                lineHeight: fontConfig.lineHeight,
                fontWeight,
                jitterLevel,
                adaptiveWrap
            });
            
            // 转换为 Blob
            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/png');
            });
            
            blobs.push({
                blob,
                filename: `handwritten_page_${i + 1}.png`
            });
        }
        
        return blobs;
    }
    
    /**
     * 生成 PDF（返回 Blob）
     */
    async function generatePDF(text, options) {
        const {
            fontKey = 'pingfang',
            fontWeight = 400,
            charsPerLine = 26,
            linesPerPage = 20,
            fontSizeMode = 'medium',
            jitterLevel = 6
        } = options;
        
        // 获取字体信息
        const fontFamily = fontMap[fontKey] || 'PingFang';
        
        // 自动计算字体大小，确保A4纸能容纳
        const fontConfig = calculateFontSize(charsPerLine, linesPerPage);
        
        // 等待字体加载
        await waitForFont(fontFamily);
        
        // 分页
        const pages = splitTextToPages(text, charsPerLine, linesPerPage);
        
        // 创建 PDF (A4: 210mm x 297mm)
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        
        const canvas = document.createElement('canvas');
        
        for (let i = 0; i < pages.length; i++) {
            if (i > 0) {
                pdf.addPage();
            }
            
            // 在 Canvas 上绘制
            drawPage(canvas, pages[i], {
                fontFamily,
                fontSize: fontConfig.size,
                lineHeight: fontConfig.lineHeight,
                fontWeight,
                jitterLevel
            });
            
            // 将 Canvas 转为图片添加到 PDF
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
        }
        
        // 返回 Blob
        const pdfBlob = pdf.output('blob');
        return pdfBlob;
    }
    
    /**
     * 下载单个文件
     */
    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }
    
    /**
     * 打包多个文件为 ZIP（需要引入 JSZip）
     * 如果只有一个文件，直接下载
     */
    async function downloadImages(blobs) {
        if (blobs.length === 1) {
            downloadBlob(blobs[0].blob, blobs[0].filename);
            return;
        }
        
        // 多个文件：检查是否有 JSZip
        if (typeof JSZip !== 'undefined') {
            const zip = new JSZip();
            for (const item of blobs) {
                zip.file(item.filename, item.blob);
            }
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            downloadBlob(zipBlob, 'handwritten_pages.zip');
        } else {
            // 没有 JSZip，逐个下载
            for (const item of blobs) {
                downloadBlob(item.blob, item.filename);
                await new Promise(r => setTimeout(r, 500)); // 延迟避免浏览器阻止
            }
        }
    }
    
    /**
     * 下载 PDF
     */
    function downloadPDF(blob) {
        downloadBlob(blob, 'handwritten_pages.pdf');
    }
    
    // 公开 API
    return {
        setFontMap,
        generateImages,
        generatePDF,
        downloadImages,
        downloadPDF,
        downloadBlob
    };
})();

// 导出到全局
window.FrontendRender = FrontendRender;
