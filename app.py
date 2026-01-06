"""手写体文本生成器 - 简化稳定版"""
from io import BytesIO
import os
import random
import zipfile
import base64

from flask import Flask, render_template, request, jsonify, send_file
from PIL import Image, ImageDraw, ImageFont
import fitz  # PyMuPDF
import json

app = Flask(__name__, static_folder="static", template_folder="templates")

# 字体配置
FONT_DIR = os.path.join(app.static_folder, "fonts")
AVAILABLE_FONTS = {
    "lxgw": {"file": "LXGWWenKai-Regular.ttf", "name": "霞鹜文楷", "css_family": "LXGW WenKai"},
    "dymon": {"file": "Dymon-ShouXieTi.otf", "name": "呆萌手写体", "css_family": "Dymon"},
    "xieyiti": {"file": "写意体.ttf", "name": "写意体", "css_family": "XieYiTi"},
    "xieyitisc": {"file": "写意体sc.ttf", "name": "写意体SC", "css_family": "XieYiTiSC"},
    "pingfang": {"file": "平方时光体.ttf", "name": "平方时光体", "css_family": "PingFang"},
    "honglei": {"file": "鸿雷小纸条青春体.ttf", "name": "鸿雷小纸条青春体", "css_family": "HongLei"},
    "jianjian": {"file": "坚坚体.ttf", "name": "坚坚体", "css_family": "JianJian"},
    "shangshangqian": {"file": "平方上上谦体.ttf", "name": "平方上上谦体", "css_family": "ShangShangQian"},
}


def get_font_path(font_key):
    font_info = AVAILABLE_FONTS.get(font_key, AVAILABLE_FONTS["lxgw"])
    return os.path.join(FONT_DIR, font_info["file"])


@app.route("/")
def index():
    return render_template("index.html")


@app.get("/api/fonts")
def get_fonts():
    fonts_list = [
        {"key": key, "name": info["name"], "cssFamily": info["css_family"]}
        for key, info in AVAILABLE_FONTS.items()
    ]
    return jsonify({"fonts": fonts_list})


@app.post("/api/convert")
def convert_text():
    data = request.get_json() or {}
    text = data.get("text", "")
    return jsonify({"handwrittenText": text})


@app.post("/api/render-image")
def render_image():
    print("\n========== 开始处理图片生成请求 ==========")
    
    try:
        # 获取请求数据
        data = request.get_json() or {}
        text = (data.get("text") or "").strip()
        
        if not text:
            print("错误: 文本为空")
            return jsonify({"error": "请输入文字"}), 400
        
        print(f"文本长度: {len(text)} 字符")
        
        # 获取参数
        font_key = data.get("font", "pingfang")
        font_weight = int(data.get("font_weight", 400))
        chars_per_line = int(data.get("chars_per_line", 26))
        lines_per_page = int(data.get("lines_per_page", 20))
        font_size_mode = data.get("font_size_mode", "medium")  # 默认中等字体
        enable_errors = data.get("enable_errors", False)  # 默认关闭错误功能
        jitter_level = int(data.get("jitter_level", 0))  # 抖动强度，默认0（无抖动）
        
        # 限制抖动强度范围
        jitter_level = max(0, min(10, jitter_level))
        
        # 参数验证
        if chars_per_line < 1 or chars_per_line > 100:
            print(f"错误: 每行字数({chars_per_line})超出范围")
            return jsonify({"error": "每行字数必须在1-100之间"}), 400
        
        if lines_per_page < 1 or lines_per_page > 50:
            print(f"错误: 每页行数({lines_per_page})超出范围")
            return jsonify({"error": "每页行数必须在1-50之间"}), 400
        
        # 智能警告（只记录，不阻止）
        if chars_per_line > 35:
            print(f"⚠️ 警告: 每行{chars_per_line}字可能超出A4纸宽度，建议20-30字")
        
        if lines_per_page > 28:
            print(f"⚠️ 警告: 每页{lines_per_page}行可能超出A4纸高度，建议15-25行")
        
        print(f"参数: 字体={font_key}, 粗细={font_weight}, 每行={chars_per_line}字, 每页={lines_per_page}行, 字体大小模式={font_size_mode}")
        
        # A4纸尺寸 (300 DPI)
        width, height = 2480, 3508
        margin = 160
        bg_color = (255, 255, 255)
        text_color = (30, 30, 30)
        
        # 字体大小设置：小/中/大
        if font_size_mode == "small":
            font_size = 60
            line_height = 84
            print(f"字体大小: 小 ({font_size}pt)")
        elif font_size_mode == "large":
            font_size = 100
            line_height = 140
            print(f"字体大小: 大 ({font_size}pt)")
        else:  # medium 默认
            font_size = 80
            line_height = 112
            print(f"字体大小: 中 ({font_size}pt)")
        
        # 字体加粗
        stroke_width = max(0, (font_weight - 400) // 100)
        
        # 加载字体
        font_path = get_font_path(font_key)
        print(f"字体路径: {font_path}")
        print(f"字体文件存在: {os.path.exists(font_path)}")
        
        try:
            font = ImageFont.truetype(font_path, font_size)
            print("✓ 字体加载成功")
        except Exception as e:
            print(f"✗ 字体加载失败: {e}")
            print("使用默认字体")
            font = ImageFont.load_default()
        
        # 切分文本为行
        logical_lines = []
        for para in text.split("\n"):
            if not para.strip():
                logical_lines.append("")
                continue
            para = para.strip()
            while para:
                logical_lines.append(para[:chars_per_line])
                para = para[chars_per_line:]
        
        if not logical_lines:
            logical_lines = [""]
        
        total_lines = len(logical_lines)
        estimated_pages = (total_lines + lines_per_page - 1) // lines_per_page
        print(f"总行数: {total_lines}, 预计页数: {estimated_pages}")
        
        # 限制最大页数
        MAX_PAGES = 50
        if estimated_pages > MAX_PAGES:
            print(f"页数超限: {estimated_pages} > {MAX_PAGES}")
            return jsonify({"error": f"文本过长，请分批处理（最多{MAX_PAGES}页）"}), 400
        
        # 生成图片
        pages = []
        idx = 0
        
        while idx < total_lines and len(pages) < MAX_PAGES:
            page_num = len(pages) + 1
            print(f"  生成第 {page_num} 页...")
            
            image = Image.new("RGB", (width, height), color=bg_color)
            draw = ImageDraw.Draw(image)
            current_y = margin
            
            lines_this_page = logical_lines[idx : idx + lines_per_page]
            
            for line_idx, line in enumerate(lines_this_page):
                if current_y > height - margin - line_height:
                    break
                
                # 根据抖动强度计算抖动范围
                # jitter_level=0 时无抖动，jitter_level=10 时最大抖动
                line_v_range = jitter_level * 3  # 行垂直抖动: 0-30px
                line_h_range = jitter_level * 4  # 行水平偏移: 0-40px
                char_v_range = jitter_level * 2  # 字符垂直抖动: 0-20px
                char_h_range = int(jitter_level * 1.5)  # 字符水平抖动: 0-15px
                
                # 8. 每行垂直位置随机抖动（模拟手写行间不对齐）
                line_vertical_jitter = random.randint(-line_v_range, line_v_range) if line_v_range > 0 else 0
                base_y = current_y + line_vertical_jitter
                
                # 字符级别的垂直抖动
                jitter_y = random.randint(-char_v_range, char_v_range) if char_v_range > 0 else 0
                
                # 9. 每行左侧起始位置随机偏移（模拟手写左右不对齐）
                line_horizontal_jitter = random.randint(-line_h_range, line_h_range) if line_h_range > 0 else 0
                x = margin + line_horizontal_jitter
                
                # 绘制当前行的文本，添加错字和纠正标记
                processed_chars = list(line)
                error_positions = []  # 记录错误位置 [(pos, correct_char, wrong_char), ...]
                
                # 随机引入错字 (约5%概率) - 仅当开启手写错误功能时
                if enable_errors:
                    for i in range(len(processed_chars)):
                        if random.random() < 0.05:  # 5%概率
                            original_char = processed_chars[i]
                            
                            # 生成相似的错字
                            similar_chars = {
                                '人': ['入', '八'],
                                '大': ['太', '犬'],
                                '木': ['本', '术'],
                                '日': ['曰', '田', '目'],
                                '己': ['已', '巳'],
                                '又': ['叉', '及'],
                                '白': ['百', '自'],
                                '有': ['友', '月'],
                                '问': ['间', '闲'],
                                '上': ['下', '土'],
                                '下': ['上', '土'],
                                '小': ['少', '小'],
                                '天': ['夫', '天'],
                                '王': ['玉', '王'],
                            }
                            
                            if original_char in similar_chars:
                                wrong_char = random.choice(similar_chars[original_char])
                            else:
                                # 使用一些常见的易混淆字符
                                wrong_char = random.choice(['日', '曰', '人', '入', '己', '已', '巳', '大', '太', '木', '本', '又', '叉', '自', '白', '有', '友', '月'])
                            
                            processed_chars[i] = wrong_char
                            error_positions.append((i, original_char, wrong_char))
                
                # 绘制字符
                char_coords = []  # 记录每个字符的坐标
                for ch_idx, ch in enumerate(processed_chars):
                    # 字符水平抖动（根据抖动强度）
                    jitter_x = random.randint(-char_h_range, char_h_range) if char_h_range > 0 else 0
                    
                    # 添加更多手写真实感效果
                    # 4. 偶尔添加轻微的字符大小变化
                    if random.random() < 0.04:  # 4%概率
                        # 随机调整字符大小
                        temp_font_size = font_size + random.randint(-2, 2)
                        if temp_font_size != font_size:
                            try:
                                temp_font = ImageFont.truetype(font_path, temp_font_size)
                                draw.text(
                                    (x + jitter_x, base_y + jitter_y), 
                                    ch, 
                                    fill=text_color, 
                                    font=temp_font
                                )
                            except:
                                temp_font = ImageFont.load_default()
                                draw.text(
                                    (x + jitter_x, base_y + jitter_y), 
                                    ch, 
                                    fill=text_color, 
                                    font=temp_font
                                )
                        else:
                            if stroke_width > 0:
                                draw.text(
                                    (x + jitter_x, base_y + jitter_y), 
                                    ch, 
                                    fill=text_color, 
                                    font=font,
                                    stroke_width=stroke_width,
                                    stroke_fill=text_color
                                )
                            else:
                                draw.text(
                                    (x + jitter_x, base_y + jitter_y), 
                                    ch, 
                                    fill=text_color, 
                                    font=font
                                )
                    else:
                        if stroke_width > 0:
                            draw.text(
                                (x + jitter_x, base_y + jitter_y), 
                                ch, 
                                fill=text_color, 
                                font=font,
                                stroke_width=stroke_width,
                                stroke_fill=text_color
                            )
                        else:
                            draw.text(
                                (x + jitter_x, base_y + jitter_y), 
                                ch, 
                                fill=text_color, 
                                font=font
                            )
                    
                    # 记录字符坐标用于错误纠正
                    char_coords.append((x + jitter_x, base_y + jitter_y))
                    
                    # 5. 偶尔添加轻微的笔画重写效果（模拟重写）
                    if random.random() < 0.02:  # 2%概率
                        # 稍微加深颜色，模拟重写效果
                        darker_color = tuple(min(255, c - 30) for c in text_color) if isinstance(text_color, tuple) else (30, 30, 30)
                        draw.text(
                            (x + jitter_x + random.randint(-1, 1), base_y + jitter_y + random.randint(-1, 1)), 
                            ch, 
                            fill=darker_color, 
                            font=font
                        )
                                        
                    # 6. 偶尔添加轻微的墨水不均匀效果
                    if random.random() < 0.03:  # 3%概率
                        # 随机调整字符颜色深浅
                        color_variation = random.randint(-20, 10)
                        varied_color = tuple(max(0, min(255, c + color_variation)) for c in text_color) if isinstance(text_color, tuple) else text_color
                        draw.text(
                            (x + jitter_x, base_y + jitter_y), 
                            ch, 
                            fill=varied_color, 
                            font=font
                        )
                                        
                    # 7. 偶尔模拟连笔效果（字符间距变化）
                    if random.random() < 0.01:  # 1%概率
                        # 模拟连笔，字符间距更紧密
                        char_spacing_multiplier = random.uniform(0.3, 0.8)
                        w = w * char_spacing_multiplier
                                        
                    try:
                        bbox = draw.textbbox((0, 0), ch, font=font)
                        w = bbox[2] - bbox[0]
                    except AttributeError:
                        w, _ = draw.textsize(ch, font=font)
                                    
                    # 根据每行字数动态调整字间距
                    if chars_per_line <= 20:
                        # 少字数：较窄的字间距，更紧凑
                        extra_space = random.randint(0, 3)
                    elif chars_per_line <= 35:
                        # 中等字数：适中的字间距
                        extra_space = random.randint(-1, 3)
                    else:
                        # 多字数：较窄的字间距，但保持可读性
                        extra_space = random.randint(-2, 2)
                                    
                    # 添加人为小错误以增加真实感
                    # 1. 偶尔添加轻微的字符倾斜
                    if random.random() < 0.05:  # 5%概率
                        # 创建一个小的倾斜效果
                        tilt_offset = random.randint(-2, 2)
                        x += tilt_offset
                                        
                    # 2. 偶尔添加轻微的字符重叠或间距异常
                    if random.random() < 0.03:  # 3%概率
                        # 随机增加或减少间距
                        extra_space += random.randint(-4, 4)
                                        
                    # 3. 偶尔添加笔画抖动
                    if jitter_level > 0 and random.random() < 0.02:  # 2%概率
                        # 模拟手写时的轻微抖动（根据抖动强度）
                        stroke_jitter = random.randint(-char_h_range * 2, char_h_range * 2) if char_h_range > 0 else 0
                        x += stroke_jitter
                                    
                    x += w + extra_space
                
                # 绘制错误纠正标记
                for pos, correct_char, wrong_char in error_positions:
                    if pos < len(char_coords):
                        pos_x, pos_y = char_coords[pos]
                        
                        # 绘制斜线划掉错字
                        char_width = 20  # 估算字符宽度
                        char_height = font_size
                        
                        # 绘制斜线
                        line_start = (pos_x, pos_y)
                        line_end = (pos_x + char_width, pos_y + char_height)
                        draw.line([line_start, line_end], fill=(128, 0, 0), width=1)
                        
                        # 在旁边写上正确的字
                        correct_char_x = pos_x + char_width + 2
                        draw.text(
                            (correct_char_x, pos_y), 
                            correct_char, 
                            fill=text_color, 
                            font=font
                        )

                current_y += line_height + random.randint(-4, 4)
            
            pages.append(image)
            idx += lines_per_page
        
        print(f"✓ 总共生成 {len(pages)} 页")
        
        # 返回结果
        if len(pages) == 1:
            print("保存单页PNG...")
            buffer = BytesIO()
            pages[0].save(buffer, format="PNG", dpi=(300, 300))
            buffer.seek(0)
            print(f"✓ 文件大小: {len(buffer.getvalue())} bytes")
            print("========== 请求处理成功 ==========\n")
            
            return send_file(
                buffer,
                mimetype="image/png",
                as_attachment=True,
                download_name="handwritten_page_1.png",
            )
        
        print("打包多页ZIP...")
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for i, img in enumerate(pages, start=1):
                img_bytes = BytesIO()
                img.save(img_bytes, format="PNG", dpi=(300, 300))
                img_bytes.seek(0)
                filename = f"handwritten_page_{i:03d}.png"
                zf.writestr(filename, img_bytes.getvalue())
        zip_buffer.seek(0)
        
        print(f"✓ ZIP大小: {len(zip_buffer.getvalue())} bytes")
        print("========== 请求处理成功 ==========\n")
        
        return send_file(
            zip_buffer,
            mimetype="application/zip",
            as_attachment=True,
            download_name="handwritten_pages.zip",
        )
    
    except Exception as e:
        print(f"\n!!! 严重错误 !!!")
        print(f"错误类型: {type(e).__name__}")
        print(f"错误信息: {str(e)}")
        import traceback
        traceback.print_exc()
        print("========== 请求处理失败 ==========\n")
        return jsonify({"error": f"生成失败: {str(e)}"}), 500


@app.post("/api/render-pdf")
def render_pdf():
    """PDF生成API - 将手写体图片合并为PDF"""
    print("\n========== 开始处理PDF生成请求 ==========")
    
    try:
        # 获取请求数据
        data = request.get_json() or {}
        text = (data.get("text") or "").strip()
        
        if not text:
            return jsonify({"error": "请输入文字"}), 400
        
        # 获取参数
        font_key = data.get("font", "pingfang")
        font_weight = int(data.get("font_weight", 400))
        chars_per_line = int(data.get("chars_per_line", 26))
        lines_per_page = int(data.get("lines_per_page", 20))
        font_size_mode = data.get("font_size_mode", "medium")  # 默认中等字体
        enable_errors = data.get("enable_errors", False)
        jitter_level = int(data.get("jitter_level", 6))
        jitter_level = max(0, min(10, jitter_level))
        
        print(f"PDF生成参数: 字体={font_key}, 每行={chars_per_line}字, 每页={lines_per_page}行")
        
        # A4纸尺寸 (300 DPI)
        width, height = 2480, 3508
        margin = 160
        bg_color = (255, 255, 255)
        text_color = (30, 30, 30)
        
        # 字体大小设置
        if font_size_mode == "small":
            font_size = 60
        elif font_size_mode == "large":
            font_size = 100
        else:  # medium 默认
            font_size = 80
        
        line_height = int(font_size * 1.4)
        stroke_width = max(0, (font_weight - 400) // 100)
        
        # 加载字体
        font_path = get_font_path(font_key)
        try:
            font = ImageFont.truetype(font_path, font_size)
        except:
            font = ImageFont.load_default()
        
        # 切分文本
        logical_lines = []
        for para in text.split("\n"):
            if not para.strip():
                logical_lines.append("")
                continue
            para = para.strip()
            while para:
                logical_lines.append(para[:chars_per_line])
                para = para[chars_per_line:]
        
        if not logical_lines:
            logical_lines = [""]
        
        total_lines = len(logical_lines)
        MAX_PAGES = 50
        estimated_pages = (total_lines + lines_per_page - 1) // lines_per_page
        
        if estimated_pages > MAX_PAGES:
            return jsonify({"error": f"文本过长，请分批处理（最多{MAX_PAGES}页）"}), 400
        
        # 生成图片页面
        pages = []
        idx = 0
        
        while idx < total_lines and len(pages) < MAX_PAGES:
            image = Image.new("RGB", (width, height), color=bg_color)
            draw = ImageDraw.Draw(image)
            current_y = margin
            
            lines_this_page = logical_lines[idx : idx + lines_per_page]
            
            for line in lines_this_page:
                if current_y > height - margin - line_height:
                    break
                
                # 抖动效果
                line_v_range = jitter_level * 3
                line_h_range = jitter_level * 4
                char_v_range = jitter_level * 2
                char_h_range = int(jitter_level * 1.5)
                
                line_v_jitter = random.randint(-line_v_range, line_v_range) if line_v_range > 0 else 0
                line_h_jitter = random.randint(-line_h_range, line_h_range) if line_h_range > 0 else 0
                
                base_y = current_y + line_v_jitter
                x = margin + line_h_jitter
                
                for ch in line:
                    jitter_x = random.randint(-char_h_range, char_h_range) if char_h_range > 0 else 0
                    jitter_y = random.randint(-char_v_range, char_v_range) if char_v_range > 0 else 0
                    
                    if stroke_width > 0:
                        draw.text((x + jitter_x, base_y + jitter_y), ch, fill=text_color, font=font, stroke_width=stroke_width, stroke_fill=text_color)
                    else:
                        draw.text((x + jitter_x, base_y + jitter_y), ch, fill=text_color, font=font)
                    
                    try:
                        bbox = draw.textbbox((0, 0), ch, font=font)
                        w = bbox[2] - bbox[0]
                    except:
                        w = font_size
                    
                    x += w + random.randint(-2, 4)
                
                current_y += line_height + random.randint(-4, 4)
            
            pages.append(image)
            idx += lines_per_page
        
        print(f"生成 {len(pages)} 页图片")
        
        # 生成PDF
        pdf_buffer = BytesIO()
        
        if len(pages) == 1:
            # 单页PDF
            pages[0].save(pdf_buffer, format="PDF", resolution=300.0)
        else:
            # 多页PDF
            pages[0].save(
                pdf_buffer, 
                format="PDF", 
                resolution=300.0,
                save_all=True, 
                append_images=pages[1:]
            )
        
        pdf_buffer.seek(0)
        
        print(f"✓ PDF生成完成，大小: {len(pdf_buffer.getvalue())} bytes")
        print("========== PDF请求处理成功 ==========\n")
        
        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name="handwritten_pages.pdf"
        )
    
    except Exception as e:
        print(f"PDF生成错误: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"PDF生成失败: {str(e)}"}), 500


@app.post("/api/edit-pdf")
def edit_pdf():
    """PDF编辑API - 在上传的PDF上添加手写体文字"""
    print("\n========== 开始处理PDF编辑请求 ==========")
    
    try:
        # 检查是否有上传文件
        if 'pdf' not in request.files:
            return jsonify({"error": "请上传PDF文件"}), 400
        
        pdf_file = request.files['pdf']
        data_str = request.form.get('data', '{}')
        data = json.loads(data_str)
        
        regions = data.get('regions', [])
        if not regions:
            return jsonify({"error": "请框选要填写的区域"}), 400
        
        # 获取字体设置
        font_key = data.get('font', 'pingfang')
        font_weight = int(data.get('font_weight', 400))
        jitter_level = int(data.get('jitter_level', 0))  # PDF编辑模式默认不抖动
        jitter_level = max(0, min(10, jitter_level))
        font_size_mode = data.get('font_size_mode', 'medium')  # 获取字体大小设置
        
        print(f"PDF编辑参数: 字体={font_key}, 粗细={font_weight}, 抖动={jitter_level}, 字号={font_size_mode}")
        print(f"框选区域数: {len(regions)}")
        
        # 加载字体文件
        font_path = get_font_path(font_key)
        if not os.path.exists(font_path):
            font_path = get_font_path('lxgw')  # 降级到默认字体
        
        # 读取PDF
        pdf_bytes = pdf_file.read()
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        print(f"PDF页数: {len(doc)}")
        
        # 按页分组区域
        regions_by_page = {}
        for region in regions:
            page_num = region.get('pageNum', 1)
            if page_num not in regions_by_page:
                regions_by_page[page_num] = []
            regions_by_page[page_num].append(region)
        
        # 处理每个页面
        for page_num, page_regions in regions_by_page.items():
            if page_num > len(doc):
                continue
            
            page = doc[page_num - 1]  # fitz使用0索引
            page_rect = page.rect
            
            print(f"  处理第{page_num}页，区域数: {len(page_regions)}")
            
            for region in page_regions:
                text = region.get('text', '').strip()
                if not text:
                    continue
                
                # 区域坐标 (从canvas坐标转换为PDF坐标)
                x = float(region.get('x', 0))
                y = float(region.get('y', 0))
                width = float(region.get('width', 100))
                height = float(region.get('height', 50))
                
                # 计算字体大小 - 使用用户选择的字号
                # 小:12px, 中:16px, 大:20px 对应到前端预览
                if font_size_mode == 'small':
                    base_font_size = 12
                elif font_size_mode == 'large':
                    base_font_size = 20
                else:  # medium
                    base_font_size = 16
                
                # 根据区域高度进行微调，确保文字不超出边界
                font_size = min(base_font_size, height * 0.8)
                font_size = max(8, min(font_size, 48))  # 限制范围
                
                # 创建手写体图片
                img_width = int(width * 3)  # 3倍分辨率
                img_height = int(height * 3)
                
                if img_width < 10 or img_height < 10:
                    continue
                
                # 创建透明背景图片
                img = Image.new('RGBA', (img_width, img_height), (255, 255, 255, 0))
                draw = ImageDraw.Draw(img)
                
                # 加载字体
                pil_font_size = int(font_size * 3)
                try:
                    pil_font = ImageFont.truetype(font_path, pil_font_size)
                except:
                    pil_font = ImageFont.load_default()
                
                # 字体加粗
                stroke_width = max(0, (font_weight - 400) // 100)
                
                # 渲染文字 (带抖动效果)
                text_color = (30, 30, 30, 255)
                current_x = 5
                current_y = 5
                
                # 计算抖动范围
                char_h_range = int(jitter_level * 1.5)
                char_v_range = jitter_level * 2
                
                for char in text:
                    if char == '\n':
                        current_x = 5
                        current_y += int(pil_font_size * 1.2)
                        continue
                    
                    # 字符抖动
                    jitter_x = random.randint(-char_h_range, char_h_range) if char_h_range > 0 else 0
                    jitter_y = random.randint(-char_v_range, char_v_range) if char_v_range > 0 else 0
                    
                    draw.text(
                        (current_x + jitter_x, current_y + jitter_y),
                        char,
                        fill=text_color,
                        font=pil_font,
                        stroke_width=stroke_width,
                        stroke_fill=text_color if stroke_width > 0 else None
                    )
                    
                    # 计算字符宽度
                    try:
                        bbox = draw.textbbox((0, 0), char, font=pil_font)
                        char_width = bbox[2] - bbox[0]
                    except:
                        char_width = pil_font_size
                    
                    current_x += char_width + random.randint(-1, 2)
                    
                    # 换行检查
                    if current_x > img_width - pil_font_size:
                        current_x = 5
                        current_y += int(pil_font_size * 1.2)
                
                # 将图片转换为字节
                img_buffer = BytesIO()
                img.save(img_buffer, format='PNG')
                img_buffer.seek(0)
                
                # 将图片插入PDF
                img_rect = fitz.Rect(x, y, x + width, y + height)
                page.insert_image(img_rect, stream=img_buffer.getvalue())
                
                print(f"    插入文字: '{text[:20]}...' at ({x:.1f}, {y:.1f})")
        
        # 保存编辑后的PDF
        output_buffer = BytesIO()
        doc.save(output_buffer)
        doc.close()
        output_buffer.seek(0)
        
        print(f"✓ PDF编辑完成，大小: {len(output_buffer.getvalue())} bytes")
        print("========== PDF编辑请求处理成功 ==========\n")
        
        return send_file(
            output_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name="edited_document.pdf"
        )
    
    except Exception as e:
        print(f"PDF编辑错误: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"PDF编辑失败: {str(e)}"}), 500


@app.post("/api/edit-pdf-screenshot")
def edit_pdf_screenshot():
    """PDF编辑API - 使用截图方式保证所见即所得"""
    print("\n========== 开始处理PDF截图编辑请求 ==========")
    
    try:
        # 检查是否有上传文件
        if 'pdf' not in request.files:
            return jsonify({"error": "请上传PDF文件"}), 400
        
        pdf_file = request.files['pdf']
        data_str = request.form.get('data', '{}')
        data = json.loads(data_str)
        
        regions = data.get('regions', [])
        if not regions:
            return jsonify({"error": "请框选要填写的区域"}), 400
        
        print(f"框选区域数: {len(regions)}")
        
        # 读取PDF
        pdf_bytes = pdf_file.read()
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        print(f"PDF页数: {len(doc)}")
        
        # 按页分组区域
        regions_by_page = {}
        for region in regions:
            page_num = region.get('pageNum', 1)
            if page_num not in regions_by_page:
                regions_by_page[page_num] = []
            regions_by_page[page_num].append(region)
        
        # 处理每个页面
        for page_num, page_regions in regions_by_page.items():
            if page_num > len(doc):
                continue
            
            page = doc[page_num - 1]  # fitz使用0索引
            
            print(f"  处理第{page_num}页，区域数: {len(page_regions)}")
            
            for region in page_regions:
                image_data = region.get('image', '')
                if not image_data:
                    continue
                
                # 区域坐标
                x = float(region.get('x', 0))
                y = float(region.get('y', 0))
                width = float(region.get('width', 100))
                height = float(region.get('height', 50))
                
                # 解析base64图片
                try:
                    # 移除data:image/png;base64,前缀
                    if ',' in image_data:
                        image_data = image_data.split(',')[1]
                    
                    img_bytes = base64.b64decode(image_data)
                    
                    # 将图片插入PDF
                    img_rect = fitz.Rect(x, y, x + width, y + height)
                    page.insert_image(img_rect, stream=img_bytes)
                    
                    print(f"    插入截图 at ({x:.1f}, {y:.1f}), 大小: {width:.1f}x{height:.1f}")
                    
                except Exception as e:
                    print(f"    插入图片失败: {str(e)}")
                    continue
        
        # 保存编辑后的PDF
        output_buffer = BytesIO()
        doc.save(output_buffer)
        doc.close()
        output_buffer.seek(0)
        
        print(f"✓ PDF编辑完成，大小: {len(output_buffer.getvalue())} bytes")
        print("========== PDF截图编辑请求处理成功 ==========\n")
        
        return send_file(
            output_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name="edited_document.pdf"
        )
    
    except Exception as e:
        print(f"PDF截图编辑错误: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"PDF编辑失败: {str(e)}"}), 500


if __name__ == "__main__":
    print("\n启动手写体生成服务器...")
    print("访问地址: http://127.0.0.1:5000")
    print("按 Ctrl+C 停止服务器\n")
    app.run(host="0.0.0.0", port=5000, debug=True)
