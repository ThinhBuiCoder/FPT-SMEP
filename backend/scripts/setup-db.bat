@echo off
echo ========================================
echo FPT Startup Platform - Database Setup
echo ========================================

REM Check if PostgreSQL is installed
where psql >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] PostgreSQL not found!
    echo.
    echo Please install PostgreSQL from:
    echo https://www.postgresql.org/download/windows/
    echo.
    echo Quick install with Chocolatey (run as Admin):
    echo   choco install postgresql -y
    echo.
    echo Or use the installer and remember your postgres password!
    pause
    exit /b 1
)

echo [OK] PostgreSQL found
echo.

REM Create database
echo Creating database 'fpt_startup_db'...
psql -U postgres -c "CREATE DATABASE fpt_startup_db;" 2>&1

echo.
echo Running Prisma migrations...
cd /d "%~dp0.."
call npx prisma db push

echo.
echo Seeding database...
call node prisma/seed.js

echo.
echo ========================================
echo Setup complete!
echo ========================================
echo Test accounts:
echo   admin@fpt.edu.vn    / 123456 (ADMIN)
echo   lecturer@fpt.edu.vn / 123456 (LECTURER)
echo   student1@fpt.edu.vn / 123456 (STUDENT)
echo ========================================
pause
