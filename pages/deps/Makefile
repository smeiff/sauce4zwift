
NODE := ../../node_modules

default: flags echarts saucecharts

flags:
	powershell.exe -NoProfile -Command "if (-not (Test-Path flags)) { mkdir flags | Out-Null }; Copy-Item '$\world_countries_lists\data\flags\64x64\*.png' -Destination 'flags\'"

echarts:
	powershell.exe -NoProfile -Command "if (-not (Test-Path src)) { mkdir src | Out-Null }; Copy-Item '$\echarts\dist\echarts.esm.min.js' -Destination 'src\echarts.mjs'"

saucecharts:
	powershell.exe -NoProfile -Command "if (-not (Test-Path 'css\saucecharts')) { mkdir 'css\saucecharts' | Out-Null }; if (-not (Test-Path 'src\saucecharts')) { mkdir 'src\saucecharts' | Out-Null }; Copy-Item '$\saucecharts\src\*' -Destination 'src\saucecharts' -Recurse -Force; Copy-Item '$\saucecharts\css\*' -Destination 'css\saucecharts' -Recurse -Force"

