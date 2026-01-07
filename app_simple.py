"""
超级简化版 - 只实现基本的文字转图片下载功能
"""
from io import BytesIO
import os

from flask import Flask, render_template, request, jsonify, send_file
from PIL import Image, ImageDraw, ImageFont

app = Flask(__name__, static_folder="static", template_folder="templates")

# 字体目录
FONT_DIR = os.path.join(app.static_folder, "fonts")

@app.route("/")
def index():
    return render_template("index.html")


@app.get("/api/fonts")
def get_fonts():
    """返回字体列表"""
    fonts_list = [
        {"key": "lxgw", "name": "霞鹜文楷", "cssFamily": "LXGW WenKai"},
        {"key": "dymon", "name": "呆萌手写体", "cssFamily": "Dymon"},
    ]
    return jsonify({"fonts": fonts_list})


@app.post("/api/convert")
def convert_text():
    """简单返回原文"""
    data = request.get_json() or {}
    text = data.get("text", "")
    return jsonify({"handwrittenText": text})


@app.post("/api/render-image")
def render_image():
    """生成图片 - 超级简化版"""
    print("\n===== 收到下载请求 =====")
    
    try:
        # 获取数据
        data = request.get_json() or {}
        text = (data.get("text") or "").strip()
        
        print(f"文本内容: {text[:50]}..." if len(text) > 50 else f"文本内容: {text}")
        
        if not text:
            print("错误: 文本为空")
            return jsonify({"error": "请输入文字"}), 400
        
        # A4纸尺寸 (简化版，150 DPI)
        width, height = 1240, 1754
        margin = 80
        
        print(f"创建图片: {width}x{height}")
        
        # 创建白色背景
        image = Image.new("RGB", (width, height), color=(255, 255, 255))
        draw = ImageDraw.Draw(image)
        
        # 加载字体
        font_path = os.path.join(FONT_DIR, "LXGWWenKai-Regular.ttf")
        print(f"字体路径: {font_path}")
        print(f"字体文件存在: {os.path.exists(font_path)}")
        
        try:
            font = ImageFont.truetype(font_path, 40)
            print("字体加载成功")
        except Exception as e:
            print(f"字体加载失败: {e}, 使用默认字体")
            font = ImageFont.load_default()
        
        # 简单绘制文字（每行26个字，计数忽略标点）
        chars_per_line = int(data.get("chars_per_line", 26))
        y = margin
        line_height = 56
        
        print(f"开始绘制文字，每行{chars_per_line}字（标点不计数）")
        
        # 按每行字数切分（忽略标点计数）
        import unicodedata
        def is_punctuation(ch: str) -> bool:
            if not ch:
                return False
            return unicodedata.category(ch).startswith("P")

        def split_para(para: str, chars_per_line: int):
            if para is None or para == "":
                return [""]
            chunks = []
            cur = ""
            count = 0
            for ch in para:
                cur += ch
                if not is_punctuation(ch) and not ch.isspace():
                    count += 1
                if count >= chars_per_line:
                    chunks.append(cur)
                    cur = ""
                    count = 0
            if cur:
                chunks.append(cur)
            return chunks

        lines = []
        for para in text.split("\n"):
            if not para.strip():
                lines.append("")
                continue
            para = para.strip()
            lines.extend(split_para(para, chars_per_line))
        
        print(f"总共{len(lines)}行")
        
        # 绘制每一行
        for i, line in enumerate(lines):
            if y > height - margin - line_height:
                print(f"第{i+1}行超出页面，停止绘制")
                break
            
            draw.text((margin, y), line, fill=(30, 30, 30), font=font)
            y += line_height
        
        print("文字绘制完成")
        
        # 保存到内存
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        buffer.seek(0)
        
        file_size = len(buffer.getvalue())
        print(f"PNG生成成功，大小: {file_size} 字节")
        print("===== 请求处理完成 =====\n")
        
        return send_file(
            buffer,
            mimetype="image/png",
            as_attachment=True,
            download_name="handwritten.png",
        )
    
    except Exception as e:
        print(f"\n!!! 严重错误 !!!")
        print(f"错误类型: {type(e).__name__}")
        print(f"错误信息: {str(e)}")
        import traceback
        traceback.print_exc()
        print("===== 请求失败 =====\n")
        return jsonify({"error": f"生成失败: {str(e)}"}), 500


if __name__ == "__main__":
    print("启动简化版服务器...")
    print("访问 http://127.0.0.1:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
