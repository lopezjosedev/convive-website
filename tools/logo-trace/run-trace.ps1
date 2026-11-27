# Re-genera los SVG del logo a partir del JPEG oficial.
# Uso: powershell -ExecutionPolicy Bypass -File run-trace.ps1
Add-Type -Path "C:\Users\xxdar\Downloads\CONVIVE\tools\logo-trace\LogoTracer.cs" -ReferencedAssemblies System.Drawing

[LogoTracer]::Run("C:\Users\xxdar\Downloads\WhatsApp Image 2026-07-16 at 20.18.19.jpeg", "C:\Users\xxdar\Downloads\CONVIVE\assets\img")

Get-Content "C:\Users\xxdar\Downloads\CONVIVE\assets\img\trace-info.txt"
