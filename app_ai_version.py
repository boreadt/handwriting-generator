"""
AI手写体生成版本 - 使用 handright 库
这是完整的实现框架，你需要先安装依赖
"""
from io import BytesIO
import os
import zipfile

from flask import Flask, render_template, request, jsonify, send_file
from PIL import Image

# 导入 handright 库（需要安装）
try:
    from handright import Template, handwrite
except ImportError:
    print("请先安装 handright: pip install handright")
    handwrite = None

app = Flask(__name__, static_folder="static", template_folder="templates")


# 配置手写模板（模拟真实手写效果）
def create_handwriting_template():
    """创建手写模板配置"""
    template = Template(
        background=Image.new(mode="RGB", size=(1240, 1754), color=(255, 255, 255)),
        font_size=40,
        line_spacing=56,
        left_margin=80,
        top_margin=80,
        right_margin=80,
        bottom_margin=80,
        word_spacing=5,
        line_spacing_sigma=2,  # 行距随机波动
        font_size_sigma=2,  # 字号随机波动
        word_spacing_sigma=2,  # 字间距随机波动
        end_chars=",。!?;:，。！？；：",  # 这些字符后换行
        is_half_char=lambda c: ord(c) < 128,  # 判断半角字符
        is_end_char=lambda c: c in ",。!?;:，。！？；：",
    )
    return template


@app.route("/")
def index():
    return render_template("index.html")


@app.post("/api/convert")
def convert_text():
    data = request.get_json() or {}
    text = data.get("text", "")
    converted = text
    return jsonify({"handwrittenText": converted})


@app.post("/api/render-image")
def render_image():
    """AI生成手写体图片接口"""
    if handwrite is None:
        return jsonify({"error": "handright库未安装，请运行: pip install handright"}), 500

    data = request.get_json() or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "文本内容不能为空"}), 400

    def parse_int(value, default):
        try:
            ivalue = int(value)
            if ivalue <= 0:
                return default
            return ivalue
        except (TypeError, ValueError):
            return default

    chars_per_line = parse_int(data.get("chars_per_line"), 26)
    lines_per_page = parse_int(data.get("lines_per_page"), 20)

    try:
        # 创建手写模板
        template = create_handwriting_template()

        # 使用 handright 生成手写图片
        # 注意：handwrite 函数返回的是 PIL Image 对象列表
        images = handwrite(text, template)

        # 单页直接返回PNG
        if len(images) == 1:
            buffer = BytesIO()
            images[0].save(buffer, format="PNG", dpi=(150, 150))
            buffer.seek(0)
            return send_file(
                buffer,
                mimetype="image/png",
                as_attachment=True,
                download_name="handwritten_A4.png",
            )

        # 多页打包ZIP
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for i, img in enumerate(images, start=1):
                img_bytes = BytesIO()
                img.save(img_bytes, format="PNG", dpi=(150, 150))
                img_bytes.seek(0)
                zf.writestr(f"handwritten_page_{i}.png", img_bytes.getvalue())
        zip_buffer.seek(0)

        return send_file(
            zip_buffer,
            mimetype="application/zip",
            as_attachment=True,
            download_name="handwritten_pages.zip",
        )

    except Exception as e:
        return jsonify({"error": f"生成失败: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
