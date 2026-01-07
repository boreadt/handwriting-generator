"""启动一个本地静态服务器并在浏览器中打开 /index.html?test=1

用法：
  python scripts/start_test_server.py

说明：
 - 本脚本使用 Python 内置的 http.server 来提供项目根目录的静态文件，便于在浏览器中预览前端界面（无需 Flask）。
 - 打开后请访问 http://localhost:8000/index.html?test=1
"""
import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8000
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

os.chdir(ROOT)

Handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    url = f'http://localhost:{PORT}/index.html?test=1'
    print(f"Serving {ROOT} at {url}")
    try:
        webbrowser.open(url)
    except Exception as e:
        print("无法自动打开浏览器：", e)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n已停止服务器')
        httpd.server_close()
        sys.exit(0)
