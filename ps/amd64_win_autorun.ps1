Remove-Item ./dist/tabdock_win_amd64.exe -Force
$env:GOOS = "windows"
$env:GOARCH = "amd64"
go build -o ./dist/tabdock_win_amd64.exe main.go log.go
Remove-Item Env:GOOS
Remove-Item Env:GOARCH
./dist/tabdock_win_amd64.exe