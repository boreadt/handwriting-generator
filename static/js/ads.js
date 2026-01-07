/* ads.js — 广告位工具（示例）
 * 用途：
 *  - 为页面中的 .ad-slot 提供本地占位展示
 *  - 提供 insertAdHtml 与 insertAdScript 两个方法，方便把广告商给的 HTML/JS 动态插入到指定广告位
 * 注意：
 *  - 真实广告代码常含外部 <script src="...">，需保证页面对该域名可访问
 *  - 在中国境内接入广告时，请遵守当地法律法规并确保网站已完成 ICP 备案（如适用）
 *
 * 使用示例：
 *  insertAdHtml('ad-banner-top', '<ins class="xxx">...</ins><script>...</script>');
 *  或 insertAdScript('ad-banner-top', 'https://example.com/ad.js');
 */

(function(){
    function executeScripts(container){
        // 将内联或外部 script 节点提取并在文档中执行（避免被浏览器忽略）
        const scripts = Array.from(container.querySelectorAll('script'));
        scripts.forEach(old => {
            const s = document.createElement('script');
            if (old.src) s.src = old.src;
            if (old.type) s.type = old.type || 'text/javascript';
            // 如果脚本是内联的，复制文本内容
            if (!old.src) s.textContent = old.textContent;
            old.parentNode.removeChild(old);
            document.body.appendChild(s);
        });
    }

    function insertAdHtml(slotId, html){
        const slot = document.getElementById(slotId);
        if (!slot) return console.warn('[ads.js] 未找到广告位：', slotId);
        slot.innerHTML = html;
        executeScripts(slot);
    }

    function insertAdScript(slotId, src){
        const slot = document.getElementById(slotId);
        if (!slot) return console.warn('[ads.js] 未找到广告位：', slotId);
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        slot.appendChild(s);
    }

    // 页面加载时显示占位提示，并在右上角提供一个替换说明（仅开发用）
    document.addEventListener('DOMContentLoaded', ()=>{
        document.querySelectorAll('.ad-slot').forEach(slot => {
            // 如果 slot 只有一个占位节点，则保留，否则不覆盖已有内容
            if (!slot.querySelector('.ad-placeholder')) return;
            slot.style.position = slot.style.position || 'relative';
            const hint = document.createElement('div');
            hint.className = 'ad-insert-hint';
            hint.style.cssText = 'position:absolute;right:8px;top:6px;font-size:11px;color:#888;pointer-events:none;';
            hint.textContent = '替换广告：调用 insertAdHtml/insertAdScript';
            slot.appendChild(hint);
        });

        // 示例：本地测试时可以解除下面一行注释以展示示例图片
        // insertAdHtml('ad-banner-top','<img src="https://via.placeholder.com/900x90?text=示例+顶部广告" alt="示例广告" style="width:100%;height:100%;object-fit:cover;">');
    });

    // 对外暴露函数，方便在控制台或后端脚本中调用
    window.insertAdHtml = insertAdHtml;
    window.insertAdScript = insertAdScript;
})();