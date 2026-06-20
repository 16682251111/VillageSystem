@echo off
chcp 65001 >nul
title 村户信息管理系统

echo ================================================
echo   村户信息管理系统 - Village Household Manager
echo ================================================
echo.

cd /d "%~dp0"

:: 检查 Python（优先使用 py 启动器，其次 python）
py --version >nul 2>&1
if errorlevel 1 (
    python --version >nul 2>&1
    if errorlevel 1 (
        echo [错误] 未找到 Python，请先安装 Python 3.8+
        echo 下载地址: https://www.python.org/downloads/
        pause
        exit /b 1
    )
    set PY_CMD=python
    set PIP_CMD=pip
) else (
    set PY_CMD=py
    set PIP_CMD=py -m pip
)

:: 检查并安装依赖
echo [1/2] 检查依赖...
%PIP_CMD% install -r requirements.txt -q

:: 启动服务
echo [2/2] 启动服务...
echo.
start "" http://127.0.0.1:5000
%PY_CMD% app.py

pause
