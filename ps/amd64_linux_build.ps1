Remove-Item ./dist/tabdock_linux_amd64 -Force
$env:GOOS = "linux"
$env:GOARCH = "amd64"
go build -o ./dist/tabdock_linux_amd64 main.go log.go
Remove-Item Env:GOOS
Remove-Item Env:GOARCH