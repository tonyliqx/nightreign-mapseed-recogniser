#!/usr/bin/env python3
"""
HTTP服务器 - 支持局域网访问的静态文件服务器
用于运行nightreign-mapseed-recogniser项目
"""

import http.server
import socketserver
import os
import sys
import socket
from pathlib import Path

# 配置
PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """自定义HTTP请求处理器，添加CORS支持"""
    
    def end_headers(self):
        # 添加CORS头
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()
    
    def do_OPTIONS(self):
        """处理OPTIONS请求"""
        self.send_response(200)
        self.end_headers()
    
    def log_message(self, format, *args):
        """自定义日志格式"""
        print(f"[{self.log_date_time_string()}] {format % args}")

def get_local_ip():
    """获取本地网络IP地址"""
    try:
        # 创建一个UDP socket连接到公共DNS服务器
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
        return local_ip
    except Exception:
        return "localhost"

def main():
    """主函数"""
    # 切换到项目目录
    os.chdir(DIRECTORY)
    
    # 获取本地IP
    local_ip = get_local_ip()
    
    print("🚀 启动HTTP服务器...")
    print(f"📁 服务目录: {DIRECTORY}")
    print(f"🌐 服务端口: {PORT}")
    print("")
    print("访问地址:")
    print(f"  💻 本机访问: http://localhost:{PORT}/")
    print(f"  📱 局域网访问: http://{local_ip}:{PORT}/")
    print("")
    print("可用页面:")
    print(f"  📊 主应用: http://{local_ip}:{PORT}/index.html")
    print(f"  📊 高级应用: http://{local_ip}:{PORT}/index-advanced.html")
    print(f"  🔧 POI提取: http://{local_ip}:{PORT}/extraction.html")
    print("")
    print("按 Ctrl+C 停止服务器")
    print("-" * 50)
    
    try:
        # 创建HTTP服务器
        with socketserver.TCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
            # 允许地址重用
            httpd.allow_reuse_address = True
            
            print(f"✅ 服务器已启动，监听端口 {PORT}")
            
            # 启动服务器
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n👋 正在关闭服务器...")
        print("✅ 服务器已关闭")
    except Exception as e:
        print(f"❌ 服务器启动失败: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()