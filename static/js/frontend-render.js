/**
 * 前端渲染模块 - 使用 Canvas 和 jsPDF 在浏览器端生成图片和 PDF
 */

const FrontendRender = (function() {
    // A4 尺寸 (300 DPI)
    const A4_WIDTH = 2480;
    const A4_HEIGHT = 3508;
    const MARGIN = 160;
    
    // 字体大小配置
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
    function splitTextToPages(text, charsPerLine, linesPerPage) {
        const lines = [];
        const paragraphs = text.split("\n");
        
        for (const para of paragraphs) {
            if (!para.trim()) {
                lines.push("");
                continue;
            }
            
            let remainText = para.trim();
            while (remainText.length > 0) {
                const chunk = remainText.substring(0, charsPerLine);
                lines.push(chunk);
                remainText = remainText.substring(charsPerLine);
            }
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
            jitterLevel = 6
        } = options;
        
        // 获取字体信息
        const fontFamily = fontMap[fontKey] || 'PingFang';
        const fontConfig = FONT_SIZES[fontSizeMode] || FONT_SIZES.medium;
        
        // 等待字体加载
        await waitForFont(fontFamily);
        
        // 分页
        const pages = splitTextToPages(text, charsPerLine, linesPerPage);
        
        // 生成每页图片
        const blobs = [];
        const canvas = document.createElement('canvas');
        
        for (let i = 0; i < pages.length; i++) {
            drawPage(canvas, pages[i], {
                fontFamily,
                fontSize: fontConfig.size,
                lineHeight: fontConfig.lineHeight,
                fontWeight,
                jitterLevel
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
        const fontConfig = FONT_SIZES[fontSizeMode] || FONT_SIZES.medium;
        
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
